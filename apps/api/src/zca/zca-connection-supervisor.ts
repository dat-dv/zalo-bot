import type { IZcaConnectionStatus, ZcaConnectionState } from '@zalobot/contracts';

/** Waits between reconnect attempts; the last value repeats. */
export const ZCA_RECONNECT_DELAYS_MS = [5_000, 30_000, 120_000, 300_000] as const;
/** Listener restarts tried on the current session before logging in again. */
export const ZCA_LISTENER_RESTARTS_BEFORE_LOGIN = 2;
/** Failed logins in a row before the saved session counts as dead. */
export const ZCA_FAILED_LOGINS_BEFORE_EXPIRED = 3;
/** Retry pace once fast retries are pointless: the session died or was taken over. */
export const ZCA_SLOW_RETRY_MS = 30 * 60_000;
/** Admins hear about an outage only after this long, so short blips stay quiet. */
export const ZCA_DOWN_ALERT_AFTER_MS = 5 * 60_000;
/** A connection must hold this long to count as recovered, so a flapping socket keeps backing off. */
export const ZCA_STABLE_AFTER_MS = 60_000;

/** Zalo closes with these when the account connected elsewhere; hammering would fight that login. */
const ZCA_REPLACED_CLOSE_CODES: ReadonlySet<number> = new Set([3000, 3003]);

export type ZcaConnectionAlert =
  | { kind: 'down'; state: ZcaConnectionState; closeCode: number | null }
  | { kind: 'restored'; downForMs: number };

type TimerHandle = ReturnType<typeof setTimeout>;

export interface ZcaConnectionSupervisorDeps {
  restartListener(): void;
  login(): Promise<void>;
  alert(alert: ZcaConnectionAlert): void;
  now?(): number;
  setTimer?(callback: () => void, delayMs: number): TimerHandle;
  clearTimer?(timer: TimerHandle): void;
}

/**
 * Decides what happens after the realtime socket drops: when to retry, when to fall back to a full
 * login, and when admins hear about it. Holds no zca-js state, so ZcaService stays the only owner
 * of the socket and every decision here can be tested with fake timers.
 */
export class ZcaConnectionSupervisor {
  private state: ZcaConnectionState = 'logged_out';
  private stopped = true;
  private attempts = 0;
  private failedLogins = 0;
  private closeCode: number | null = null;
  private lastConnectedAt: number | null = null;
  private downSince: number | null = null;
  private alerted = false;
  private retryTimer: TimerHandle | null = null;
  private alertTimer: TimerHandle | null = null;
  private stableTimer: TimerHandle | null = null;

  constructor(private readonly deps: ZcaConnectionSupervisorDeps) {}

  private now(): number {
    return this.deps.now ? this.deps.now() : Date.now();
  }

  private schedule(callback: () => void, delayMs: number): TimerHandle {
    if (this.deps.setTimer) return this.deps.setTimer(callback, delayMs);
    const timer = setTimeout(callback, delayMs);
    // Never keeps the process (or a test run) alive just to retry a connection.
    timer.unref();
    return timer;
  }

  private cancel(timer: TimerHandle | null): null {
    if (timer) (this.deps.clearTimer ?? clearTimeout)(timer);
    return null;
  }

  public snapshot(): IZcaConnectionStatus {
    return {
      state: this.state,
      closeCode: this.closeCode,
      lastConnectedAt: this.lastConnectedAt ? new Date(this.lastConnectedAt).toISOString() : null,
      downSince: this.downSince ? new Date(this.downSince).toISOString() : null,
    };
  }

  /** A deliberate start (login, restart): the supervisor may reconnect from now on. */
  public markStarted(): void {
    this.stopped = false;
    if (this.state === 'logged_out') this.state = 'reconnecting';
  }

  /** A deliberate stop (logout, shutdown): whatever closes next must not be retried. */
  public markStopped(): void {
    this.stopped = true;
    this.retryTimer = this.cancel(this.retryTimer);
    this.alertTimer = this.cancel(this.alertTimer);
    this.stableTimer = this.cancel(this.stableTimer);
    this.state = 'logged_out';
    this.attempts = 0;
    this.failedLogins = 0;
    this.closeCode = null;
    this.downSince = null;
    this.alerted = false;
  }

  public markConnected(): void {
    this.stopped = false;
    this.state = 'connected';
    this.closeCode = null;
    this.failedLogins = 0;
    this.lastConnectedAt = this.now();
    this.retryTimer = this.cancel(this.retryTimer);
    this.stableTimer = this.cancel(this.stableTimer);
    this.stableTimer = this.schedule(() => this.markStable(), ZCA_STABLE_AFTER_MS);
  }

  private markStable(): void {
    this.stableTimer = null;
    this.attempts = 0;
    this.alertTimer = this.cancel(this.alertTimer);
    const downSince = this.downSince;
    this.downSince = null;
    if (this.alerted && downSince !== null) {
      this.alerted = false;
      this.deps.alert({ kind: 'restored', downForMs: this.now() - downSince });
    }
  }

  /** The socket dropped but zca-js may still be retrying on its own: only the outage clock starts. */
  public markDisconnected(code: number | null): void {
    if (this.stopped) return;
    this.closeCode = code;
    this.stableTimer = this.cancel(this.stableTimer);
    if (this.state !== 'session_expired' && this.state !== 'replaced') this.state = 'reconnecting';
    this.startOutageClock();
  }

  /** zca-js gave up (or never tried): reconnecting is now on us. */
  public markClosed(code: number | null): void {
    if (this.stopped) return;
    this.markDisconnected(code);
    if (this.retryTimer) return;

    if (code !== null && ZCA_REPLACED_CLOSE_CODES.has(code)) {
      this.state = 'replaced';
      this.raiseDownAlert();
      this.retryTimer = this.schedule(() => this.attempt(), ZCA_SLOW_RETRY_MS);
      return;
    }
    this.scheduleRetry();
  }

  private startOutageClock(): void {
    if (this.downSince === null) this.downSince = this.now();
    if (this.alertTimer || this.alerted) return;
    this.alertTimer = this.schedule(() => {
      this.alertTimer = null;
      this.raiseDownAlert();
    }, ZCA_DOWN_ALERT_AFTER_MS);
  }

  private raiseDownAlert(): void {
    this.alertTimer = this.cancel(this.alertTimer);
    if (this.alerted) return;
    this.alerted = true;
    this.deps.alert({ kind: 'down', state: this.state, closeCode: this.closeCode });
  }

  private scheduleRetry(): void {
    const index = Math.min(this.attempts, ZCA_RECONNECT_DELAYS_MS.length - 1);
    const delay =
      this.state === 'session_expired' ? ZCA_SLOW_RETRY_MS : ZCA_RECONNECT_DELAYS_MS[index];
    this.retryTimer = this.schedule(() => this.attempt(), delay);
  }

  private attempt(): void {
    this.retryTimer = null;
    if (this.stopped) return;
    this.attempts += 1;

    if (this.attempts > ZCA_LISTENER_RESTARTS_BEFORE_LOGIN) {
      void this.attemptLogin();
      return;
    }
    try {
      this.deps.restartListener();
    } catch {
      this.scheduleRetry();
    }
  }

  private async attemptLogin(): Promise<void> {
    try {
      await this.deps.login();
    } catch {
      if (this.stopped) return;
      this.failedLogins += 1;
      if (this.failedLogins >= ZCA_FAILED_LOGINS_BEFORE_EXPIRED) {
        this.state = 'session_expired';
        this.raiseDownAlert();
      }
      this.scheduleRetry();
    }
  }
}
