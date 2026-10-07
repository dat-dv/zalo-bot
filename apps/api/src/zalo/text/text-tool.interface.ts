import { AgentInput } from '../types/agent-input.type';
import { TextToolType } from './text-tool.enum';

export interface TextToolContext {
  input: AgentInput;
  chatId: string;
  senderId: string;
  displayName: string;
  text: string;
}

export interface TextToolStrategy {
  readonly type: TextToolType;
  execute(context: TextToolContext): Promise<void>;
}
