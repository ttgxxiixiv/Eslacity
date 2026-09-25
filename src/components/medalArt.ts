import type { LineId, Tier } from '../domain/medals';

/**
 * Рисунок медали 16×16 пикселей: лента, диск с ободом и значок линии.
 * Чистая функция без React, чтобы картинку можно было проверить тестом и снять скриншот.
 */

export type MedalIcon = LineId | 'secret' | 'hidden';

// o — обводка, R/r — лента и её тень, L — светлая сторона обода, E — тёмная, F — поле.
const BASE = [
  '....oo....oo....',
  '...oRRo..oRRo...',
  '....oRRooRRo....',
  '.....orRRro.....',
  '......oooo......',
  '....ooLLLLoo....',
  '...oLLLLLLLEo...',
  '...oLFFFFFFEo...',
  '..oLFFFFFFFFEo..',
  '..oLFFFFFFFFEo..',
  '..oLFFFFFFFFEo..',
  '..oLFFFFFFFFEo..',
  '...oEFFFFFFEo...',
  '...oEEFFFFEEo...',
  '....ooEEEEoo....',
  '......oooo......',
];

/** Значки линий 6×6, ставятся на поле медали с клетки (5, 7). */
const ICONS: Record<MedalIcon, string[]> = {
  // Словесник: облачко речи.
  words: ['XXXXXX', 'X....X', 'X.XX.X', 'X....X', 'XXXXXX', '.X....'],
  // Упорство: пламя.
  streak: ['..X...', '..XX..', '.XXX.X', '.XXXXX', 'XX.XXX', '.XXXX.'],
  // Знаток правил: буква A.
  grammar: ['..XX..', '.X..X.', '.X..X.', '.XXXX.', 'X....X', 'X....X'],
  // Картограф: роза ветров.
  cartographer: ['..XX..', '..XX..', 'XX..XX', 'XX..XX', '..XX..', '..XX..'],
  // Друг города: сердце.
  friend: ['.X..X.', 'XXXXXX', 'XXXXXX', '.XXXX.', '..XX..', '......'],
  // Посыльный: конверт.
  courier: ['XXXXXX', 'XX..XX', 'X.XX.X', 'X....X', 'XXXXXX', '......'],
  // Молния.
  blitz: ['...XX.', '..XX..', '.XXXX.', '..XX..', '.XX...', '.X....'],
  // Твёрдая рука: перо.
  typed: ['....XX', '...XXX', '..XXX.', '.XXX..', '.XX...', 'X.....'],
  // Строитель: дом.
  builder: ['..XX..', '.XXXX.', 'XXXXXX', '.X..X.', '.X..X.', '.XXXX.'],
  // Испытатель: меч.
  trials: ['....XX', '...XXX', 'X.XXX.', '.XXX..', '.XX...', 'X..X..'],
  // Слушатель: нота.
  listener: ['..XXXX', '..X..X', '..X..X', 'XXX.XX', 'XXX.XX', '......'],
  // Эхо: волны.
  echo: ['X..X..', '.X..X.', '..X..X', '..X..X', '.X..X.', 'X..X..'],
  // Полученная тайная медаль: звезда.
  secret: ['..XX..', '..XX..', 'XXXXXX', '.XXXX.', '.X..X.', 'X....X'],
  // Тайная медаль, которой ещё нет: знак вопроса.
  hidden: ['.XXXX.', 'X....X', '....X.', '...X..', '......', '...X..'],
};

interface Palette {
  L: string;
  F: string;
  E: string;
  /** Гравировка значка. */
  I: string;
  R: string;
  r: string;
}

const OUTLINE = '#1a120a';

export const PALETTES: Record<Tier | 'locked', Palette> = {
  wood: { L: '#a8733f', F: '#8a5a2b', E: '#5e3b1a', I: '#4a2d12', R: '#5d9b3a', r: '#3d6b24' },
  stone: { L: '#bdb8ae', F: '#8f8b84', E: '#5f5c57', I: '#3c3a37', R: '#6d7f8c', r: '#4b5862' },
  bronze: { L: '#e3a46a', F: '#b8733a', E: '#7a4520', I: '#552b10', R: '#b3261e', r: '#7a1a14' },
  silver: { L: '#f4f6f8', F: '#c3c9d1', E: '#7e8794', I: '#4f5763', R: '#2d5596', r: '#1d3a6b' },
  gold: { L: '#fff0a0', F: '#e0b43c', E: '#9c7414', I: '#6e5008', R: '#b3261e', r: '#7a1a14' },
  diamond: { L: '#e8fcff', F: '#7fd8f0', E: '#2f8fb5', I: '#1c5a7a', R: '#6a3fa0', r: '#472a6e' },
  // Неполученная ступень: тёмный силуэт, значок едва виден.
  locked: { L: '#3a2c1e', F: '#3a2c1e', E: '#3a2c1e', I: '#4d3b28', R: '#3a2c1e', r: '#3a2c1e' },
};

export interface Pixel {
  x: number;
  y: number;
  fill: string;
  /** Искра бриллианта: мерцает, если анимация разрешена. */
  sparkle?: boolean;
}

/** Точки поля, где рисуется фактура ступени. */
function texture(tier: Tier, x: number, y: number): string | null {
  switch (tier) {
    case 'wood':
      // Волокна дерева: прерывистые горизонтальные полосы.
      return (y === 9 && x % 4 !== 1) || (y === 11 && x % 4 !== 3) ? '#744a22' : null;
    case 'stone':
      // Крапинки камня.
      return (x * 7 + y * 5) % 11 === 0 ? '#6f6b65' : (x * 3 + y * 7) % 13 === 0 ? '#a6a29a' : null;
    case 'gold':
      // Блик в левом верхнем углу поля.
      return (x === 5 && y === 7) || (x === 4 && y === 8) || (x === 4 && y === 9) ? '#fffbe0' : null;
    case 'diamond':
      // Грани: светлые диагонали.
      return (x + y) % 4 === 0 ? '#b8eefa' : null;
    default:
      return null;
  }
}

/** Искры бриллианта поверх медали. */
const SPARKLES: [number, number][] = [[4, 6], [11, 10], [6, 13]];

/** Пиксели медали. tier null — ступень не получена, рисуется силуэт. */
export function medalPixels(icon: MedalIcon, tier: Tier | null): Pixel[] {
  const p = PALETTES[tier ?? 'locked'];
  const out: Pixel[] = [];
  const art = ICONS[icon];
  BASE.forEach((row, y) => {
    [...row].forEach((c, x) => {
      if (c === '.') return;
      if (c === 'o') return out.push({ x, y, fill: OUTLINE });
      const ix = x - 5;
      const iy = y - 7;
      if (c === 'F' && art[iy]?.[ix] === 'X') return out.push({ x, y, fill: p.I });
      const tex = c === 'F' && tier ? texture(tier, x, y) : null;
      out.push({ x, y, fill: tex ?? p[c as keyof Palette] });
    });
  });
  if (tier === 'diamond') for (const [x, y] of SPARKLES) out.push({ x, y, fill: '#ffffff', sparkle: true });
  return out;
}
