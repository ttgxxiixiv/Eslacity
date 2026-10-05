import type { DecorKind } from '../domain/decor';

/**
 * Украшения карты города пиксельной картинкой, как путник (`Hero.tsx`): строки — пиксели, буква — цвет.
 * `C` — цвет украшения (полотнище флага, огонь фонаря, цветы, вода), `D` — он же темнее.
 */
const ART: Record<DecorKind, string[]> = {
  flag: [
    '.Y........',
    'YPY.......',
    '.PCCCCCCC.',
    '.PCCCCCCCC',
    '.PCDCCCCDC',
    '.PCCCCCCCC',
    '.PCCCCCCC.',
    '.PCCC.CCC.',
    '.PCC...CC.',
    '.P........',
    '.P........',
    '.P........',
    '.P........',
    '.P........',
    'SSS.......',
    'SSS.......',
  ],
  lamp: [
    '...K...',
    '..KKK..',
    '.KLLLK.',
    '.KLCLK.',
    '.KLCLK.',
    '.KLLLK.',
    '..KKK..',
    '...K...',
    '...K...',
    '...K...',
    '...K...',
    '...K...',
    '...K...',
    '..KKK..',
    '.SSSSS.',
    '.SSSSS.',
  ],
  flowers: [
    '...C....C....C..',
    '..CwC..CwC..CwC.',
    '...C.g..C.g..C..',
    '..gg.ggg.gg.ggg.',
    '.SBBBBBBBBBBBBS.',
    'SBBBBBBBBBBBBBBS',
    '.SSSSSSSSSSSSSS.',
  ],
  well: [
    '...RRRRRRRR...',
    '..RRRRRRRRRR..',
    '.RRRRRRRRRRRR.',
    '...P......P...',
    '...P...K..P...',
    '...P...K..P...',
    '...P..KBK.P...',
    '.SSSSSSSSSSSS.',
    'SSCCCCCCCCCCSS',
    'SSDCDCCDCCDCSS',
    '.SSSSSSSSSSSS.',
    '..SSSSSSSSSS..',
  ],
};

/** Цвет темнее на долю `k`: тени полотнища и ряби воды. */
function darker(hex: string, k = 0.3): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (s: number) => Math.round(((n >> s) & 255) * (1 - k));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

const BASE: Record<string, string> = {
  Y: '#ffd24a',
  P: '#4a2e18',
  S: '#8a8278',
  K: '#2a2420',
  L: '#fff2c4',
  w: '#fff8e6',
  g: '#3f7a2e',
  B: '#5a3a20',
  R: '#7a4a26',
};

/** Размер картинки украшения в пикселях-клетках. */
export const decorSize = (kind: DecorKind) => ({ w: ART[kind][0].length, h: ART[kind].length });

export function DecorArt({ kind, color, cell = 1.6 }: { kind: DecorKind; color: string; cell?: number }) {
  const rows = ART[kind];
  const { w, h } = decorSize(kind);
  const colors: Record<string, string> = { ...BASE, C: color, D: darker(color) };
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w * cell} height={h * cell} shapeRendering="crispEdges" aria-hidden className="block">
      <ellipse cx={w / 2} cy={h - 0.3} rx={w / 2.2} ry={0.8} fill="rgba(0,0,0,0.25)" />
      {rows.flatMap((row, y) =>
        [...row].map((ch, x) => (colors[ch] ? <rect key={`${x}.${y}`} x={x} y={y} width="1" height="1" fill={colors[ch]} /> : null)),
      )}
    </svg>
  );
}
