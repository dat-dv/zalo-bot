import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Login token lifetime is 1 h on the Cognee side; renew a little earlier. */
const TOKEN_REUSE_MS = 50 * 60 * 1000;
const LOGIN_TIMEOUT_MS = 30_000;

export interface CogneeRememberResult {
  datasetId: string;
  dataId: string;
}

export interface CogneeDataItem {
  id: string;
  name: string;
}

interface CogneeSettings {
  url: string;
  userEmail: string;
  userPassword: string;
  timeoutMs: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringField(value: unknown, key: string): string {
  if (!isRecord(value)) return '';
  const field = value[key];
  return typeof field === 'string' ? field : '';
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : JSON.stringify(err);
}

/** A 409 answer kept for the caller (remember of a name already stored). */
class CogneeConflict {
  constructor(public readonly detail: string) {}
}

/**
 * Cognee refuses to store a file name again with other content ("add() does not update
 * documents. '<name>' (data_id <id>) already exists in dataset <id> with different content").
 * That happens when an earlier remember stored the file but failed later (e.g. the LLM was down),
 * so its id was never kept. Returns the stored item, which is then forgotten and sent again.
 */
export function parseExistingDocument(
  detail: string,
): { datasetId: string; dataId: string } | null {
  const match = /\(data_id ([0-9a-f-]{36})\) already exists in dataset ([0-9a-f-]{36})/i.exec(
    detail,
  );
  return match ? { dataId: match[1], datasetId: match[2] } : null;
}

/** Cognee dataset of one ZCA chat; datasets are the isolation boundary between chats. */
export function cogneeDatasetName(channelId: string): string {
  return `zca-${channelId}`;
}

/**
 * Minimal client of the Cognee REST API (`/api/v1`, verified against Cognee 1.6.5): remember a
 * text file into a dataset, list and forget items, recall the graph context of a question.
 * Signs in with the configured service user (backend access control on, so each dataset stays
 * isolated). Off when not configured. Never throws: failures return `null` / `[]` / `false`.
 */
@Injectable()
export class CogneeClient {
  private readonly logger = new Logger(CogneeClient.name);
  private token: { value: string; expiresAt: number } | null = null;

  constructor(@Optional() private readonly configService?: ConfigService) {}

  public isEnabled(): boolean {
    const settings = this.settings();
    return Boolean(settings.url && settings.userPassword);
  }

  /** Stores one text document in the chat's dataset and builds its graph; waits until done. */
  public async remember(
    datasetName: string,
    fileName: string,
    text: string,
    retried = false,
  ): Promise<CogneeRememberResult | null> {
    const form = new FormData();
    form.append('data', new Blob([text], { type: 'text/plain' }), fileName);
    form.append('datasetName', datasetName);
    form.append('run_in_background', 'false');
    const body = await this.request('POST', '/remember', { form, keepConflict: true });
    if (body instanceof CogneeConflict) {
      const stale = parseExistingDocument(body.detail);
      if (stale && !retried && (await this.forget(stale.datasetId, stale.dataId))) {
        this.logger.log(`[Cognee] Replaced a stale copy of ${fileName} in ${datasetName}`);
        return this.remember(datasetName, fileName, text, true);
      }
      this.logger.warn(
        `[Cognee] POST /remember failed with HTTP 409: ${body.detail.slice(0, 300)}`,
      );
      return null;
    }
    const datasetId = stringField(body, 'dataset_id');
    const items = isRecord(body) && Array.isArray(body.items) ? body.items : [];
    const dataId = stringField(items[0], 'id');
    if (!datasetId || !dataId) {
      if (body !== null) this.logger.warn(`[Cognee] remember returned no item for ${datasetName}`);
      return null;
    }
    return { datasetId, dataId };
  }

  /** `true` once the item and the graph nodes only it produced are gone. */
  public async forget(datasetId: string, dataId: string): Promise<boolean> {
    const body = await this.request('POST', '/forget', { json: { datasetId, dataId } });
    return stringField(body, 'status') === 'success';
  }

  /**
   * Graph context Cognee would give an LLM for `query` within one chat's dataset, without letting
   * Cognee answer (`only_context`): the answer is written by `LlmService` with its citation rules.
   * `temporal` uses Cognee's time-aware retrieval for questions with a date range.
   */
  public async recallContext(
    datasetName: string,
    query: string,
    options: { temporal?: boolean; topK?: number } = {},
  ): Promise<string[]> {
    const body = await this.request('POST', '/recall', {
      json: {
        query,
        datasets: [datasetName],
        search_type: options.temporal ? 'TEMPORAL' : 'GRAPH_COMPLETION',
        only_context: true,
        top_k: options.topK ?? 10,
      },
      // A chat that has nothing in Cognee yet has no dataset: an empty answer, not an error.
      notFoundIsEmpty: true,
    });
    if (!Array.isArray(body)) return [];
    return body.map((item) => stringField(item, 'text').trim()).filter((text) => text.length > 0);
  }

  private settings(): CogneeSettings {
    const config = this.configService?.get<CogneeSettings>('cognee');
    return {
      url: config?.url ?? '',
      userEmail: config?.userEmail ?? '',
      userPassword: config?.userPassword ?? '',
      timeoutMs: config?.timeoutMs ?? 600000,
    };
  }

  private async login(settings: CogneeSettings): Promise<string | null> {
    if (this.token && this.token.expiresAt > Date.now()) return this.token.value;
    try {
      const response = await fetch(`${settings.url}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          username: settings.userEmail,
          password: settings.userPassword,
        }).toString(),
        signal: AbortSignal.timeout(LOGIN_TIMEOUT_MS),
      });
      if (!response.ok) {
        this.logger.warn(`[Cognee] Login failed with HTTP ${response.status}`);
        return null;
      }
      const value = stringField(await response.json(), 'access_token');
      if (!value) return null;
      this.token = { value, expiresAt: Date.now() + TOKEN_REUSE_MS };
      return value;
    } catch (err: unknown) {
      this.logger.warn(`[Cognee] Login error: ${errorMessage(err)}`);
      return null;
    }
  }

  private async request(
    method: 'POST' | 'GET',
    path: string,
    options: { json?: unknown; form?: FormData; notFoundIsEmpty?: boolean; keepConflict?: boolean },
    retried = false,
  ): Promise<unknown> {
    const settings = this.settings();
    if (!settings.url || !settings.userPassword) return null;
    const token = await this.login(settings);
    if (!token) return null;
    try {
      const response = await fetch(`${settings.url}/api/v1${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(options.json !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body:
          options.form ?? (options.json !== undefined ? JSON.stringify(options.json) : undefined),
        signal: AbortSignal.timeout(settings.timeoutMs),
      });
      if (response.status === 401 && !retried) {
        this.token = null;
        return this.request(method, path, options, true);
      }
      if (response.status === 404 && options.notFoundIsEmpty) return [];
      if (response.status === 409 && options.keepConflict) {
        return new CogneeConflict(await response.text().catch(() => ''));
      }
      if (!response.ok) {
        const detail = (await response.text().catch(() => '')).slice(0, 300);
        this.logger.warn(
          `[Cognee] ${method} ${path} failed with HTTP ${response.status}: ${detail}`,
        );
        return null;
      }
      const body: unknown = await response.json();
      return body;
    } catch (err: unknown) {
      this.logger.warn(`[Cognee] ${method} ${path} error: ${errorMessage(err)}`);
      return null;
    }
  }
}
