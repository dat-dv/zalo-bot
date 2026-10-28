/** The part of an Express `Request` needed to find the caller's IP; specs pass a plain object. */
export interface ClientIpSource {
  get(name: string): string | undefined;
  ip?: string;
}

/**
 * Express has no `trust proxy` here, so `req.ip` is nginx for everyone. Cloudflare and nginx
 * headers carry the real client; they can be forged by a caller that skips Cloudflare, so limits
 * keyed on this IP need a second line (an overall cap, or a long secret) behind them.
 */
export function getClientIp(req: ClientIpSource): string {
  const header = (name: string): string | undefined => {
    const value = req.get(name)?.split(',')[0]?.trim();
    return value || undefined;
  };
  return header('cf-connecting-ip') ?? header('x-real-ip') ?? req.ip ?? 'unknown';
}
