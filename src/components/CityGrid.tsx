import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import cityMap from '../assets/city.webp';
import cityLit from '../assets/city-lit.webp';
import { LOCATIONS } from '../content/locations';
import { NPC_BY_LOCATION } from '../content/npcs';
import { useErrands } from '../store/errands';
import { useProgress } from '../store/progress';
import { errandSignal } from '../domain/errands';
import { isRuleId } from '../domain/itemId';
import { dueCards } from '../domain/srs';
import { NpcPortrait } from './NpcPortrait';
import { hasContent } from '../content';
import type { LocationMeta } from '../content/schema';
import { isFull, pendingIncome } from '../domain/economy';
import { MAP_H, MAP_W, type Point, door, labelCenter, pathLength, plotRect, route } from '../domain/townMap';
import { useCity } from '../store/city';
import { useNow } from '../lib/useNow';
import { HeroSprite } from './Hero';
import { LANG } from '../lang';

/** Скорость героя в пикселях картинки в секунду и предел длительности прогулки. */
const SPEED = 1200;
const MAX_WALK_MS = 1200;
// У каждого языка свой город, поэтому и место героя своё. У испанского ключ прежний.
const HERO_KEY = LANG === 'es' ? 'eslacity.hero' : `eslacity.hero.${LANG}`;

const pctX = (x: number) => `${(x / MAP_W) * 100}%`;
const pctY = (y: number) => `${(y / MAP_H) * 100}%`;
// Слой героя размером с карту: translate в процентах считается от его размеров, то есть от карты.
const heroTransform = (p: Point) => `translate(${pctX(p.x)}, ${pctY(p.y)})`;

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

/** Запас вокруг участка для освещённой версии: захватывает свечение на мостовой. */
const GLOW = 24;

/**
 * Кусок освещённой картинки на месте участка. Картинка того же размера и с той же разметкой,
 * поэтому достаточно показать её фоном с нужным масштабом и сдвигом.
 */
function LitPlot({ index }: { index: number }) {
  const p = plotRect(index);
  const x0 = Math.max(0, p.x - GLOW);
  const y0 = Math.max(0, p.y - GLOW);
  const r = { x: x0, y: y0, w: Math.min(MAP_W, p.x + p.w + GLOW) - x0, h: Math.min(MAP_H, p.y + p.h + GLOW) - y0 };
  return (
    <div
      aria-hidden
      className="lit-plot pointer-events-none absolute"
      style={{
        left: pctX(r.x),
        top: pctY(r.y),
        width: pctX(r.w),
        height: pctY(r.h),
        backgroundImage: `url(${cityLit})`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: `${(MAP_W / r.w) * 100}% ${(MAP_H / r.h) * 100}%`,
        backgroundPosition: `${(r.x / (MAP_W - r.w)) * 100}% ${(r.y / (MAP_H - r.h)) * 100}%`,
      }}
    />
  );
}

/** Табличка поверх нарисованной строки со звёздами или ценой: показывает настоящий уровень или цену. */
const LABEL_W = 118;
const LABEL_H = 40;

/**
 * Здание на карте: прозрачная кнопка поверх нарисованного участка.
 * Название нарисовано на картинке, для экранных читалок оно продублировано скрытым текстом.
 */
function Building({ meta, index, now, onGo, signal }: { meta: LocationMeta; index: number; now: number; onGo: (i: number) => void; signal: number }) {
  const collect = useCity((s) => s.collect);
  const [float, setFloat] = useState<{ key: number; n: number } | null>(null);
  const b = useCity((s) => s.buildings[meta.id]);
  const coins = useCity((s) => s.coins);
  const level = b?.level ?? 0;
  const available = hasContent(meta.id);
  const pending = b ? pendingIncome(b, now) : 0;
  const full = b ? isFull(b, now) : false;
  const affordable = !level && coins >= meta.unlockCost;
  const r = plotRect(index);
  const lc = labelCenter(index);
  const npc = NPC_BY_LOCATION[meta.id];

  return (
    <>
      {level > 0 ? (
        <LitPlot index={index} />
      ) : (
        <div
          aria-hidden
          className="map-locked pointer-events-none absolute rounded-lg"
          style={{ left: pctX(r.x), top: pctY(r.y), width: pctX(r.w), height: pctY(r.h) }}
        />
      )}
      <button
        type="button"
        disabled={!available}
        onClick={() => onGo(index)}
        className="building absolute rounded-lg"
        style={{ left: pctX(r.x), top: pctY(r.y), width: pctX(r.w), height: pctY(r.h) }}
      >
        <span className="sr-only">
          {meta.ru}, {level ? `уровень ${level}` : `закрыто, цена ${meta.unlockCost} монет`}
        </span>
      </button>
      <div
        aria-hidden
        className={`map-label pointer-events-none absolute flex items-center justify-center rounded-full ${affordable ? 'map-label-ready' : ''}`}
        style={{
          left: pctX(lc.x - LABEL_W / 2),
          top: pctY(lc.y - LABEL_H / 2),
          width: pctX(LABEL_W),
          height: pctY(LABEL_H),
        }}
      >
        {level > 0 ? (
          <span className="text-[10px] leading-none tracking-tight">
            <span className="text-gold">{'★'.repeat(level)}</span>
            <span className="text-stone-500">{'★'.repeat(5 - level)}</span>
          </span>
        ) : (
          <span className="text-[10px] leading-none font-bold">🪙 {meta.unlockCost}</span>
        )}
      </div>
      {signal > 0 && (
        // Житель ждёт с поручением: «!» тем ярче, чем больше карточек места пора повторить.
        <span
          aria-hidden
          data-testid={`errand-sign-${meta.id}`}
          className={`errand-sign errand-sign-${signal} pointer-events-none absolute z-10 flex h-6 w-6 -translate-x-1/2 items-center justify-center`}
          style={{ left: pctX(r.x + 22), top: pctY(r.y + r.h - 100) }}
        >
          {/* Пиксельный красный «!» с тёмной обводкой, без подложки. */}
          <svg viewBox="0 0 6 12" width="12" height="24" shapeRendering="crispEdges">
            <path d="M1 0h4v9H1zM1 9h4v3H1z" fill="#1a120a" />
            <path d="M2 1h2v6H2zM2 9h2v2H2z" fill="currentColor" />
          </svg>
        </span>
      )}
      {level > 0 && npc && (
        // Житель стоит у своего здания, пока место открыто.
        <div
          aria-hidden
          className="pointer-events-none absolute z-[5]"
          style={{ left: pctX(r.x + 2), top: pctY(r.y + r.h - 54) }}
          data-testid={`npc-${meta.id}`}
        >
          <NpcPortrait look={npc.look} size={27} />
        </div>
      )}
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
          className={`press absolute z-10 flex h-6 min-w-6 -translate-x-3/4 translate-y-1 items-center justify-center rounded-full px-1 text-[11px] font-bold shadow ${
            full ? 'bg-gold text-wood' : 'bg-amber-100 text-amber-800'
          }`}
          style={{ left: pctX(r.x + r.w), top: pctY(r.y) }}
        >
          +{pending}
        </button>
      )}
      {float && (
        <span
          key={float.key}
          className="float-up absolute z-10 -translate-x-full text-sm font-bold text-gold [text-shadow:0_1px_0_#1a120a]"
          style={{ left: pctX(r.x + r.w), top: pctY(r.y) }}
        >
          +{float.n} 🪙
        </span>
      )}
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
  const errands = useErrands((s) => s.active);
  const cards = useProgress((s) => s.cards);
  // Знаки поручений: у каких мест ждёт житель и сколько карточек места пора повторить.
  const signals = useMemo(() => {
    const due = dueCards(Object.values(cards), now);
    const out: Record<string, number> = {};
    for (const e of errands) {
      const n = e.kind === 'rules' ? due.filter((c) => isRuleId(c.wordId)).length : due.filter((c) => c.wordId.startsWith(`${e.location}.`)).length;
      out[e.location] = errandSignal(true, n);
    }
    return out;
  }, [errands, cards, now]);

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
      <div className="relative isolate mt-2" style={{ aspectRatio: `${MAP_W} / ${MAP_H}` }}>
        <img src={cityMap} alt="" draggable={false} className="absolute inset-0 h-full w-full select-none" />
        {LOCATIONS.map((l, i) => (
          <Building key={l.id} meta={l} index={i} now={now} onGo={go} signal={signals[l.id] ?? 0} />
        ))}
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
