// Путник из нижнего меню в миниатюре 12×16: капюшон, тёмное лицо, коричневый плащ и фонарь.
// Два кадра ходьбы отличаются только ногами; кадры переключаются через opacity.
const BODY = [
  '....KKKK....',
  '...KCCCCK...',
  '..KCCCCCCK..',
  '..KCFFFFCK..',
  '..KCFFFFCK..',
  '..KCcFFcCK..',
  '.KCCCccCCCK.',
  '.KCcCCCCcCK.',
  'KCCcCCCCcCKK',
  'KCCcCCCCcCKY',
  'KCCcCCCCcCKY',
  '.KCcCCCCcCK.',
  '.KCcCCCCcCK.',
  '.KCCCCCCCCK.',
];
const LEGS_A = ['..KBK..KBK..', '..KK....KK..'];
const LEGS_B = ['...KBKKBK...', '...KK..KK...'];

const COLORS: Record<string, string> = {
  K: '#1f140c',
  C: '#7a4a26',
  c: '#5a3418',
  F: '#1a120c',
  B: '#3a2616',
  Y: '#ffcc4a',
};

function cells(rows: string[], y0: number) {
  const out: { x: number; y: number; c: string; ch: string }[] = [];
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (COLORS[ch]) out.push({ x, y: y + y0, c: COLORS[ch], ch });
    });
  });
  return out;
}

const BODY_CELLS = cells(BODY, 0);
const A_CELLS = cells(LEGS_A, BODY.length);
const B_CELLS = cells(LEGS_B, BODY.length);

/** Огонь фонаря (`Y`) — цвета выбранного фонаря путника (`LANTERNS` в `src/domain/decor.ts`). */
const rects = (list: { x: number; y: number; c: string; ch: string }[], flame?: string) =>
  list.map(({ x, y, c, ch }) => <rect key={`${x}.${y}`} x={x} y={y} width="1" height="1" fill={ch === 'Y' && flame ? flame : c} />);

export function HeroSprite({ walking, flame, glow }: { walking: boolean; flame?: string; glow?: string }) {
  return (
    <svg viewBox="0 0 12 16" width="24" height="32" shapeRendering="crispEdges" aria-hidden className="block overflow-visible" data-flame={flame}>
      <ellipse cx="6" cy="15.6" rx="4.5" ry="0.9" fill="rgba(0,0,0,0.25)" />
      <g className={walking ? 'hero-bob' : ''}>
        {glow && <circle cx="11.5" cy="9.5" r="2.6" fill={glow} shapeRendering="auto" />}
        {rects(BODY_CELLS, flame)}
        <g className={walking ? 'hero-frame-a' : ''}>{rects(A_CELLS)}</g>
        <g className={walking ? 'hero-frame-b' : ''} opacity={walking ? undefined : 0}>
          {rects(B_CELLS)}
        </g>
      </g>
    </svg>
  );
}
