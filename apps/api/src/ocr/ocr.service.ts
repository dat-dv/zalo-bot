import { Injectable, Logger } from '@nestjs/common';
import { createWorker } from 'tesseract.js';
import sharp from 'sharp';

/** OCR result; `confidence` is Tesseract's mean word confidence (0–100), 0 when nothing was read. */
export interface OcrResult {
  text: string;
  confidence: number;
}

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  /**
   * Trích xuất văn bản từ hình ảnh hóa đơn/chứng từ bằng Tesseract OCR
   * Có kết hợp Sharp để chuẩn hóa ảnh (xoay, tăng độ tương phản, grayscale)
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
        .grayscale()
        .normalize()
        .toBuffer();
    } catch (err) {
      this.logger.warn(
        `Pre-processing image with sharp failed, using raw buffer: ${(err as Error).message}`,
      );
    }

    let worker;
    try {
      worker = await createWorker(['vie', 'eng']);
      const ret = await worker.recognize(processedBuffer);
      const text = ret.data?.text || '';
      const confidence = Number.isFinite(ret.data?.confidence) ? ret.data.confidence : 0;
      this.logger.log(`Tesseract OCR extracted ${text.length} characters.`);
      return { text: text.trim(), confidence };
    } catch (err) {
      this.logger.error(`Tesseract OCR recognition error: ${(err as Error).message}`);
      return { text: '', confidence: 0 };
    } finally {
      if (worker) {
        await worker.terminate().catch(() => {});
      }
    }
  }
}
