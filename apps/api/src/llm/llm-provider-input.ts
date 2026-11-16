import {
  LLM_PROVIDER_MODEL_MAX_LENGTH,
  LLM_PROVIDER_NAME_MAX_LENGTH,
  isLlmProviderKind,
  type ICreateLlmProviderRequest,
  type IUpdateLlmProviderRequest,
  type LlmProviderKind,
} from '@zalobot/contracts';

/** A rejected request body; the controller turns it into a 400. */
export class LlmProviderInputError extends Error {}

type RecordBody = Record<string, unknown>;

/** Lowercase letters, digits, `.`, `_`, `-`: the name shows in logs and the ping route. */
const NAME_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;
const MAX_API_KEY_LENGTH = 1000;
const MAX_BASE_URL_LENGTH = 500;

function text(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw new LlmProviderInputError(`${field} must be text.`);
  return value.trim();
}

function parseName(value: unknown): string {
  const name = text(value, 'name')?.toLowerCase() ?? '';
  if (!name) throw new LlmProviderInputError('name is required.');
  if (name.length > LLM_PROVIDER_NAME_MAX_LENGTH || !NAME_PATTERN.test(name)) {
    throw new LlmProviderInputError(
      'name may only hold lowercase letters, digits, dot, dash and underscore.',
    );
  }
  return name;
}

function parseKind(value: unknown): LlmProviderKind {
  if (!isLlmProviderKind(value)) throw new LlmProviderInputError('kind is invalid.');
  return value;
}

function parseModel(value: unknown): string {
  const model = text(value, 'model') ?? '';
  if (!model) throw new LlmProviderInputError('model is required.');
  if (model.length > LLM_PROVIDER_MODEL_MAX_LENGTH) {
    throw new LlmProviderInputError('model is too long.');
  }
  return model;
}

/** Blank means "use the kind's default"; anything else must be an http(s) URL. */
function parseBaseUrl(value: unknown): string | null {
  const raw = text(value, 'baseUrl');
  if (!raw) return null;
  if (raw.length > MAX_BASE_URL_LENGTH) throw new LlmProviderInputError('baseUrl is too long.');
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new LlmProviderInputError('baseUrl is not a valid URL.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new LlmProviderInputError('baseUrl must start with http:// or https://.');
  }
  return raw.replace(/\/+$/, '');
}

/** Blank means "no new key". */
function parseApiKey(value: unknown): string | undefined {
  const key = text(value, 'apiKey');
  if (!key) return undefined;
  if (key.length > MAX_API_KEY_LENGTH) throw new LlmProviderInputError('apiKey is too long.');
  return key;
}

function parseBoolean(value: unknown, field: string): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'boolean')
    throw new LlmProviderInputError(`${field} must be true or false.`);
  return value;
}

export function parseCreateLlmProvider(body: RecordBody): ICreateLlmProviderRequest {
  return {
    name: parseName(body.name),
    kind: parseKind(body.kind),
    baseUrl: parseBaseUrl(body.baseUrl),
    model: parseModel(body.model),
    apiKey: parseApiKey(body.apiKey) ?? null,
    enabled: parseBoolean(body.enabled, 'enabled') ?? true,
  };
}

/** Only fields present in the body are returned, so the rest of the row stays. */
export function parseUpdateLlmProvider(body: RecordBody): IUpdateLlmProviderRequest {
  const patch: IUpdateLlmProviderRequest = {};
  if (body.name !== undefined) patch.name = parseName(body.name);
  if (body.kind !== undefined) patch.kind = parseKind(body.kind);
  if (body.baseUrl !== undefined) patch.baseUrl = parseBaseUrl(body.baseUrl);
  if (body.model !== undefined) patch.model = parseModel(body.model);
  const apiKey = parseApiKey(body.apiKey);
  if (apiKey) patch.apiKey = apiKey;
  const clearApiKey = parseBoolean(body.clearApiKey, 'clearApiKey');
  if (clearApiKey) patch.clearApiKey = true;
  const enabled = parseBoolean(body.enabled, 'enabled');
  if (enabled !== undefined) patch.enabled = enabled;
  return patch;
}

export function parseReorderLlmProviders(body: RecordBody): string[] {
  const { ids } = body;
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string' || !id)) {
    throw new LlmProviderInputError('ids must be a list of provider ids.');
  }
  const unique = new Set(ids as string[]);
  if (unique.size !== ids.length) throw new LlmProviderInputError('ids has duplicates.');
  return [...unique];
}
