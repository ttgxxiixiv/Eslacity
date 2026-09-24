// Рисует иконки PWA без внешних зависимостей: оранжевый фон и силуэт города.
// Запуск: npx tsx scripts/make-icons.ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

type RGB = [number, number, number];
const BG: RGB = [0xc2, 0x41, 0x0c];
const FG: RGB = [0xff, 0xf7, 0xed];
const WIN: RGB = [0xf5, 0x9e, 0x0b];

// Здания в долях от стороны: [x, ширина, высота]. Всё лежит в безопасной зоне 80% для maskable.
const BUILDINGS: [number, number, number][] = [
  [0.2, 0.17, 0.3],
  [0.39, 0.22, 0.48],
  [0.63, 0.17, 0.36],
];
const GROUND = 0.76;

function draw(size: number, pad: number): Buffer {
  const px = Buffer.alloc(size * size * 3);
  const set = (x: number, y: number, c: RGB) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 3;
    px[i] = c[0];
    px[i + 1] = c[1];
    px[i + 2] = c[2];
  };
  const rect = (x0: number, y0: number, w: number, h: number, c: RGB) => {
    for (let y = Math.round(y0); y < Math.round(y0 + h); y++) for (let x = Math.round(x0); x < Math.round(x0 + w); x++) set(x, y, c);
  };
  rect(0, 0, size, size, BG);
  const s = size * (1 - 2 * pad);
  const o = size * pad;
  for (const [bx, bw, bh] of BUILDINGS) {
    const x = o + bx * s;
    const w = bw * s;
    const top = o + (GROUND - bh) * s;
    rect(x, top, w, bh * s, FG);
    // окна 2 × N
    const ww = w * 0.22;
    const gap = (w - 2 * ww) / 3;
    for (let wy = top + gap; wy + ww < o + GROUND * s - gap; wy += ww + gap) {
      rect(x + gap, wy, ww, ww, WIN);
      rect(x + 2 * gap + ww, wy, ww, ww, WIN);
    }
  }
  rect(o + 0.12 * s, o + GROUND * s, 0.76 * s, 0.035 * s, FG);
  return px;
}

function crc32(buf: Buffer): number {
  let c = ~0;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function png(size: number, rgb: Buffer): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) rgb.copy(raw, y * (size * 3 + 1) + 1, y * size * 3, (y + 1) * size * 3);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const out = join(import.meta.dirname, '..', 'public', 'icons');
mkdirSync(out, { recursive: true });
const icons: [string, number, number][] = [
  ['icon-192.png', 192, 0.04],
  ['icon-512.png', 512, 0.04],
  ['maskable-512.png', 512, 0.12],
  ['apple-touch-icon.png', 180, 0.08],
];
for (const [name, size, pad] of icons) {
  writeFileSync(join(out, name), png(size, draw(size, pad)));
  console.log('✓', name);
}
