import { AgentInput } from '../../types/agent-input.type';
import { TextToolType } from './text-tool.enum';

export interface TextToolContext {
  input: AgentInput;
  chatId: string;
  senderId: string;
  displayName: string;
  text: string;
  toolArgs?: Record<string, unknown>;
  aiReplyText?: string;
  /** Payload of the pending card this call re-issues; only set on an edit. */
  previousPayload?: Record<string, unknown>;
}

export interface TextToolStrategy {
  readonly type: TextToolType;
  execute(context: TextToolContext): Promise<void>;
}
