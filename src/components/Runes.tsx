/**
 * Руны-украшения для камней на главной: рисуются линиями, а не символами шрифта, потому что руническое письмо
 * есть не во всех системных шрифтах. Смысла не несут, только орнамент.
 */
const RUNE: Record<string, string> = {
  f: 'M3 1V13M3 3L8 1M3 7L8 5',
  r: 'M3 1V13M3 1L7 4L3 7L8 13',
  u: 'M2 13V1L8 5V13',
  z: 'M5 13V1M5 6L1 2M5 6L9 2',
  b: 'M3 1V13M3 1L8 4L3 7L8 10L3 13',
  t: 'M5 13V1M1 5L5 1L9 5',
  th: 'M3 1V13M3 4L8 7L3 10',
  o: 'M5 1L9 5L5 9L1 5ZM1 13L5 9L9 13',
};

export type RuneName = keyof typeof RUNE;

export function Rune({ name, className = '', stroke = 'currentColor' }: { name: string; className?: string; stroke?: string }) {
  return (
    <svg viewBox="0 0 10 14" className={className} aria-hidden>
      <path d={RUNE[name]} fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="square" strokeLinejoin="miter" />
    </svg>
  );
}

/** Каменная плитка с тремя парами рун в центре верхней панели. */
export function RuneStone() {
  const rows = [['u', 'r'], ['f', 'r'], ['b', 'z']];
  return (
    <div className="rune-stone flex shrink-0 flex-col items-center justify-center gap-[3px]" aria-hidden>
      {rows.map((row, i) => (
        <div key={i} className="flex gap-[3px]">
          {row.map((n, j) => (
            <Rune key={j} name={n} className="h-[11px] w-[8px]" />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Рунный камень с числом: ромб из синего камня в золотой оправе, руны по краям. */
export function RuneBadge({ value, dim = false }: { value: number; dim?: boolean }) {
  const around: [string, number, number][] = [
    ['r', 50, 13], ['u', 87, 50], ['z', 50, 87], ['t', 13, 50],
    ['f', 30, 30], ['b', 70, 30], ['o', 70, 70], ['th', 30, 70],
  ];
  return (
    <div className={`relative h-[76px] w-[76px] shrink-0 ${dim ? 'opacity-60 grayscale' : ''}`}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <radialGradient id="rb-stone" cx="0.45" cy="0.4" r="0.7">
            <stop offset="0" stopColor="#3a4f96" />
            <stop offset="0.6" stopColor="#1d2a5e" />
            <stop offset="1" stopColor="#0f1636" />
          </radialGradient>
          <linearGradient id="rb-gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#fff1b8" />
            <stop offset="0.45" stopColor="#e0b43c" />
            <stop offset="1" stopColor="#7a5410" />
          </linearGradient>
        </defs>
        <path d="M50 3L97 50L50 97L3 50Z" fill="#1a120a" transform="translate(0 3)" opacity="0.5" />
        <path d="M50 3L97 50L50 97L3 50Z" fill="url(#rb-gold)" stroke="#3b2a0a" strokeWidth="2" />
        <path d="M50 11L89 50L50 89L11 50Z" fill="url(#rb-stone)" stroke="#5c3d08" strokeWidth="1.5" />
        {around.map(([n, x, y]) => (
          <g key={n} transform={`translate(${x - 3.5} ${y - 5}) scale(0.7)`}>
            <path d={RUNE[n]} fill="none" stroke="#8fb0ff" strokeWidth="1.6" opacity="0.75" />
          </g>
        ))}
        <circle cx="50" cy="50" r="23" fill="#f3e3b8" stroke="url(#rb-gold)" strokeWidth="4" />
        <circle cx="50" cy="50" r="19.5" fill="none" stroke="#b08a44" strokeWidth="1" />
      </svg>
      <span style={{ fontSize: value >= 1000 ? 15 : value >= 100 ? 20 : 26 }} className="absolute inset-0 flex items-center justify-center font-serif font-bold text-stone-900 tabular-nums">
        {value}
      </span>
    </div>
  );
}
