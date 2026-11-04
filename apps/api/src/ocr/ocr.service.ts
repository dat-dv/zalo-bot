import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { createWorker, type Worker, type WorkerOptions } from 'tesseract.js';
import sharp from 'sharp';

/** OCR result; `confidence` is Tesseract's mean word confidence (0–100), 0 when nothing was read. */
export interface OcrResult {
  text: string;
  confidence: number;
}

const LANGUAGES = ['vie', 'eng'];
/** A bill is readable at this width; larger photos only make recognition slower. */
const MAX_IMAGE_WIDTH = 2000;
/** A recognition still running after this is abandoned and the worker replaced. */
const RECOGNIZE_TIMEOUT_MS = 60_000;
/** The worker (WASM core plus language data in memory) is released after this much idle time. */
const IDLE_TIMEOUT_MS = 10 * 60_000;

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : JSON.stringify(err);
}

/**
 * Language data location. The Docker image bakes `vie`/`eng` into `OCR_TESSDATA_DIR`; without it
 * tesseract.js downloads the files once into its cache directory (the working directory).
 */
function workerOptions(): Partial<WorkerOptions> {
  const dir = process.env.OCR_TESSDATA_DIR?.trim();
  return dir ? { langPath: dir, cachePath: dir, gzip: false } : {};
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`OCR quá ${ms / 1000}s, bỏ qua ảnh.`)), ms);
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

@Injectable()
export class OcrService implements OnModuleDestroy {
  private readonly logger = new Logger(OcrService.name);
  // One long-lived worker: starting the WASM core and loading the language data costs seconds,
  // which used to be paid for every image. Tesseract runs concurrent `recognize` calls in turn.
  private worker: Promise<Worker> | null = null;
  private idleTimer: NodeJS.Timeout | null = null;

  public async onModuleDestroy(): Promise<void> {
    await this.disposeWorker();
  }

  /**
   * Trích xuất văn bản từ hình ảnh hóa đơn/chứng từ bằng Tesseract OCR
   * Có kết hợp Sharp để chuẩn hóa ảnh (xoay, thu nhỏ, tăng độ tương phản, grayscale)
   */
  public async extractTextFromBuffer(imageBuffer: Buffer): Promise<string> {
    return (await this.recognize(imageBuffer)).text;
  }

  /** Same as `extractTextFromBuffer`, plus the confidence so callers can drop noise from photos. */
  public async recognize(imageBuffer: Buffer): Promise<OcrResult> {
    if (!imageBuffer || imageBuffer.length === 0) {
      return { text: '', confidence: 0 };
    }

    let processedBuffer = imageBuffer;

    try {
      processedBuffer = await sharp(imageBuffer, { failOn: 'none' })
        .rotate()
        .resize({ width: MAX_IMAGE_WIDTH, withoutEnlargement: true })
        .grayscale()
        .normalize()
        .toBuffer();
    } catch (err: unknown) {
      this.logger.warn(
        `Pre-processing image with sharp failed, using raw buffer: ${errorText(err)}`,
      );
    }

    this.clearIdleTimer();
    try {
      const worker = await this.getWorker();
      const ret = await withTimeout(worker.recognize(processedBuffer), RECOGNIZE_TIMEOUT_MS);
      const text = ret.data?.text || '';
      const confidence = Number.isFinite(ret.data?.confidence) ? ret.data.confidence : 0;
      this.logger.log(`Tesseract OCR extracted ${text.length} characters.`);
      return { text: text.trim(), confidence };
    } catch (err: unknown) {
      this.logger.error(`Tesseract OCR recognition error: ${errorText(err)}`);
      // A failed or stuck worker is thrown away; the next image starts a fresh one.
      await this.disposeWorker();
      return { text: '', confidence: 0 };
    } finally {
      this.scheduleIdleRelease();
    }
  }

  private getWorker(): Promise<Worker> {
    if (this.worker === null) {
      const starting = createWorker(LANGUAGES, undefined, workerOptions());
      this.worker = starting;
      starting.catch(() => {
        if (this.worker === starting) this.worker = null;
      });
    }
    return this.worker;
  }

  private async disposeWorker(): Promise<void> {
    this.clearIdleTimer();
    const pending = this.worker;
    this.worker = null;
    if (pending === null) return;
    try {
      const worker = await pending;
      await worker.terminate();
    } catch {
      // The worker never started or is already gone.
    }
  }

  private scheduleIdleRelease(): void {
    this.clearIdleTimer();
    if (this.worker === null) return;
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null;
      void this.disposeWorker();
    }, IDLE_TIMEOUT_MS);
    this.idleTimer.unref();
  }

  private clearIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }
}
