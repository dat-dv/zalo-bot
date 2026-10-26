import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgentInput } from '../../types/agent-input.type';
import { TextToolFactory } from './text-tool.factory';
import { TextToolType } from './text-tool.enum';
import {
  isTextToolType,
  selectToolDefinitions,
  textToolDefinitionsFor,
} from './text-tool.definitions';
import { LlmService } from '../../llm/llm.service';
import type { LlmToolCall, LlmToolDefinition } from '../../llm/types/llm.types';
import { parseTargetUsers } from '../../reminders/reminder-target';
import { ZcaMessengerService } from '../zca-messenger.service';
import {
  TransactionConfirmationService,
  PendingAction,
} from '../confirmation/transaction-confirmation.service';
import { cleanBotMention } from './bot-mention.util';
import { PendingImageActionService } from '../pending-image/pending-image-action.service';
import { OcrService } from '../../ocr/ocr.service';
import { MediaStorageService } from '../../receipt-storage/media-storage.service';

import { PendingImageActionDispatcher } from '../pending-image/pending-image-dispatcher.service';
import { CancelPendingImageStrategy } from '../pending-image/strategies/cancel-pending-image.strategy';
import { StorageUploadPendingImageStrategy } from '../pending-image/strategies/storage-upload-pending-image.strategy';
import { CreateBillPendingImageStrategy } from '../pending-image/strategies/create-bill-pending-image.strategy';
import { getVietnamDateTimeContext } from '../../common/utils/datetime.util';
import { ChatMemoryService } from '../memory/chat-memory.service';
import { ChannelNotesService } from '../memory/channel-notes.service';
import { LearnedFactsService } from '../memory/learned-facts.service';
import { OutgoingMemoryKind } from '../memory/memory-kind';
import { BOT_IDENTITY_LINE, buildMemoryProfileBlock } from '../memory/memory-profile.util';
import { CHIT_CHAT_INSTRUCTION, buildToolSystemInstruction } from './text-system-prompt';
import { ZALO_PLAIN_TEXT_INSTRUCTION } from './zalo-plain-text.util';
import {
  AMEND_PENDING_TOOL,
  AMEND_PENDING_TOOL_NAME,
  amendablePendingBlock,
  pickAmendTarget,
} from './amend-pending.tool';
import { mergeEditedToolArgs, pendingToolArgs } from './pending-edit-args.util';

/** Tools that only read data; their answers stay out of the long-term memory. */
const READ_ONLY_TOOLS = new Set<string>([
  TextToolType.GET_REPORT,
  TextToolType.LIST_TASKS,
  TextToolType.LIST_CALENDAR_EVENTS,
  TextToolType.GET_STORAGE_LINKS,
  TextToolType.SEARCH_CHAT_HISTORY,
]);

/** An edit sends only the args it changes, so none of them may be required. */
function withoutRequiredArgs(definition: LlmToolDefinition): LlmToolDefinition {
  if (!definition.parameters) return definition;
  return {
    ...definition,
    parameters: { type: definition.parameters.type, properties: definition.parameters.properties },
  };
}

@Injectable()
export class TextInputService {
  private readonly logger = new Logger(TextInputService.name);

  constructor(
    private readonly toolFactory: TextToolFactory,
    private readonly llmService: LlmService,
    private readonly zcaMessenger: ZcaMessengerService,
    private readonly confirmationService: TransactionConfirmationService,
    @Optional() private readonly configService?: ConfigService,
    @Optional() private readonly pendingImageActionService?: PendingImageActionService,
    @Optional() private readonly ocrService?: OcrService,
    @Optional() private readonly mediaStorageService?: MediaStorageService,
    @Optional() private pendingImageDispatcher?: PendingImageActionDispatcher,
    @Optional() private readonly channelNotesService?: ChannelNotesService,
    @Optional() private readonly learnedFactsService?: LearnedFactsService,
    @Optional() private readonly chatMemoryService?: ChatMemoryService,
  ) {
    if (!this.pendingImageDispatcher && this.pendingImageActionService) {
      // Auto-wire default strategies when dispatcher is not injected (e.g. in standalone tests)
      const cancelStrategy = new CancelPendingImageStrategy(
        this.zcaMessenger,
        this.pendingImageActionService,
      );
      const storageStrategy = new StorageUploadPendingImageStrategy(
        this.zcaMessenger,
        this.pendingImageActionService,
        this.mediaStorageService,
      );
      const billStrategy = new CreateBillPendingImageStrategy(
        this.zcaMessenger,
        this.pendingImageActionService,
        this.llmService,
        this.toolFactory,
        this.ocrService,
        this.mediaStorageService,
        undefined,
        this.zcaMessenger,
      );
      this.pendingImageDispatcher = new PendingImageActionDispatcher(
        cancelStrategy,
        storageStrategy,
        billStrategy,
        this.pendingImageActionService,
      );
    }
  }

  public async process(input: AgentInput, toolTypeOverride?: TextToolType): Promise<void> {
    const rawText = input.text?.trim() || '';
    const botName =
      this.configService?.get<string>('zalo.botName') || process.env.BOT_NAME || 'Bot';
    const text = cleanBotMention(rawText, botName, input.triggerPrefixes);
    input.text = text;
    const chatId = input.chatId || input.senderId;
    const senderId = input.senderId;
    const displayName = input.displayName;

    // Bỏ qua nếu tin nhắn ảnh nhưng không có nội dung text hợp lệ sau khi làm sạch mention
    if (!text && input.type === 'image') {
      return;
    }

    // 1. Explicit tool override
    if (toolTypeOverride) {
      const strategy = this.toolFactory.getStrategy(toolTypeOverride);
      await strategy.execute({
        input,
        chatId,
        senderId,
        displayName,
        text,
      });
      return;
    }

    // 2. Pending Transaction Confirmation fast-path ("yes 123", "cancel 123", "edit 123 ...", etc.)
    const handledConfirmation = await this.confirmationService.handleCommand(
      senderId,
      chatId,
      text,
      (pending, instruction) => this.handleEditPendingAction(input, pending, instruction),
    );
    if (handledConfirmation) {
      return;
    }

    // 3. Pending Image Action ("1", "1 ghi chú", "2", "hủy") via Strategy Dispatcher
    if (this.pendingImageDispatcher) {
      const handledImage = await this.pendingImageDispatcher.dispatch(
        input,
        senderId,
        chatId,
        displayName,
        text,
      );
      if (handledImage) {
        return;
      }
    }

    // Nếu người dùng chỉ gõ số "1" hoặc "2" đơn lẻ nhưng hiện không có ảnh nào chờ xử lý (tránh LLM gọi nhầm tool)
    if (/^[12]$/.test(text.trim())) {
      await this.zcaMessenger.sendMessage(
        chatId,
        'Không có ảnh hay giao dịch nào đang chờ. Gửi ảnh mới hoặc nhắn yêu cầu, vd "ăn trưa 45k", "mai 9h họp".',
      );
      return;
    }

    // 2. Fast-path for deterministic commands (/gioithieu, /help, /echo, /ping, /reset)
    const fastPath = this.toolFactory.resolveFastPathToolType(text);
    if (fastPath) {
      const strategy = this.toolFactory.getStrategy(fastPath);
      await strategy.execute({
        input,
        chatId,
        senderId,
        displayName,
        text,
      });
      return;
    }

    // 3. AI / LLM Tool Calling for natural language processing
    const timeZone =
      this.configService?.get<string>('timezone') ||
      process.env.DEFAULT_TIMEZONE ||
      'Asia/Ho_Chi_Minh';
    const dtContext = getVietnamDateTimeContext(new Date(), timeZone);
    const profile = await this.buildProfileBlock(chatId, input);
    const amendable = await this.amendablePending(senderId, chatId);
    const systemInstruction = buildToolSystemInstruction({
      profile,
      dateTimeSnippet: dtContext.systemInstructionSnippet,
      longTermMemory: Boolean(input.longTermMemory),
      allowAiChat: input.allowAiChat !== false,
      amendableBlock: amendablePendingBlock(amendable),
    });
    const tools = textToolDefinitionsFor({ longTermMemory: Boolean(input.longTermMemory) });

    try {
      const response = await this.zcaMessenger.withTyping(chatId, () =>
        this.llmService.generate(
          text,
          amendable.length > 0 ? [...tools, AMEND_PENDING_TOOL] : tools,
          systemInstruction,
        ),
      );

      const toolCalls =
        response.toolCalls && response.toolCalls.length > 0
          ? response.toolCalls
          : response.toolCall
            ? [response.toolCall]
            : [];

      if (toolCalls.length > 0) {
        // A request to the bot, not conversation: it reaches the long-term memory only as the
        // confirmed action, if it is approved and succeeds.
        if (input.messageId) {
          void this.chatMemoryService?.setKind(chatId, input.messageId, 'request');
        }
        this.propagateSharedTransactionContext(toolCalls);
        const amendedTypes = await this.amendFromToolCalls(toolCalls, amendable, input, text);
        // A question about a missing detail goes out after the cards of what could be done.
        const isQuestion = (call: { name: string }) =>
          call.name === (TextToolType.ASK_CLARIFICATION as string);
        const ordered = [
          ...toolCalls.filter((call) => !isQuestion(call)),
          ...toolCalls.filter(isQuestion),
        ];
        for (const toolCall of ordered) {
          if (toolCall.name === AMEND_PENDING_TOOL_NAME) continue;
          if (amendedTypes.has(toolCall.name)) {
            this.logger.log(
              `Skipping "${toolCall.name}": this message already amended a pending card of that type.`,
            );
            continue;
          }
          this.logger.log(
            `LLM resolved tool "${toolCall.name}" with args: ${JSON.stringify(toolCall.args)}`,
          );

          let strategy;
          try {
            strategy = this.toolFactory.getStrategy(toolCall.name as TextToolType);
          } catch {
            this.logger.warn(
              `Strategy for tool "${toolCall.name}" not found. Falling back to CONVERSATION.`,
            );
            if (input.allowAiChat === false) {
              return;
            }
            strategy = this.toolFactory.getStrategy(TextToolType.CONVERSATION);
          }

          const context = { input, chatId, senderId, displayName, text, toolArgs: toolCall.args };
          // Answers of read-only tools are fine for follow-ups but go stale, so they stay out of
          // the long-term memory.
          await (READ_ONLY_TOOLS.has(toolCall.name)
            ? OutgoingMemoryKind.run('tool', () => strategy.execute(context))
            : strategy.execute(context));
        }
        return;
      }

      // Plain AI conversational reply; free chat disabled (allowAiChat === false) means stay silent.
      if (input.allowAiChat === false) {
        this.logger.debug(
          `[TextInputService] allowAiChat is disabled in thread ${chatId}. Remaining silent.`,
        );
        return;
      }

      // Every provider of the chain already failed: report it once rather than running the
      // whole chain again for the tool-free pass.
      if (response.failed) {
        await this.toolFactory.getStrategy(TextToolType.CONVERSATION).execute({
          input,
          chatId,
          senderId,
          displayName,
          text,
          aiReplyText: response.text,
        });
        return;
      }

      // A tool-free second pass answers without the tool catalog biasing the reply toward refusals;
      // the first pass text stays as fallback.
      const chitChatReply = await this.zcaMessenger.withTyping(chatId, () =>
        this.generateChitChatReply(text, dtContext.systemInstructionSnippet, profile),
      );

      const conversationStrategy = this.toolFactory.getStrategy(TextToolType.CONVERSATION);
      await conversationStrategy.execute({
        input,
        chatId,
        senderId,
        displayName,
        text,
        aiReplyText: chitChatReply ?? response.text,
      });
    } catch (err) {
      this.logger.error(`Error in LLM text processing: ${(err as Error).message}`);
      if (input.allowAiChat === false) {
        return;
      }
      // Fallback to conversation strategy
      const fallbackStrategy = this.toolFactory.getStrategy(TextToolType.CONVERSATION);
      await fallbackStrategy.execute({
        input,
        chatId,
        senderId,
        displayName,
        text,
      });
    }
  }

  /** Re-issues a pending card from an edit; `true` once its new card is out. */
  public async handleEditPendingAction(
    input: AgentInput,
    pending: PendingAction,
    instruction: string,
  ): Promise<boolean> {
    const chatId = input.chatId || input.senderId;
    const senderId = input.senderId;
    const displayName = input.displayName;

    // An edit may only re-issue the same kind of action: exposing every tool here would let any
    // group member reach unrelated tools (storage links, reports...) through "edit <code> ...".
    const editTool = isTextToolType(pending.actionType) ? pending.actionType : undefined;
    if (!editTool) {
      await this.zcaMessenger.sendMessage(
        chatId,
        `⚠️ Yêu cầu [${pending.code}] không sửa được. Gõ "cancel ${pending.code}" rồi tạo yêu cầu mới.`,
      );
      return false;
    }

    const timeZone =
      this.configService?.get<string>('timezone') ||
      process.env.DEFAULT_TIMEZONE ||
      'Asia/Ho_Chi_Minh';
    const dtContext = getVietnamDateTimeContext(new Date(), timeZone);

    // A card with an args mapping is edited as a patch on its own args, so whatever the edit
    // leaves out (other reminder times, the people reminded) is kept instead of re-derived.
    const previousArgs = pendingToolArgs(pending.actionType, pending.payload);

    const previousInfoLines: string[] = [
      `- Loại thao tác (Tool Call trước đó): ${pending.actionType}`,
      `- Tiêu đề: ${pending.title}`,
    ];
    if (pending.rawPrompt) {
      previousInfoLines.push(`- Yêu cầu ban đầu của người dùng: "${pending.rawPrompt}"`);
    }
    if (previousArgs) {
      previousInfoLines.push(
        `- Tham số hiện tại (đúng dạng tham số của công cụ ${editTool}):`,
        JSON.stringify(previousArgs, null, 2),
      );
      const people = parseTargetUsers(pending.payload.remindUsers) ?? [];
      if (people.length > 0) {
        previousInfoLines.push(`- Đang nhắc: ${people.map((user) => `@${user.name}`).join(', ')}`);
      }
    } else {
      previousInfoLines.push(
        `- Dữ liệu tham số hiện tại:`,
        JSON.stringify(pending.payload, null, 2),
      );
    }

    const taskLines = previousArgs
      ? [
          `- CHỈ điền các tham số cần thay đổi; tham số giữ nguyên thì bỏ trống.`,
          `- Nếu đổi giờ nhắc: điền ĐẦY ĐỦ danh sách giờ sau khi đổi (remindTimes cho giờ nhắc một lần, repeatingTimes cho giờ lặp).`,
          `- Người được nhắc lấy từ người được tag trong tin nhắn, không ghi vào tham số.`,
          `- Luôn gọi lại công cụ ${editTool}, kể cả khi không có tham số nào cần đổi (khi đó gọi với tham số rỗng).`,
        ]
      : [
          `- Phân tích kỹ yêu cầu điều chỉnh của người dùng dựa trên ngữ cảnh và dữ liệu tham số hiện tại.`,
          `- Giữ nguyên các thông tin cũ nếu người dùng không yêu cầu thay đổi.`,
          `- Cập nhật, thay đổi hoặc bổ sung các trường thông tin theo đúng yêu cầu mới của người dùng.`,
          `- Gọi lại công cụ ${editTool} với các tham số đã cập nhật hoàn chỉnh để tạo yêu cầu xác nhận mới.`,
        ];

    const prompt =
      `Người dùng đang chỉnh sửa / cung cấp lại ngữ cảnh cho yêu cầu thao tác đang chờ xác nhận (mã: ${pending.code}).\n\n` +
      `[NGỮ CẢNH THAO TÁC TRƯỚC ĐÓ]\n` +
      `${previousInfoLines.join('\n')}\n\n` +
      `[YÊU CẦU ĐIỀU CHỈNH / CONTEXT MỚI TỪ NGƯỜI DÙNG]\n` +
      `"${instruction}"\n\n` +
      `Nhiệm vụ của bạn:\n` +
      `${taskLines.join('\n')}\n\n` +
      `QUY TẮC QUAN TRỌNG KHI GỌI TOOL:\n` +
      `- Mọi giá trị tham số trong arguments PHẢI là giá trị phẳng (primitive: string, number, boolean). TUYỆT ĐỐI KHÔNG lồng tham số thành object.`;

    const systemInstruction =
      `Bạn là trợ lý cá nhân thông minh trên Zalo.\n\n` +
      `${dtContext.systemInstructionSnippet}\n\n` +
      `Nhiệm vụ: Cập nhật thông tin thao tác dựa trên ngữ cảnh thao tác trước đó và yêu cầu điều chỉnh của người dùng để gọi công cụ phù hợp.\n` +
      `QUY TẮC QUAN TRỌNG KHI GỌI TOOL:\n` +
      `- Mọi giá trị tham số trong arguments PHẢI là giá trị phẳng (primitive: string, number, boolean). TUYỆT ĐỐI KHÔNG lồng tham số thành object.\n\n` +
      ZALO_PLAIN_TEXT_INSTRUCTION;

    const editTools = selectToolDefinitions([editTool]);

    try {
      const response = await this.zcaMessenger.withTyping(chatId, () =>
        this.llmService.generate(
          prompt,
          previousArgs ? editTools.map(withoutRequiredArgs) : editTools,
          systemInstruction,
        ),
      );

      const toolCall = response.toolCall;
      if (toolCall && toolCall.name !== String(editTool)) {
        this.logger.warn(
          `[TextInputService] Edit of "${pending.code}" resolved tool "${toolCall.name}" instead of "${editTool}". Skipping.`,
        );
        return false;
      }
      // A patch edit without a tool call changes no args, but is still re-issued: the people
      // tagged in the edit message apply to the new card.
      const toolArgs = previousArgs
        ? mergeEditedToolArgs(previousArgs, toolCall?.args ?? {})
        : toolCall?.args;
      if (toolArgs) {
        this.logger.log(
          toolCall
            ? `LLM resolved updated tool "${toolCall.name}" with args: ${JSON.stringify(toolCall.args)}`
            : `Edit of "${pending.code}" got no tool call; re-issuing "${editTool}" with its previous args.`,
        );

        let strategy;
        let reissued = true;
        try {
          strategy = this.toolFactory.getStrategy(editTool);
        } catch {
          this.logger.warn(
            `Strategy for tool "${editTool}" not found. Falling back to CONVERSATION.`,
          );
          if (input.allowAiChat === false) {
            return false;
          }
          strategy = this.toolFactory.getStrategy(TextToolType.CONVERSATION);
          reissued = false;
        }

        await strategy.execute({
          input,
          chatId,
          senderId,
          displayName,
          text: instruction,
          toolArgs,
          previousPayload: pending.payload,
        });
        return reissued;
      }

      // Plain AI conversational reply if LLM didn't return a tool call
      if (input.allowAiChat === false) {
        return false;
      }
      const conversationStrategy = this.toolFactory.getStrategy(TextToolType.CONVERSATION);
      await conversationStrategy.execute({
        input,
        chatId,
        senderId,
        displayName,
        text: instruction,
        aiReplyText: response.text,
      });
      return false;
    } catch (err) {
      this.logger.error(`Failed to handle edit pending action: ${(err as Error).message}`);
      await this.zcaMessenger.sendMessage(
        chatId,
        `⚠️ Chưa sửa được yêu cầu: ${(err as Error).message}`,
      );
      return false;
    }
  }

  /**
   * The sender's pending cards in this chat that a follow-up message may amend. A failed lookup
   * means none: the message then goes the usual way rather than failing.
   */
  private async amendablePending(senderId: string, chatId: string): Promise<PendingAction[]> {
    try {
      const now = Date.now();
      const pendings = await this.confirmationService.getPendingListForUser(senderId);
      return pendings.filter(
        (pending) =>
          pending.chatId === chatId &&
          pending.expiresAt > now &&
          isTextToolType(pending.actionType),
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : JSON.stringify(err);
      this.logger.warn(
        `[TextInputService] Could not list pending cards of ${senderId}: ${message}`,
      );
      return [];
    }
  }

  /**
   * Runs the amend calls of a message: each re-issues one of the sender's pending cards through
   * the edit flow, with the whole message as the instruction. Returns the amended action types;
   * other tool calls of those types in the message are dropped so a follow-up never asks for a
   * second card.
   */
  private async amendFromToolCalls(
    toolCalls: readonly LlmToolCall[],
    amendable: readonly PendingAction[],
    input: AgentInput,
    text: string,
  ): Promise<Set<string>> {
    const chatId = input.chatId || input.senderId;
    const amendedTypes = new Set<string>();
    const amendedCodes = new Set<string>();
    for (const toolCall of toolCalls) {
      if (toolCall.name !== AMEND_PENDING_TOOL_NAME) continue;
      const target = pickAmendTarget(amendable, toolCall.args?.code);
      if (!target) {
        this.logger.warn(
          `[TextInputService] Amend call matches no pending card: ${JSON.stringify(toolCall.args)}`,
        );
        continue;
      }
      if (amendedCodes.has(target.code)) continue;
      amendedCodes.add(target.code);
      amendedTypes.add(target.actionType);
      this.logger.log(`Follow-up message amends pending "${target.code}" (${target.actionType}).`);
      await this.confirmationService.amendPending(
        input.senderId,
        chatId,
        target.code,
        text,
        (pending, instruction) => this.handleEditPendingAction(input, pending, instruction),
      );
    }
    return amendedTypes;
  }

  /**
   * What the chat told the bot to remember, plus learned facts about the bot, the sender, the
   * people tagged. Built whatever the memory switch is:
   * notes are independent of them.
   */
  private async buildProfileBlock(chatId: string, input: AgentInput): Promise<string> {
    const memberIds = [
      ...new Set(
        [input.senderId, ...(input.taggedUsers ?? []).map((user) => user.id)].filter(
          (id): id is string => Boolean(id),
        ),
      ),
    ];
    const [notes, facts] = await Promise.all([
      this.channelNotesService?.list(chatId) ?? [],
      input.longTermMemory ? (this.learnedFactsService?.forPrompt(chatId, memberIds) ?? []) : [],
    ]);
    return buildMemoryProfileBlock(notes, facts);
  }

  /** Tool-free free-chat reply; `undefined` when empty or failed so the caller can fall back. */
  private async generateChitChatReply(
    text: string,
    dateTimeSnippet: string,
    profile = '',
  ): Promise<string | undefined> {
    const systemInstruction =
      `${BOT_IDENTITY_LINE}\n\n` +
      (profile ? `${profile}\n\n` : '') +
      `${dateTimeSnippet}\n\n` +
      'Hãy trả lời tin nhắn của người dùng một cách tự nhiên, thân thiện, ngắn gọn bằng tiếng Việt.\n\n' +
      `${CHIT_CHAT_INSTRUCTION}\n\n` +
      ZALO_PLAIN_TEXT_INSTRUCTION;
    try {
      const response = await this.llmService.generate(text, undefined, systemInstruction);
      const reply = response.text?.trim();
      return reply ? reply : undefined;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : JSON.stringify(err);
      this.logger.warn(`[TextInputService] Chit-chat generation failed: ${message}`);
      return undefined;
    }
  }

  private propagateSharedTransactionContext(
    toolCalls: Array<{ name: string; args?: Record<string, unknown> }>,
  ): void {
    if (!toolCalls || toolCalls.length <= 1) return;

    const txCalls = toolCalls.filter(
      (tc) =>
        tc.name === (TextToolType.RECORD_TRANSACTION as string) &&
        tc.args &&
        typeof tc.args === 'object',
    );

    if (txCalls.length <= 1) return;

    // 1. Kiểm tra ngữ cảnh thời gian giữa các giao dịch
    const occurredTimes = txCalls
      .map((tc) => (typeof tc.args?.occurredAt === 'string' ? tc.args.occurredAt.trim() : ''))
      .filter(Boolean);
    const uniqueTimes = Array.from(new Set(occurredTimes));
    const isSameTimeContext = uniqueTimes.length <= 1;

    // 2. Kế thừa occurredAt nếu chỉ có đúng 1 mốc thời gian duy nhất cho cả câu
    if (uniqueTimes.length === 1 && occurredTimes.length < txCalls.length) {
      const sharedTime = uniqueTimes[0];
      for (const tc of txCalls) {
        if (tc.args && !tc.args.occurredAt) {
          tc.args.occurredAt = sharedTime;
        }
      }
    }

    // 3. Kế thừa placeName nếu các giao dịch trong cùng ngữ cảnh thời gian và chỉ có đúng 1 địa điểm được nêu
    if (isSameTimeContext) {
      const placeNames = txCalls
        .map((tc) => (typeof tc.args?.placeName === 'string' ? tc.args.placeName.trim() : ''))
        .filter(Boolean);
      const uniquePlaces = Array.from(new Set(placeNames.map((p) => p.toLowerCase())));

      if (uniquePlaces.length === 1 && placeNames.length < txCalls.length) {
        const sharedPlace = placeNames[0];
        for (const tc of txCalls) {
          if (tc.args && (!tc.args.placeName || !(tc.args.placeName as string).trim())) {
            tc.args.placeName = sharedPlace;
          }
        }
      }

      // 4. Kế thừa paymentMethod tương tự
      const paymentMethods = txCalls
        .map((tc) =>
          typeof tc.args?.paymentMethod === 'string' ? tc.args.paymentMethod.trim() : '',
        )
        .filter(Boolean);
      const uniquePayments = Array.from(new Set(paymentMethods.map((p) => p.toLowerCase())));

      if (uniquePayments.length === 1 && paymentMethods.length < txCalls.length) {
        const sharedPayment = paymentMethods[0];
        for (const tc of txCalls) {
          if (tc.args && (!tc.args.paymentMethod || !(tc.args.paymentMethod as string).trim())) {
            tc.args.paymentMethod = sharedPayment;
          }
        }
      }
    }
  }
}
