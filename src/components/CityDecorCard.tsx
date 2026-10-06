import { DECOR, DECOR_TIER, unlockedDecor } from '../domain/decor';
import { LINES, TIER_INFO } from '../domain/medals';
import { useMotivation } from '../store/motivation';
import { useRewards } from '../store/rewards';
import { LOCATION_BY_ID } from '../content/locations';

const ICONS = import.meta.glob<string>('../assets/decor/*.webp', { eager: true, import: 'default' });
/** Значок украшения: вырезан из листа `docs/design/decor.png` (`scripts/build-decor-art.py`). */
export const decorIcon = (line: string) => ICONS[`../assets/decor/${line}.webp`];

/**
 * Украшения города в профиле (задача 9.3): у каждой линии медалей своё украшение у здания на карте, его ставит
 * золотая медаль линии. Открытое украшение можно убрать с карты и вернуть.
 */
export function CityDecorCard() {
  const medals = useMotivation((s) => s.medals);
  // Селектор возвращает само поле: `?? []` внутри давал бы новый массив на каждый вызов и бесконечные перерисовки.
  const hidden = useRewards((s) => s.rec.hiddenDecor) ?? [];
  const open = unlockedDecor(medals);
  return (
    <section className="rounded-3xl bg-white p-4 shadow-sm" data-testid="city-decor-card">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-bold">Украшения города</h2>
        <span className="text-sm text-stone-500 tabular-nums">
          {open.length}/{DECOR.length}
        </span>
      </div>
      <p className="mt-1 text-sm text-stone-500">
        {TIER_INFO[DECOR_TIER].adj} медаль линии украшает здание города: знамя, фонари, клумба, колодец или фонтан. Нажмите, чтобы
        убрать украшение с карты или вернуть.
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {DECOR.map((d) => {
          const got = open.includes(d);
          const shown = got && !hidden.includes(d.line);
          const line = LINES.find((l) => l.id === d.line)!;
          return (
            <button
              key={d.line}
              type="button"
              disabled={!got}
              aria-pressed={shown}
              onClick={() => useRewards.getState().toggleDecor(d.line)}
              className={`press flex flex-col items-center gap-1 rounded-xl border-2 bg-[#3b4a2c] px-1 py-2 text-center text-[10px] leading-tight text-[#f1dfb5] ${
                shown ? 'border-gold' : 'border-transparent'
              } ${got ? '' : 'opacity-40 grayscale'}`}
              data-testid={`decor-${d.line}`}
            >
              <span className="flex h-12 items-end">
                <img
                  src={decorIcon(d.line)}
                  alt=""
                  draggable={false}
                  className="h-12 w-auto max-w-[84px] object-contain object-bottom"
                  style={d.glow && got ? { filter: `drop-shadow(0 0 4px ${d.glow})` } : undefined}
                />
              </span>
              <span>{got ? `${d.title} · ${LOCATION_BY_ID[d.place].ru}` : `${line.title}: ${TIER_INFO[DECOR_TIER].ru.toLowerCase()}`}</span>
              {got && <span className="text-[#c9b48a]">{shown ? 'на карте' : 'убрано'}</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}
