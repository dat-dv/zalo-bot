export interface LlmToolProperty {
  type: string;
  description?: string;
  enum?: string[];
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
  text?: string;
  toolCall?: LlmToolCall;
  toolCalls?: LlmToolCall[];
}

export interface ILlmProvider {
  readonly name: string;
  generate(
    prompt: string,
    tools?: LlmToolDefinition[],
    systemInstruction?: string,
  ): Promise<LlmResponse>;
}
