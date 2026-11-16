export interface LlmToolProperty {
  type: string;
  description?: string;
  enum?: string[];
  /** Element schema of an `ARRAY` property. */
  items?: LlmToolProperty;
  /** Fields of an `OBJECT` property (e.g. the elements of an array of objects). */
  properties?: Record<string, LlmToolProperty>;
  required?: string[];
}

export interface LlmToolDefinition {
  name: string;
  description: string;
  parameters?: {
    type?: string;
    properties: Record<string, LlmToolProperty>;
    required?: string[];
  };
}

export interface LlmToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface LlmResponse {
  /** On failure: a user-facing Vietnamese error message (shown only when every provider failed). */
  text?: string;
  toolCall?: LlmToolCall;
  toolCalls?: LlmToolCall[];
  /** Missing config, HTTP/network error or timeout; `LlmService` then tries the next provider. */
  failed?: boolean;
}

/** Everything one call needs, resolved from a `llm_providers` row (API key decrypted). */
export interface LlmCallConfig {
  /** Empty for Gemini, whose endpoint is fixed. */
  baseUrl: string;
  model: string;
  /** Empty when the provider has no key (allowed for Ollama). */
  apiKey: string;
}

/** Talks to one kind of API; the provider row it serves is given on every call. */
export interface ILlmClient {
  generate(
    config: LlmCallConfig,
    prompt: string,
    tools?: LlmToolDefinition[],
    systemInstruction?: string,
  ): Promise<LlmResponse>;
}
