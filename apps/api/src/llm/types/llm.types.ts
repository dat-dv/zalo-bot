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

export interface ILlmProvider {
  readonly name: string;
  generate(
    prompt: string,
    tools?: LlmToolDefinition[],
    systemInstruction?: string,
  ): Promise<LlmResponse>;
}
