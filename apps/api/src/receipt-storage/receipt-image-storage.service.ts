import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';

const MAX_IMAGE_EDGE = 2048;
const JPEG_QUALITY = 82;
const RECEIPT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class ReceiptImageStorageService {
  private readonly storageDir: string;

  constructor(config: ConfigService) {
    this.storageDir = resolve(config.getOrThrow<string>('receiptStorage.dir'));
  }

  public async store(userId: number | string, image: Buffer): Promise<string> {
    const receiptId = randomUUID();
    const directory = this.userDirectory(userId);
    const destination = join(directory, `${receiptId}.jpg`);
    const temporary = `${destination}.tmp`;

    await mkdir(directory, { recursive: true });
    try {
      const compressed = await sharp(image, { failOn: 'error', limitInputPixels: 40_000_000 })
        .rotate()
        .resize({
          width: MAX_IMAGE_EDGE,
          height: MAX_IMAGE_EDGE,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: JPEG_QUALITY, progressive: true, mozjpeg: true })
        .toBuffer();
      await writeFile(temporary, compressed, { flag: 'wx' });
      await rename(temporary, destination);
      return `/api/receipts/${receiptId}`;
    } catch (error) {
      await rm(temporary, { force: true }).catch((): void => undefined);
      throw error;
    }
  }

  public async read(userId: number | string, receiptUrl: string): Promise<Buffer> {
    const receiptId = this.receiptIdFromUrl(receiptUrl);
    try {
      return await readFile(join(this.userDirectory(userId), `${receiptId}.jpg`));
    } catch {
      throw new NotFoundException('Không tìm thấy ảnh hóa đơn.');
    }
  }

  public async remove(userId: number | string, receiptUrl: unknown): Promise<void> {
    if (typeof receiptUrl !== 'string') return;
    const receiptId = this.receiptIdFromUrl(receiptUrl, false);
    if (!receiptId) return;
    await rm(join(this.userDirectory(userId), `${receiptId}.jpg`), { force: true });
  }

  private userDirectory(userId: number | string): string {
    return join(this.storageDir, String(userId));
  }

  private receiptIdFromUrl(value: string, required = true): string | undefined {
    const receiptId = value.match(/^\/api\/receipts\/([0-9a-f-]+)$/i)?.[1];
    if (receiptId && RECEIPT_ID.test(receiptId)) return receiptId;
    if (required) throw new NotFoundException('Đường dẫn ảnh hóa đơn không hợp lệ.');
    return undefined;
  }
}
