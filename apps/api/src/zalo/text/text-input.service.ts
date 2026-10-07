import { Injectable } from '@nestjs/common';
import { AgentInput } from '../types/agent-input.type';
import { TextToolFactory } from './text-tool.factory';
import { TextToolType } from './text-tool.enum';

@Injectable()
export class TextInputService {
  constructor(private readonly toolFactory: TextToolFactory) {}

  public async process(input: AgentInput, toolTypeOverride?: TextToolType): Promise<void> {
    const text = input.text?.trim() || '';
    const toolType = toolTypeOverride ?? this.toolFactory.resolveToolType(text);
    const strategy = this.toolFactory.getStrategy(toolType);

    await strategy.execute({
      input,
      chatId: input.chatId || input.senderId,
      senderId: input.senderId,
      displayName: input.displayName,
      text,
    });
  }
}
