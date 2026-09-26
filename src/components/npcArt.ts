import type { NpcExtra, NpcLook } from '../content/schema';

/**
 * Портрет жителя 14×18 пикселей: фигура в полный рост по одному шаблону, вариации — кожа, причёска,
 * одежда и детали (фартук, очки, колпак…). Обводка считается по соседним клеткам, как у сердечек.
 */

export const NPC_W = 14;
export const NPC_H = 18;

const SKIN = ['', '#f3d2b3', '#e0ad84', '#b97c52', '#7a4a2c'];
const OUTLINE = '#1a120a';
const WHITE = '#fbf4de';

// Слои шаблона: каждая строка — 14 клеток, символ — что в клетке.
// S — кожа, O — одежда, P — брюки, B — обувь, e — глаза.
const BODY = [
  '..............',
  '..............',
  '..............',
  '.....SSSS.....',
  '....SSSSSS....',
  '....SeSSeS....',
  '....SSSSSS....',
  '.....SSSS.....',
  '......SS......',
  '...OOOOOOOO...',
  '..OOOOOOOOOO..',
  '..SOOOOOOOOS..',
  '..SOOOOOOOOS..',
  '...OOOOOOOO...',
  '...PPP..PPP...',
  '...PPP..PPP...',
  '...BBB..BBB...',
  '..............',
];

// Причёски: H — волосы. Рисуются поверх кожи головы.
const HAIR: Record<NpcLook['style'], string[]> = {
  short: ['', '', '.....HHHH.....', '....HHHHHH....', '....H....H....'],
  long: ['', '', '.....HHHH.....', '....HHHHHH....', '...HH....HH...', '...H......H...', '...H......H...', '...H......H...', '...HH....HH...'],
  bun: ['', '......HH......', '.....HHHH.....', '....HHHHHH....', '....H....H....'],
  curly: ['', '', '....HHHHHH....', '...HHHHHHHH...', '...HH....HH...', '...H......H...'],
  bald: ['', '', '', '....H....H....', '....H....H....'],
};

// Детали: символ — цвет (W белый, D тёмный, L стекло очков, G золото, R красный, H цвет волос, K серый, O тень одежды).
const EXTRA: Record<NpcExtra, string[]> = {
  apron: ['', '', '', '', '', '', '', '', '', '.....W..W.....', '.....WWWW.....', '....WWWWWW....', '....WWWWWW....', '....WWWWWW....'],
  glasses: ['', '', '', '', '', '....DLDDLD....'],
  headphones: ['', '', '', '....DDDDDD....', '...D......D...', '...D......D...'],
  chefhat: ['....WWWWWW....', '....WWWWWW....', '.....WWWW.....', '....WWWWWW....'],
  mustache: ['', '', '', '', '', '', '.....HHHH.....'],
  beard: ['', '', '', '', '', '', '....HHHHHH....', '....HHHHHH....', '.....HHHH.....'],
  cap: ['', '', '.....OOOO.....', '....OOOOOO....', '....OOOOOOO...'],
  tie: ['', '', '', '', '', '', '', '', '', '......RR......', '......RR......', '......RR......', '.......R......'],
  headband: ['', '', '', '', '....RRRRRR....'],
  badge: ['', '', '', '', '', '', '', '', '', '', '...G..........'],
  stethoscope: ['', '', '', '', '', '', '', '', '', '....K....K....', '....K....K....', '.....K..K.....', '......KK......'],
};

export interface NpcPixel {
  x: number;
  y: number;
  fill: string;
}

/** Слегка затемнить цвет: тени на одежде и козырьке. */
function shade(hex: string, k = 0.75): string {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v * k));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/** Пиксели портрета: сначала тело, потом причёска, потом детали; вокруг заливки — обводка. */
export function npcPixels(look: NpcLook): NpcPixel[] {
  const grid: (string | null)[][] = Array.from({ length: NPC_H }, () => Array<string | null>(NPC_W).fill(null));
  const put = (rows: string[], color: (c: string) => string | null) =>
    rows.forEach((row, y) => [...row].forEach((c, x) => {
      if (c === '.' || !row) return;
      const v = color(c);
      if (v) grid[y][x] = v;
    }));

  put(BODY, (c) => ({ S: SKIN[look.skin], O: look.outfit, P: look.pants, B: '#2e2216', e: OUTLINE })[c] ?? null);
  // Тень на одежде снизу, чтобы фигура не была плоской.
  for (let x = 0; x < NPC_W; x++) if (grid[13][x] === look.outfit) grid[13][x] = shade(look.outfit);
  put(HAIR[look.style], () => look.hair);
  for (const e of look.extra) {
    put(EXTRA[e], (c) => ({ W: WHITE, D: '#2e2216', L: '#cfe8f0', G: '#e0b43c', R: '#b3261e', H: look.hair, K: '#8f8b84', O: shade(look.outfit) })[c] ?? null);
  }

  const out: NpcPixel[] = [];
  const filled = (x: number, y: number) => grid[y]?.[x] != null;
  for (let y = 0; y < NPC_H; y++) {
    for (let x = 0; x < NPC_W; x++) {
      const v = grid[y][x];
      if (v) out.push({ x, y, fill: v });
      else if (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1)) out.push({ x, y, fill: OUTLINE });
    }
  }
  return out;
}
