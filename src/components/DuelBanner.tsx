import type { Example, Guardian } from '../content/schema';
import type { DuelState } from '../domain/duel';
import { NpcPortrait } from './NpcPortrait';

/** Подпись последнего хода схватки. */
const MOVE: Record<NonNullable<DuelState['last']>, string> = {
  strike: 'Удар!',
  combo: 'Приём!',
  parry: 'Страж отразил',
};

/**
 * Схватка со стражем (задача 13.5) над заданием испытания: портрет и полоска силы стража, щиты героя, подпись хода,
 * реплика стража на середине. `turn` — номер ответа: по нему перезапускаются анимации удара и щита.
 */
export function DuelBanner({ guardian, state, turn, mid }: { guardian: Guardian; state: DuelState; turn: number; mid: Example | null }) {
  const hit = state.last === 'strike' || state.last === 'combo';
  return (
    <div className="mt-2 rounded-2xl bg-wood px-3 py-2 text-[#f1dfb5]" data-testid="duel" data-strength={state.strength.toFixed(3)} data-shields={state.shields}>
      <div className="flex items-center gap-3">
        <div key={`g${turn}`} className={hit ? (state.last === 'combo' ? 'duel-combo' : 'duel-hit') : ''}>
          <NpcPortrait look={guardian.look} size={44} label={guardian.name} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="truncate font-semibold">{guardian.name}</span>
            {state.last && (
              <span key={`m${turn}`} className={`duel-move shrink-0 font-bold ${state.last === 'parry' ? 'text-[#ffb3a3]' : 'text-gold'}`} data-testid="duel-move">
                {MOVE[state.last]}
              </span>
            )}
          </div>
          <div className="mt-1 h-3 overflow-hidden rounded bg-black/40 p-[2px]" aria-label={`Сила стража: ${Math.round(state.strength * 100)}%`}>
            <div className="h-full rounded-sm bg-[#c8402c] transition-[width] duration-500" style={{ width: `${state.strength * 100}%` }} />
          </div>
          <div className="mt-1 flex items-center gap-1 text-sm" aria-label={`Щитов: ${state.shields} из ${state.maxShields}`} data-testid="duel-shields">
            {Array.from({ length: state.maxShields }, (_, i) => (
              <span key={i} className={i < state.shields ? '' : `opacity-25 grayscale ${i === state.shields && state.last === 'parry' ? 'duel-crack' : ''}`} aria-hidden>
                🛡️
              </span>
            ))}
            {state.streak >= 2 && !state.won && <span className="ml-auto text-xs text-gold">серия {state.streak}</span>}
          </div>
        </div>
      </div>
      {mid && (
        <div className="mt-2 rounded-xl bg-black/25 px-3 py-1.5 text-sm" data-testid="duel-mid">
          <div className="font-semibold">{mid.es}</div>
          <div className="text-[#d9c79f]">{mid.ru}</div>
        </div>
      )}
      {state.won && <p className="mt-1 text-center text-sm font-semibold text-gold" data-testid="duel-won">Страж повержен! Доведите схватку до конца.</p>}
      {state.lost && <p className="mt-1 text-center text-sm text-[#ffb3a3]" data-testid="duel-lost">Щиты разбиты: печать сегодня не взять, но каждый ответ — опыт.</p>}
    </div>
  );
}
