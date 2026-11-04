import { after, test } from 'node:test';
import assert from 'node:assert';
import sharp from 'sharp';
import { OcrService } from './ocr.service';

// One service for every test: the Tesseract worker lives on between calls and is released once
// here, the way Nest's `onModuleDestroy` releases it in the app.
const ocrService = new OcrService();
after(() => ocrService.onModuleDestroy());

void test('OcrService extracts text from an image buffer', async () => {
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

void test('OcrService.recognize reports the confidence with the text', async () => {
  const svg = `
    <svg width="400" height="120" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="white"/>
      <text x="20" y="60" font-family="Arial" font-size="28" fill="black">MENU TRUA 45000</text>
    </svg>
  `;
  const imageBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
  const result = await ocrService.recognize(imageBuffer);

  assert.match(result.text, /MENU|TRUA|45000/i);
  assert.ok(result.confidence > 0 && result.confidence <= 100);
});

void test('OcrService.recognize reuses the worker and still reads a second, wider image', async () => {
  // Wider than the resize cap, so the pre-processing shrinks it before recognition.
  const svg = `
    <svg width="2400" height="300" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="white"/>
      <text x="40" y="180" font-family="Arial" font-size="120" fill="black">TONG 120000</text>
    </svg>
  `;
  const imageBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
  const result = await ocrService.recognize(imageBuffer);

  assert.match(result.text, /TONG|120000/i);
});

void test('OcrService.recognize returns empty text and zero confidence for an empty buffer', async () => {
  const result = await ocrService.recognize(Buffer.from(''));
  assert.deepStrictEqual(result, { text: '', confidence: 0 });
});

void test('OcrService handles empty or invalid buffer gracefully', async () => {
  const emptyBuffer = Buffer.from('');
  const text = await ocrService.extractTextFromBuffer(emptyBuffer);
  assert.strictEqual(typeof text, 'string');
});
