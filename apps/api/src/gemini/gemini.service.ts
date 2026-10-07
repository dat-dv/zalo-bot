import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, GenerativeModel, ChatSession, Content } from '@google/generative-ai';
import { buildSystemInstruction, getCurrentTimeInfo } from './helpers/gemini-prompt.helper';

export interface ChatResponse {
  text: string;
}

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private genAI: GoogleGenerativeAI;
  private readonly defaultTimeZone: string;
  private primaryModelName: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('gemini.apiKey', '');
    this.primaryModelName = this.configService.get<string>('gemini.model', 'gemini-2.5-flash');
    this.defaultTimeZone = this.configService.get<string>('timezone', 'Asia/Ho_Chi_Minh');

    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
  }

  public getCurrentTimeInfo(): { nowText: string; nowIso: string } {
    return getCurrentTimeInfo(this.defaultTimeZone);
  }

  private getGenerativeModel(modelName: string): GenerativeModel {
    const systemInstruction = buildSystemInstruction(this.defaultTimeZone);

    return this.genAI.getGenerativeModel({
      model: modelName,
      systemInstruction,
    });
  }

  public async chat(
    userMessage: string,
    chatHistory: Content[] = [],
    userId?: string | number,
  ): Promise<ChatResponse> {
    if (!this.genAI) {
      return {
        text: 'GEMINI_API_KEY chưa được cấu hình. Vui lòng thiết lập GEMINI_API_KEY trong file .env.',
      };
    }

    const candidateModels = [
      this.primaryModelName,
      'gemini-2.5-flash',
      'gemini-1.5-flash',
      'gemini-flash-latest',
    ];

    const uniqueModels = Array.from(new Set(candidateModels));
    let lastError: Error | null = null;

    for (const modelName of uniqueModels) {
      try {
        const model = this.getGenerativeModel(modelName);
        const chatSession: ChatSession = model.startChat({
          history: chatHistory,
        });

        const response = await chatSession.sendMessage(userMessage);
        const replyText = response.response.text();

        return {
          text: replyText || 'Tôi đã nhận được tin nhắn của bạn.',
        };
      } catch (err) {
        lastError = err as Error;
        this.logger.warn(
          `Model ${modelName} failed for user ${userId ?? 'unknown'}: ${lastError.message}. Trying next candidate...`,
        );
      }
    }

    this.logger.error(`All model candidates failed. Last error: ${lastError?.message}`);
    return {
      text: 'Xin lỗi, hệ thống AI hiện đang bận hoặc gặp sự cố kết nối. Vui lòng thử lại sau vài giây.',
    };
  }
}
