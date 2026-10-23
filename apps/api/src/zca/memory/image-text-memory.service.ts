import { Inject, Injectable, Logger } from '@nestjs/common';
import { fetchImageBuffer } from '../../common/utils/image-fetcher.util';
import { OcrService, type OcrResult } from '../../ocr/ocr.service';
import {
  SHORT_TERM_IMAGE_TEXT_MAX_CHARS,
  buildImageMemoryText,
  cleanOcrTextForMemory,
  toMemoryRecord,
  type MemoryChannelType,
  type MemorySourceMessage,
} from './chat-memory.mapper';
import { ChatMemoryService } from './chat-memory.service';
import { ShortTermMemoryService } from './short-term-memory.service';

/** Photos waiting to be read; a chat posting a big album beyond this loses the text of the rest. */
export const IMAGE_TEXT_QUEUE_MAX_PENDING = 20;

/** Results kept briefly so duplicates (self-listen echo) and the bot's own reply reuse them. */
const RESULT_CACHE_MAX = 50;
const RESULT_CACHE_TTL_MS = 10 * 60 * 1000;

export interface ImageTextJob {
  channelId: string;
  channelType: MemoryChannelType;
  /** The photo message as received: id, sender, caption. */
  data: MemorySourceMessage;
  imageUrl: string;
  /** The chat's `shortTermDays` when its short-term memory is on. */
  shortTermDays?: number;
  /** Whether the chat's long-term memory is on. */
  longTerm: boolean;
  /** Settles once the photo's long-term row is written, so the update finds it. */
  afterStored?: Promise<unknown>;
}

interface QueuedImage {
  key: string;
  msgId: string;
  /** The photo's memory text before reading it (`[Ảnh] caption`). */
  baseText: string;
  job: ImageTextJob;
}

/** The calls this service makes; structural types so tests can pass plain fakes. */
export type ImageTextOcr = Pick<OcrService, 'recognize'>;
export type ImageTextLongTermMemory = Pick<ChatMemoryService, 'attachImageText'>;
export type ImageTextShortTermMemory = Pick<ShortTermMemoryService, 'recordImageText'>;

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : JSON.stringify(err);
}

/**
 * Reads the text of photos posted in chats with chat memory on (local Tesseract OCR) and adds it
 * to the photo's entry in each memory the chat has on. Photos are read one at a time in the
 * background, because OCR is CPU-heavy; the queue is in-process and lost on restart. A photo that
 * addresses the bot is read at once through `recognizeNow`, so it is never read twice. Never throws.
 */
@Injectable()
export class ImageTextMemoryService {
  private readonly logger = new Logger(ImageTextMemoryService.name);
  private readonly queue: QueuedImage[] = [];
  /** `null` result: the photo could not be fetched, so a caller holding its bytes reads it itself. */
  private readonly running = new Map<string, Promise<OcrResult | null>>();
  private readonly results = new Map<string, { result: OcrResult; expiresAt: number }>();
  private draining = false;

  constructor(
    @Inject(OcrService) private readonly ocr: ImageTextOcr,
    @Inject(ChatMemoryService) private readonly longTermMemory: ImageTextLongTermMemory,
    @Inject(ShortTermMemoryService) private readonly shortTermMemory: ImageTextShortTermMemory,
  ) {}

  /** Queues a photo for reading; skipped when no memory is on, already known, or the queue is full. */
  public enqueue(job: ImageTextJob): void {
    if (!job.longTerm && job.shortTermDays === undefined) return;
    const record = toMemoryRecord(job.channelId, job.channelType, job.data);
    if (!record || !job.imageUrl) return;

    const key = `${job.channelId}:${record.msgId}`;
    if (this.isKnown(key)) return;
    if (this.queue.length >= IMAGE_TEXT_QUEUE_MAX_PENDING) {
      this.logger.warn(
        `[ImageTextMemory] Queue full (${IMAGE_TEXT_QUEUE_MAX_PENDING}); photo ${record.msgId} in ${job.channelId} is remembered without its text.`,
      );
      return;
    }
    this.queue.push({ key, msgId: record.msgId, baseText: record.text ?? '', job });
    void this.drain();
  }

  /**
   * The raw OCR text of a queued, running or just-read photo, read now with `buffer` if it is
   * still waiting. `null` when the photo is not handled here (the caller reads it itself).
   */
  public async recognizeNow(
    channelId: string,
    msgId: string | undefined,
    buffer: Buffer,
  ): Promise<string | null> {
    if (!channelId || !msgId) return null;
    const key = `${channelId}:${msgId}`;
    const cached = this.cachedResult(key);
    if (cached) return cached.text;
    const running = this.running.get(key);
    if (running !== undefined) return (await running)?.text ?? null;
    const index = this.queue.findIndex((item) => item.key === key);
    if (index < 0) return null;
    const [item] = this.queue.splice(index, 1);
    return (await this.run(item, buffer))?.text ?? null;
  }

  private async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      for (let item = this.queue.shift(); item; item = this.queue.shift()) {
        await this.run(item);
      }
    } finally {
      this.draining = false;
    }
  }

  private run(item: QueuedImage, buffer?: Buffer): Promise<OcrResult | null> {
    const existing = this.running.get(item.key);
    if (existing !== undefined) return existing;
    const reading = this.read(item, buffer).finally(() => this.running.delete(item.key));
    this.running.set(item.key, reading);
    return reading;
  }

  private async read(item: QueuedImage, buffer?: Buffer): Promise<OcrResult | null> {
    let result: OcrResult;
    try {
      const image = buffer ?? (await fetchImageBuffer(item.job.imageUrl));
      result = await this.ocr.recognize(image);
    } catch (err: unknown) {
      this.logger.warn(
        `[ImageTextMemory] Could not read photo ${item.msgId} in ${item.job.channelId}: ${errorMessage(err)}`,
      );
      return null;
    }
    this.rememberResult(item.key, result);
    await this.store(item, result);
    return result;
  }

  private async store(item: QueuedImage, result: OcrResult): Promise<void> {
    const imageText = cleanOcrTextForMemory(result.text, result.confidence);
    if (!imageText) return;
    const { job } = item;
    try {
      if (job.longTerm) {
        await job.afterStored?.catch((): void => undefined);
        await this.longTermMemory.attachImageText(
          job.channelId,
          item.msgId,
          buildImageMemoryText(item.baseText, imageText),
        );
      }
      if (job.shortTermDays !== undefined) {
        await this.shortTermMemory.recordImageText(
          job.channelId,
          job.data,
          buildImageMemoryText(item.baseText, imageText, SHORT_TERM_IMAGE_TEXT_MAX_CHARS),
          job.shortTermDays,
        );
      }
      this.logger.log(
        `[ImageTextMemory] Remembered ${imageText.length} chars of text from photo ${item.msgId} in ${job.channelId}`,
      );
    } catch (err: unknown) {
      this.logger.warn(
        `[ImageTextMemory] Could not store text of photo ${item.msgId} in ${job.channelId}: ${errorMessage(err)}`,
      );
    }
  }

  private isKnown(key: string): boolean {
    return (
      this.running.has(key) ||
      this.cachedResult(key) !== undefined ||
      this.queue.some((item) => item.key === key)
    );
  }

  private cachedResult(key: string): OcrResult | undefined {
    const cached = this.results.get(key);
    if (!cached) return undefined;
    if (cached.expiresAt <= Date.now()) {
      this.results.delete(key);
      return undefined;
    }
    return cached.result;
  }

  private rememberResult(key: string, result: OcrResult): void {
    this.results.delete(key);
    this.results.set(key, { result, expiresAt: Date.now() + RESULT_CACHE_TTL_MS });
    // Maps keep insertion order, so keys come oldest first.
    for (const oldest of this.results.keys()) {
      if (this.results.size <= RESULT_CACHE_MAX) break;
      this.results.delete(oldest);
    }
  }
}
