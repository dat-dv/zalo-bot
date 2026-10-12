import { test } from 'node:test';
import assert from 'node:assert';
import sharp from 'sharp';
import { OcrService } from './ocr.service';

test('OcrService extracts text from an image buffer', async () => {
  const ocrService = new OcrService();

  // Create an image containing text using sharp
  const svg = `
    <svg width="400" height="200" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="white"/>
      <text x="20" y="50" font-family="Arial" font-size="28" fill="black">HIGHLANDS COFFEE</text>
      <text x="20" y="100" font-family="Arial" font-size="24" fill="black">Tong cong: 85,000 VND</text>
    </svg>
  `;

  const imageBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
  const text = await ocrService.extractTextFromBuffer(imageBuffer);

  assert.ok(typeof text === 'string');
  assert.ok(text.length > 0);
  assert.match(text, /85|000|HIGHLANDS|COFFEE/i);
});

test('OcrService handles empty or invalid buffer gracefully', async () => {
  const ocrService = new OcrService();
  const emptyBuffer = Buffer.from('');
  const text = await ocrService.extractTextFromBuffer(emptyBuffer);
  assert.strictEqual(typeof text, 'string');
});
