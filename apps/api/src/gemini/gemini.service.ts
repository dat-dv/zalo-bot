import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GoogleGenerativeAI,
  GenerativeModel,
  ChatSession,
  Content,
} from '@google/generative-ai';
import { buildSystemInstruction, getCurrentTimeInfo } from './helpers/gemini-prompt.helper';

export interface ReceiptImageAnalysis {
  kind: 'ready' | 'missing_fields' | 'not_receipt';
  type?: 'income' | 'expense';
  amount?: number;
  category?: string;
  note?: string;
  occurredAt?: string;
  missingFields?: string[];
  summary: string;
}

export function buildReceiptAnalysisPrompt(
  ocrText: string,
  timeInfo: { nowText: string; nowIso: string },
): string {
  return `Phân tích text OCR do Tesseract trích xuất từ ảnh. Chỉ trả JSON hợp lệ, không Markdown.
=== NGỮ CẢNH THỜI GIAN ===
${timeInfo.nowText}
Mốc ISO-8601 hiện tại theo giờ Việt Nam là ${timeInfo.nowIso}. Chỉ dùng mốc này để diễn giải ngày tương đối được đọc chắc chắn trong OCR; không suy đoán ngày khi ảnh không thể hiện rõ.

Nếu text là hoá đơn, bill hoặc ảnh chụp giao dịch với đủ dữ liệu, trả:
{"kind":"ready","type":"income"|"expense","amount":số_VND_dương,"category":"...","note":"...","occurredAt":"ISO-8601 nếu đọc chắc chắn","summary":"..."}
Nếu là giao dịch nhưng thiếu loại hoặc số tiền, trả:
{"kind":"missing_fields","missingFields":["type"|"amount"],"summary":"..."}
Nếu text không phải giao dịch/hoá đơn, trả:
{"kind":"not_receipt","summary":"..."}
Không suy đoán số tiền, loại giao dịch hoặc ngày. amount luôn là VND đầy đủ.

TEXT OCR:
${ocrText}`;
}

export function parseReceiptImageAnalysis(raw: string): ReceiptImageAnalysis {
  const json = raw.trim().replace(/^```json\s*|\s*```$/g, '');
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return { kind: 'not_receipt', summary: 'Không đọc được thông tin giao dịch rõ ràng từ ảnh.' };
  }
  if (!value || typeof value !== 'object') {
    return { kind: 'not_receipt', summary: 'Không đọc được thông tin giao dịch rõ ràng từ ảnh.' };
  }
  const candidate = value as Record<string, unknown>;
  const summary = typeof candidate.summary === 'string' ? candidate.summary.trim() : '';
  const missingFields = Array.isArray(candidate.missingFields)
    ? candidate.missingFields.filter((field): field is string => typeof field === 'string')
    : [];
  const type =
    candidate.type === 'income' || candidate.type === 'expense' ? candidate.type : undefined;
  const amount =
    typeof candidate.amount === 'number' && candidate.amount > 0 ? candidate.amount : undefined;
  const note = typeof candidate.note === 'string' ? candidate.note.trim() : '';

  if (candidate.kind === 'ready' && type && amount && note) {
    return {
      kind: 'ready',
      type,
      amount,
      note,
      category: typeof candidate.category === 'string' ? candidate.category.trim() : undefined,
      occurredAt:
        typeof candidate.occurredAt === 'string' ? candidate.occurredAt.trim() : undefined,
      summary: summary || 'Đã đọc được một giao dịch từ ảnh.',
    };
  }
  if (candidate.kind === 'missing_fields') {
    return {
      kind: 'missing_fields',
      missingFields,
      summary: summary || 'Ảnh chưa đủ thông tin để ghi thu-chi.',
    };
  }
  return { kind: 'not_receipt', summary: summary || 'Ảnh không có giao dịch để ghi thu-chi.' };
}

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

  public async analyzeReceiptText(ocrText: string): Promise<ReceiptImageAnalysis> {
    if (!this.genAI) {
      return { kind: 'not_receipt', summary: 'Chưa cấu hình GEMINI_API_KEY.' };
    }
    const model = this.genAI.getGenerativeModel({ model: this.primaryModelName });
    const prompt = buildReceiptAnalysisPrompt(ocrText, this.getCurrentTimeInfo());
    const response = await model.generateContent(prompt);
    return parseReceiptImageAnalysis(response.response.text());
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
