import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LOCATIONS } from '../content/locations';
import { hasContent } from '../content';
import type { LocationMeta } from '../content/schema';
import { isFull, pendingIncome } from '../domain/economy';
import {
  COLS, PLOT, ROAD, type Point, door, mapHeight, pathLength, plotOrigin, roadX, roadY, route, rowsFor,
} from '../domain/townMap';
import { useCity } from '../store/city';
import { useNow } from '../lib/useNow';
import { HeroSprite } from './Hero';

const ROWS = rowsFor(LOCATIONS.length);
const H = mapHeight(ROWS);
/** Скорость героя в долях ширины карты в секунду и предел длительности прогулки. */
const SPEED = 140;
const MAX_WALK_MS = 1200;
const HERO_KEY = 'eslacity.hero';

// Вертикальные размеры переводим в проценты высоты карты.
const pctY = (y: number) => `${(y / H) * 100}%`;
// Слой героя размером с карту: translate в процентах считается от его размеров, то есть от карты.
const heroTransform = (p: Point) => `translate(${p.x}%, ${(p.y / H) * 100}%)`;

function loadHero(): number {
  try {
    const i = LOCATIONS.findIndex((l) => l.id === localStorage.getItem(HERO_KEY));
    return i >= 0 ? i : 0;
  } catch {
    return 0;
  }
}

function saveHero(i: number) {
  try {
    localStorage.setItem(HERO_KEY, LOCATIONS[i].id);
  } catch {
    // Хранилище недоступно: герой просто начнёт у кафе.
  }
}

const reducedMotion = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function Tile({ meta, index, now, onGo }: { meta: LocationMeta; index: number; now: number; onGo: (i: number) => void }) {
  const collect = useCity((s) => s.collect);
  const [float, setFloat] = useState<{ key: number; n: number } | null>(null);
  const b = useCity((s) => s.buildings[meta.id]);
  const coins = useCity((s) => s.coins);
  const level = b?.level ?? 0;
  const available = hasContent(meta.id);
  const pending = b ? pendingIncome(b, now) : 0;
  const full = b ? isFull(b, now) : false;
  const affordable = !level && coins >= meta.unlockCost;
  const o = plotOrigin(index);

  return (
    <div className="absolute" style={{ left: `${o.x}%`, top: pctY(o.y), width: `${PLOT}%`, height: pctY(PLOT) }}>
      <button
        type="button"
        disabled={!available}
        onClick={() => onGo(index)}
        className={`press plot flex h-full w-full flex-col items-center justify-center rounded-md p-0.5 text-center ${
          level ? 'plot-open' : 'plot-locked'
        } ${available ? '' : 'opacity-50'}`}
      >
        <span className={`text-2xl leading-none ${level ? '' : 'opacity-50 grayscale'}`}>{meta.emoji}</span>
        <span className="mt-1 line-clamp-1 max-w-full font-pixel text-[10px] leading-tight">{meta.ru}</span>
        {level > 0 ? (
          <span className="text-[9px] leading-tight tracking-tight text-gold-dark">
            {'★'.repeat(level)}
            <span className="text-stone-300">{'★'.repeat(5 - level)}</span>
          </span>
        ) : available ? (
          <span className={`mt-0.5 rounded px-1 text-[10px] leading-tight font-bold ${affordable ? 'bg-gold text-wood' : 'text-stone-200'}`}>
            🪙 {meta.unlockCost}
          </span>
        ) : (
          <span className="text-[10px] text-stone-200">скоро</span>
        )}
      </button>
      {pending > 0 && (
        <button
          type="button"
          aria-label={`Собрать ${pending} монет`}
          onClick={() => {
            const n = collect(meta.id);
            if (!n) return;
            const key = Date.now();
            setFloat({ key, n });
            setTimeout(() => setFloat((f) => (f?.key === key ? null : f)), 750);
          }}
          className={`press absolute -top-2 -right-2 z-10 flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[11px] font-bold shadow ${
            full ? 'bg-gold text-wood' : 'bg-amber-100 text-amber-800'
          }`}
        >
          +{pending}
        </button>
      )}
      {float && (
        <span key={float.key} className="float-up absolute -top-4 right-0 z-10 text-sm font-bold text-gold [text-shadow:0_1px_0_#1a120a]">
          +{float.n} 🪙
        </span>
      )}
    </div>
  );
}

/** Дороги: под каждым рядом и между столбцами. */
function Roads() {
  const rows = Array.from({ length: ROWS }, (_, r) => r);
  const cols = Array.from({ length: COLS + 1 }, (_, c) => c);
  return (
    <>
      {cols.map((c) => (
        <div
          key={`v${c}`}
          className="road absolute"
          style={{ left: `${roadX(c) - ROAD / 2}%`, width: `${ROAD}%`, top: pctY(ROAD), bottom: 0 }}
        />
      ))}
      {rows.map((r) => (
        <div
          key={`h${r}`}
          className="road absolute inset-x-0"
          style={{ top: pctY(roadY(r) - ROAD / 2), height: pctY(ROAD) }}
        />
      ))}
    </>
  );
}

export function CityGrid() {
  const nav = useNavigate();
  const now = useNow();
  const collectAll = useCity((s) => s.collectAll);
  const buildings = useCity((s) => s.buildings);
  const [floats, setFloats] = useState<{ key: number; text: string }[]>([]);

  const [hero, setHero] = useState(loadHero);
  const [walking, setWalking] = useState(false);
  const [facingLeft, setFacingLeft] = useState(false);
  const layer = useRef<HTMLDivElement>(null);
  const walk = useRef<{ target: number; anim?: Animation } | null>(null);

  useEffect(() => () => walk.current?.anim?.cancel(), []);

  const total = Object.values(buildings).reduce((n, b) => n + (b ? pendingIncome(b, now) : 0), 0);

  const showFloat = (n: number) => {
    if (!n) return;
    const key = Date.now() + Math.random();
    setFloats((f) => [...f, { key, text: `+${n} 🪙` }]);
    setTimeout(() => setFloats((f) => f.filter((x) => x.key !== key)), 750);
  };

  const arrive = (i: number) => {
    saveHero(i);
    nav(`/loc/${LOCATIONS[i].id}`);
  };

  /** Герой идёт к зданию по дорогам, потом открывается экран здания. */
  const go = async (i: number) => {
    // Нажатие во время прогулки: не ждём, сразу открываем.
    if (walk.current) {
      walk.current.anim?.cancel();
      walk.current = null;
      arrive(i);
      return;
    }
    const pts = route(hero, i);
    const len = pathLength(pts);
    const el = layer.current;
    if (!len || !el || reducedMotion() || typeof el.animate !== 'function') {
      arrive(i);
      return;
    }
    const scale = Math.min(1, MAX_WALK_MS / ((len / SPEED) * 1000));
    const state: { target: number; anim?: Animation } = { target: i };
    walk.current = state;
    setWalking(true);
    for (let k = 1; k < pts.length; k++) {
      const [a, b] = [pts[k - 1], pts[k]];
      if (b.x !== a.x) setFacingLeft(b.x < a.x);
      const seg = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
      state.anim = el.animate([{ transform: heroTransform(a) }, { transform: heroTransform(b) }], {
        duration: (seg / SPEED) * 1000 * scale,
        easing: 'linear',
        fill: 'forwards',
      });
      try {
        await state.anim.finished;
      } catch {
        return; // Прогулку отменили.
      }
      if (walk.current !== state) return;
    }
    walk.current = null;
    setHero(i);
    setWalking(false);
    arrive(i);
  };

  return (
    <section className="overflow-hidden px-3 pb-2">
      <div className="flex h-10 items-center justify-between px-2 pt-4 pb-2">
        <h2 className="text-lg font-bold text-stone-700">Карта города</h2>
        <div className="relative">
          {total > 0 && (
            <button
              type="button"
              onClick={() => showFloat(collectAll())}
              className="press rounded-lg bg-gold px-3 py-1 text-sm font-bold text-wood shadow"
            >
              Собрать всё +{total}
            </button>
          )}
          {floats.map((f) => (
            <span key={f.key} className="float-up absolute right-2 -top-3 font-bold text-gold [text-shadow:0_1px_0_#1a120a]">
              {f.text}
            </span>
          ))}
        </div>
      </div>
      {/* Карта без обрезки: у правого края герой немного выходит на рамку. Лишнее обрезает секция. */}
      <div className="overworld relative isolate mt-2 rounded-md" style={{ aspectRatio: `100 / ${H}` }}>
        <Roads />
        {LOCATIONS.map((l, i) => (
          <Tile key={l.id} meta={l} index={i} now={now} onGo={go} />
        ))}
        <div className="map-frame pointer-events-none absolute inset-0 z-30 rounded-md" />
        <div
          ref={layer}
          data-testid="hero"
          className="pointer-events-none absolute inset-0 z-40"
          style={{ transform: heroTransform(door(hero)) }}
        >
          <div className="absolute -top-[30px] -left-3" style={{ transform: facingLeft ? 'scaleX(-1)' : undefined }}>
            <HeroSprite walking={walking} />
          </div>
        </div>
      </div>
    </section>
  );
}
