import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

function createCrc32Table() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      if (c & 1) c = 0xedb88320 ^ (c >>> 1);
      else c = c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
}

const CRC_TABLE = createCrc32Table();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writePngChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(8 + len + 4);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4, 4, 'ascii');
  data.copy(buf, 8);
  const typeAndData = buf.subarray(4, 8 + len);
  buf.writeUInt32BE(crc32(typeAndData), 8 + len);
  return buf;
}

function encodePng(width, height, rgbaBuffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdrChunk = writePngChunk('IHDR', ihdrData);

  // Scanlines with filter byte 0
  const rowStride = width * 4;
  const rawScanlines = Buffer.alloc((rowStride + 1) * height);
  for (let y = 0; y < height; y++) {
    rawScanlines[y * (rowStride + 1)] = 0; // None filter
    rgbaBuffer.copy(rawScanlines, y * (rowStride + 1) + 1, y * rowStride, (y + 1) * rowStride);
  }

  const idatCompressed = zlib.deflateSync(rawScanlines, { level: 9 });
  const idatChunk = writePngChunk('IDAT', idatCompressed);
  const iendChunk = writePngChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function encodeIco(pngBuffers) {
  // ICO header: 6 bytes
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type 1 = ICO
  header.writeUInt16LE(pngBuffers.length, 4); // number of images

  let offset = 6 + pngBuffers.length * 16;
  const dirEntries = [];
  const imageBodies = [];

  for (const { width, height, buffer } of pngBuffers) {
    const entry = Buffer.alloc(16);
    entry[0] = width >= 256 ? 0 : width;
    entry[1] = height >= 256 ? 0 : height;
    entry[2] = 0; // color palette
    entry[3] = 0; // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bpp
    entry.writeUInt32LE(buffer.length, 8); // image size
    entry.writeUInt32LE(offset, 12); // image offset
    dirEntries.push(entry);
    imageBodies.push(buffer);
    offset += buffer.length;
  }

  return Buffer.concat([header, ...dirEntries, ...imageBodies]);
}

// Color blending helpers
function setPixel(buf, width, x, y, r, g, b, a = 255) {
  if (x < 0 || x >= width || y < 0 || y >= buf.length / (width * 4)) return;
  const idx = (Math.floor(y) * width + Math.floor(x)) * 4;
  if (a === 255) {
    buf[idx] = r;
    buf[idx + 1] = g;
    buf[idx + 2] = b;
    buf[idx + 3] = 255;
  } else {
    const alpha = a / 255;
    const bgA = buf[idx + 3] / 255;
    const outA = alpha + bgA * (1 - alpha);
    if (outA > 0) {
      buf[idx] = Math.round((r * alpha + buf[idx] * bgA * (1 - alpha)) / outA);
      buf[idx + 1] = Math.round((g * alpha + buf[idx + 1] * bgA * (1 - alpha)) / outA);
      buf[idx + 2] = Math.round((b * alpha + buf[idx + 2] * bgA * (1 - alpha)) / outA);
      buf[idx + 3] = Math.round(outA * 255);
    }
  }
}

function generateIconBuffer(size) {
  const buf = Buffer.alloc(size * size * 4);
  const cornerRadius = size * 0.22;
  const padding = size * 0.04;
  const innerSize = size - padding * 2;

  // Render background gradient with rounded corners
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const rx = Math.max(0, Math.max(padding + cornerRadius - x, x - (size - padding - cornerRadius)));
      const ry = Math.max(0, Math.max(padding + cornerRadius - y, y - (size - padding - cornerRadius)));
      const dist = Math.sqrt(rx * rx + ry * ry);

      if (dist <= cornerRadius) {
        const t = (x + y) / (size * 2);
        // Slate gradient from #0f172a to #1e293b to #090d16
        const r = Math.round(15 * (1 - t) + 30 * t);
        const g = Math.round(23 * (1 - t) + 41 * t);
        const b = Math.round(42 * (1 - t) + 59 * t);

        // Anti-aliased border
        const aaAlpha = dist > cornerRadius - 1 ? Math.max(0, Math.min(1, cornerRadius - dist)) : 1;
        setPixel(buf, size, x, y, r, g, b, Math.round(aaAlpha * 255));
      }
    }
  }

  // Draw sleek letter 'T' and bot accent
  const tTop = size * 0.26;
  const tHeight = size * 0.48;
  const tBarThickness = size * 0.12;
  const tStemWidth = size * 0.14;
  const tWidth = size * 0.52;
  const tLeft = (size - tWidth) / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const inTopBar = y >= tTop && y <= tTop + tBarThickness && x >= tLeft && x <= tLeft + tWidth;
      const stemLeft = (size - tStemWidth) / 2;
      const inStem = y >= tTop && y <= tTop + tHeight && x >= stemLeft && x <= stemLeft + tStemWidth;

      if (inTopBar || inStem) {
        const ratio = (x - tLeft) / tWidth;
        // Cyan-to-Cobalt gradient: #38bdf8 to #2563eb
        const r = Math.round(56 * (1 - ratio) + 37 * ratio);
        const g = Math.round(189 * (1 - ratio) + 99 * ratio);
        const b = Math.round(248 * (1 - ratio) + 235 * ratio);
        setPixel(buf, size, x, y, r, g, b, 255);
      }
    }
  }

  // Top-right indicator dot (zalo Cyan Accent)
  const dotX = tLeft + tWidth + size * 0.02;
  const dotY = tTop - size * 0.02;
  const dotRadius = size * 0.055;
  for (let y = Math.floor(dotY - dotRadius - 1); y <= Math.ceil(dotY + dotRadius + 1); y++) {
    for (let x = Math.floor(dotX - dotRadius - 1); x <= Math.ceil(dotX + dotRadius + 1); x++) {
      const d = Math.hypot(x - dotX, y - dotY);
      if (d <= dotRadius) {
        setPixel(buf, size, x, y, 56, 189, 248, 255);
      } else if (d <= dotRadius + 1) {
        const a = Math.max(0, 1 - (d - dotRadius));
        setPixel(buf, size, x, y, 56, 189, 248, Math.round(a * 255));
      }
    }
  }

  return encodePng(size, size, buf);
}

function generateOgImageBuffer(w = 1200, h = 630) {
  const buf = Buffer.alloc(w * h * 4);

  // Deep dark navy / slate mesh background
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const distTopLeft = Math.hypot(x - 200, y - 150) / 700;
      const distBottomRight = Math.hypot(x - 1000, y - 500) / 800;

      let r = 9;
      let g = 13;
      let b = 22;

      // Top-left blue ambient glow
      if (distTopLeft < 1) {
        const intensity = (1 - distTopLeft) * 0.35;
        r += Math.round(37 * intensity);
        g += Math.round(99 * intensity);
        b += Math.round(235 * intensity);
      }

      // Bottom-right cyan ambient glow
      if (distBottomRight < 1) {
        const intensity = (1 - distBottomRight) * 0.25;
        r += Math.round(6 * intensity);
        g += Math.round(182 * intensity);
        b += Math.round(212 * intensity);
      }

      // Grid line dots
      if ((x % 40 === 0 || y % 40 === 0) && Math.random() < 0.02) {
        r = Math.min(255, r + 15);
        g = Math.min(255, g + 20);
        b = Math.min(255, b + 30);
      }

      setPixel(buf, w, x, y, Math.min(255, r), Math.min(255, g), Math.min(255, b), 255);
    }
  }

  // Draw card mockups on the right side
  const cardX = 660;
  const cardY = 80;
  const cardW = 460;
  const cardH = 470;
  const cardRadius = 16;

  for (let y = cardY; y < cardY + cardH; y++) {
    for (let x = cardX; x < cardX + cardW; x++) {
      const rx = Math.max(0, Math.max(cardX + cardRadius - x, x - (cardX + cardW - cardRadius)));
      const ry = Math.max(0, Math.max(cardY + cardRadius - y, y - (cardY + cardH - cardRadius)));
      const dist = Math.sqrt(rx * rx + ry * ry);

      if (dist <= cardRadius) {
        // Inner card body
        setPixel(buf, w, x, y, 15, 23, 42, 235);
        // Border
        if (dist >= cardRadius - 1.5 || x === cardX || x === cardX + cardW - 1 || y === cardY || y === cardY + cardH - 1) {
          setPixel(buf, w, x, y, 51, 65, 85, 255);
        }
      }
    }
  }

  // Draw card top bar
  for (let y = cardY; y < cardY + 50; y++) {
    for (let x = cardX; x < cardX + cardW; x++) {
      const rx = Math.max(0, Math.max(cardX + cardRadius - x, x - (cardX + cardW - cardRadius)));
      const ry = Math.max(0, Math.max(cardY + cardRadius - y, y - (cardY + cardH - cardRadius)));
      if (Math.sqrt(rx * rx + ry * ry) <= cardRadius) {
        setPixel(buf, w, x, y, 30, 41, 59, 240);
      }
    }
  }

  // Window control dots
  const dots = [
    { x: cardX + 26, y: cardY + 25, r: 239, g: 68, b: 68 },
    { x: cardX + 44, y: cardY + 25, r: 245, g: 158, b: 11 },
    { x: cardX + 62, y: cardY + 25, r: 16, g: 185, b: 129 },
  ];
  for (const dot of dots) {
    for (let dy = -5; dy <= 5; dy++) {
      for (let dx = -5; dx <= 5; dx++) {
        if (Math.hypot(dx, dy) <= 5) {
          setPixel(buf, w, dot.x + dx, dot.y + dy, dot.r, dot.g, dot.b, 255);
        }
      }
    }
  }

  // Inner KPI container 1: Số dư
  const kpi1X = cardX + 24;
  const kpi1Y = cardY + 70;
  const kpi1W = cardW - 48;
  const kpi1H = 80;
  for (let y = kpi1Y; y < kpi1Y + kpi1H; y++) {
    for (let x = kpi1X; x < kpi1X + kpi1W; x++) {
      setPixel(buf, w, x, y, 9, 13, 22, 255);
      if (x === kpi1X || x === kpi1X + kpi1W - 1 || y === kpi1Y || y === kpi1Y + kpi1H - 1) {
        setPixel(buf, w, x, y, 30, 41, 59, 255);
      }
    }
  }

  // Draw logo icon on left
  const logoSize = 72;
  const logoX = 90;
  const logoY = 140;
  const logoIconBuf = generateIconBuffer(logoSize);
  // (We can draw the logo box)
  for (let y = logoY; y < logoY + logoSize; y++) {
    for (let x = logoX; x < logoX + logoSize; x++) {
      const rx = Math.max(0, Math.max(logoX + 16 - x, x - (logoX + logoSize - 16)));
      const ry = Math.max(0, Math.max(logoY + 16 - y, y - (logoY + logoSize - 16)));
      if (Math.hypot(rx, ry) <= 16) {
        const ratio = (x - logoX) / logoSize;
        const r = Math.round(56 * (1 - ratio) + 37 * ratio);
        const g = Math.round(189 * (1 - ratio) + 99 * ratio);
        const b = Math.round(248 * (1 - ratio) + 235 * ratio);
        setPixel(buf, w, x, y, r, g, b, 255);

        // Letter T in logo
        const lx = x - logoX;
        const ly = y - logoY;
        const inBar = ly >= 20 && ly <= 30 && lx >= 18 && lx <= 54;
        const inStem = ly >= 20 && ly <= 54 && lx >= 31 && lx <= 41;
        if (inBar || inStem) {
          setPixel(buf, w, x, y, 255, 255, 255, 255);
        }
      }
    }
  }

  return encodePng(w, h, buf);
}

// Generate all files
const publicDir = path.resolve(process.cwd(), 'apps/web/public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

console.log('Generating PNG and ICO assets...');
const png16 = generateIconBuffer(16);
const png32 = generateIconBuffer(32);
const png48 = generateIconBuffer(48);
const png180 = generateIconBuffer(180);
const png192 = generateIconBuffer(192);
const png512 = generateIconBuffer(512);
const ogPng = generateOgImageBuffer(1200, 630);

fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), png180);
fs.writeFileSync(path.join(publicDir, 'icon-192.png'), png192);
fs.writeFileSync(path.join(publicDir, 'icon-512.png'), png512);
fs.writeFileSync(path.join(publicDir, 'og-image.png'), ogPng);

const icoBuf = encodeIco([
  { width: 16, height: 16, buffer: png16 },
  { width: 32, height: 32, buffer: png32 },
  { width: 48, height: 48, buffer: png48 },
]);
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), icoBuf);

console.log('Assets created successfully in apps/web/public!');
