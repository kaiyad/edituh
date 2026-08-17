import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "icons");
mkdirSync(outDir, { recursive: true });

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function gradientPixel(x, y, size) {
  const t = (x + y) / (2 * size);
  const r = Math.round(0x11 + (0x4f - 0x11) * t);
  const g = Math.round(0x1a + (0x8b - 0x1a) * t);
  const b = Math.round(0x2f + (0xf9 - 0x2f) * t);
  return [r, g, b, 255];
}

function makePng(size, draw) {
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = draw(x, y, size);
      const o = y * stride + 1 + x * 4;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
      raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// Simple bitmap font for a bold "E" glyph on a 5x7 grid (scaled).
const E = [
  "11111",
  "10000",
  "10000",
  "11110",
  "10000",
  "10000",
  "11111",
];

function letter(x, y, size) {
  const cell = size / 9;
  const gx = Math.floor((x - size * 0.26) / cell);
  const gy = Math.floor((y - size * 0.22) / cell);
  if (gx < 0 || gx > 4 || gy < 0 || gy > 6) return false;
  return E[gy][gx] === "1";
}

function antialias(pixel, x, y, size) {
  const samples = [
    [0, 0], [0.5, 0], [0, 0.5], [0.5, 0.5],
    [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75],
  ];
  let on = 0;
  for (const [dx, dy] of samples) {
    if (letter(x + dx, y + dy, size)) on++;
  }
  return on / samples.length;
}

function iconDraw(x, y, size, maskable) {
  const pad = maskable ? size * 0.1 : 0;
  if (letter(x, y, size)) {
    const alpha = antialias(letter, x, y, size);
    return [255, 255, 255, Math.round(255 * alpha)];
  }
  // rounded-rect corner alpha for non-maskable icons
  if (!maskable) {
    const r = size * 0.18;
    const cx = Math.min(Math.max(x, r), size - r);
    const cy = Math.min(Math.max(y, r), size - r);
    const d = Math.hypot(x - cx, y - cy);
    if (d > r) return [0, 0, 0, 0];
  }
  const t = (x + y) / (2 * size);
  const r = Math.round((0x2e + (0x4f - 0x2e) * t) * 255) / 255;
  const g = Math.round((0x34 + (0x8b - 0x34) * t) * 255) / 255;
  const b = Math.round((0x40 + (0xf9 - 0x40) * t) * 255) / 255;
  return [Math.round(r), Math.round(g), Math.round(b), 255];
}

const icons = [
  ["icon-192.png", 192, false],
  ["icon-512.png", 512, false],
  ["icon-512-maskable.png", 512, true],
  ["apple-touch-icon.png", 180, false],
];

for (const [name, size, maskable] of icons) {
  writeFileSync(
    join(outDir, name),
    makePng(size, (x, y) => iconDraw(x, y, size, maskable))
  );
  console.log(`generated ${name}`);
}

writeFileSync(
  join(outDir, "mask-icon.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="96" fill="#4f8bf9"/><path d="M150 120h212v44h-158v56h138v44H204v56h172v44H150z" fill="#fff"/></svg>`
);
console.log("generated mask-icon.svg");