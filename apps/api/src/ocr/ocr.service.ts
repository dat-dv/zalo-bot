import { Injectable, Logger } from '@nestjs/common';
import { createWorker } from 'tesseract.js';
import sharp from 'sharp';

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  /**
   * Trích xuất văn bản từ hình ảnh hóa đơn/chứng từ bằng Tesseract OCR
   * Có kết hợp Sharp để chuẩn hóa ảnh (xoay, tăng độ tương phản, grayscale)
   */
  public async extractTextFromBuffer(imageBuffer: Buffer): Promise<string> {
    if (!imageBuffer || imageBuffer.length === 0) {
      return '';
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
      this.logger.log(`Tesseract OCR extracted ${text.length} characters.`);
      return text.trim();
    } catch (err) {
      this.logger.error(`Tesseract OCR recognition error: ${(err as Error).message}`);
      return '';
    } finally {
      if (worker) {
        await worker.terminate().catch(() => {});
      }
    }
  }
}
