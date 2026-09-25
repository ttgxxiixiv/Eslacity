import { useCity } from '../store/city';
import { useProgress } from '../store/progress';
import { useSettings } from '../store/settings';
import { dayKey, dayNumber } from '../domain/srs';
import { isAlive } from '../domain/streak';
import { useMotivation } from '../store/motivation';

const HEARTS = 5;

// Сердечко 7×6 пикселей; обводка считается по соседним клеткам.
const SHAPE = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
const inShape = (x: number, y: number) => SHAPE[y - 1]?.[x - 1] === 'X';
const FILL: [number, number][] = [];
const OUTLINE: [number, number][] = [];
for (let y = 0; y < 8; y++) {
  for (let x = 0; x < 9; x++) {
    if (inShape(x, y)) FILL.push([x, y]);
    else if (inShape(x - 1, y) || inShape(x + 1, y) || inShape(x, y - 1) || inShape(x, y + 1)) OUTLINE.push([x, y]);
  }
}

/** Пиксельное сердечко. fill: 0, 0.5 или 1 (левая половина — до x < 4.5). */
function Heart({ fill }: { fill: number }) {
  return (
    <svg viewBox="0 0 9 8" className="heart" shapeRendering="crispEdges" aria-hidden>
      {OUTLINE.map(([x, y]) => (
        <rect key={`o${x}.${y}`} x={x} y={y} width="1" height="1" fill="#1a120a" />
      ))}
      {FILL.map(([x, y]) => (
        <rect
          key={`f${x}.${y}`}
          x={x}
          y={y}
          width="1"
          height="1"
          fill={x < 9 * fill ? (x === 2 && y === 2 ? '#ffb3a8' : '#e2352b') : '#6b3a2a'}
        />
      ))}
    </svg>
  );
}

/** Верхняя панель в духе RPG: кошелёк, огонь стрика и сердечки дневной цели. */
export function StatsBar() {
  const coins = useCity((s) => s.coins);
  const day = useProgress((s) => s.day);
  const goal = useSettings((s) => s.dailyGoal);
  const xp = day.date === dayKey(Date.now()) ? day.xp : 0;
  const ratio = Math.min(1, xp / goal);
  const streak = useMotivation((s) => s.streak);
  const alive = isAlive(streak, dayNumber(Date.now()));
  // Дневная цель — пять сердечек, с половинками.
  const halves = Math.floor(ratio * HEARTS * 2);
  return (
    <div className="px-3 pt-3">
      <div className="flex items-center gap-2 rounded-xl bg-wood px-3 py-2 text-stone-50 shadow-lg">
        <div className="flex items-center gap-1 text-lg font-bold">
          <span>🪙</span>
          <span className="tabular-nums">{coins}</span>
        </div>
        <div className={`flex items-center gap-1 text-lg font-bold ${alive ? '' : 'opacity-50'}`} title="Стрик">
          <span className={alive ? '' : 'grayscale'}>🔥</span>
          <span className="tabular-nums">{alive ? streak.count : 0}</span>
        </div>
        <div className="ml-auto flex flex-col items-end" title="Дневная цель">
          <div className="flex gap-0.5" aria-label={`Дневная цель: ${xp} из ${goal} XP`}>
            {Array.from({ length: HEARTS }, (_, i) => (
              <Heart key={i} fill={Math.max(0, Math.min(2, halves - i * 2)) / 2} />
            ))}
          </div>
          <span className="text-xs font-semibold tabular-nums text-gold">
            {xp}/{goal} XP
          </span>
        </div>
      </div>
    </div>
  );
}
