import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LOCATIONS } from '../content/locations';
import { hasContent } from '../content';
import type { LocationMeta } from '../content/schema';
import { isFull, pendingIncome } from '../domain/economy';
import { useCity } from '../store/city';
import { useNow } from '../lib/useNow';

function Tile({ meta, now }: { meta: LocationMeta; now: number }) {
  const nav = useNavigate();
  const collect = useCity((s) => s.collect);
  const [float, setFloat] = useState<{ key: number; n: number } | null>(null);
  const b = useCity((s) => s.buildings[meta.id]);
  const coins = useCity((s) => s.coins);
  const level = b?.level ?? 0;
  const available = hasContent(meta.id);
  const pending = b ? pendingIncome(b, now) : 0;
  const full = b ? isFull(b, now) : false;
  const affordable = !level && coins >= meta.unlockCost;

  return (
    <div className="relative">
      <button
        type="button"
        disabled={!available}
        onClick={() => nav(`/loc/${meta.id}`)}
        className={`press plot flex aspect-square w-full flex-col items-center justify-center rounded-lg p-1 text-center ${
          level ? 'plot-open' : 'plot-locked'
        } ${available ? '' : 'opacity-50'}`}
      >
        <span className={`text-3xl ${level ? '' : 'opacity-50 grayscale'}`}>{meta.emoji}</span>
        <span className="mt-1 line-clamp-1 font-pixel text-[11px] leading-tight">{meta.ru}</span>
        {level > 0 ? (
          <span className="mt-0.5 text-[10px] tracking-tight text-gold-dark">
            {'★'.repeat(level)}
            <span className="text-stone-300">{'★'.repeat(5 - level)}</span>
          </span>
        ) : available ? (
          <span
            className={`mt-0.5 rounded px-1 text-[10px] font-bold ${affordable ? 'bg-gold text-wood' : 'text-stone-200'}`}
          >
            🪙 {meta.unlockCost}
          </span>
        ) : (
          <span className="mt-0.5 text-[10px] text-stone-200">скоро</span>
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
          className={`press absolute -top-1.5 -right-1.5 flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-xs font-bold shadow ${
            full ? 'bg-gold text-wood' : 'bg-amber-100 text-amber-800'
          }`}
        >
          +{pending}
        </button>
      )}
      {float && (
        <span key={float.key} className="float-up absolute -top-4 right-0 text-sm font-bold text-gold [text-shadow:0_1px_0_#1a120a]">
          +{float.n} 🪙
        </span>
      )}
    </div>
  );
}

export function CityGrid() {
  const now = useNow();
  const collectAll = useCity((s) => s.collectAll);
  const buildings = useCity((s) => s.buildings);
  const [floats, setFloats] = useState<{ key: number; text: string }[]>([]);

  const total = Object.values(buildings).reduce((n, b) => n + (b ? pendingIncome(b, now) : 0), 0);

  const showFloat = (n: number) => {
    if (!n) return;
    const key = Date.now() + Math.random();
    setFloats((f) => [...f, { key, text: `+${n} 🪙` }]);
    setTimeout(() => setFloats((f) => f.filter((x) => x.key !== key)), 750);
  };

  return (
    <section className="px-3">
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
      <div className="overworld mt-2 grid grid-cols-4 gap-2.5 rounded-xl p-3.5">
        {LOCATIONS.map((l) => (
          <Tile key={l.id} meta={l} now={now} />
        ))}
      </div>
    </section>
  );
}
