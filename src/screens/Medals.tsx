import { Medal } from '../components/Medal';
import { Screen, TopBar } from '../components/ui';
import {
  ACTIVE_LINES, currentTier, LINES, nextThreshold, progressText, SECRETS, TIER_INFO, TIERS, type LineId,
} from '../domain/medals';
import { medalCounters, useMotivation } from '../store/motivation';

/** Когда включатся линии, для которых ещё нет систем. */
const SOON: Partial<Record<LineId, string>> = {
  friend: 'Откроется, когда в городе появятся жители',
  trials: 'Откроется с испытаниями мест и стражей',
  echo: 'Откроется в Лабиринте Эха',
};

/** Зал медалей: все линии рядами, прогресс до следующей ступени, тайные медали. */
export function MedalsScreen() {
  const medals = useMotivation((s) => s.medals);
  const counters = medalCounters();
  const got = ACTIVE_LINES.reduce((n, l) => n + Object.keys(medals.lines[l.id] ?? {}).length, 0);

  return (
    <Screen>
      <TopBar title="Зал медалей" right={<span className="px-3 text-sm text-stone-500 tabular-nums">{got}/{ACTIVE_LINES.length * TIERS.length}</span>} />
      <div className="flex flex-col gap-3 px-4 pb-6" data-testid="medals">
        {LINES.map((l) => {
          const rec = medals.lines[l.id] ?? {};
          const tier = currentTier(rec);
          const value = l.value ? l.value(counters) : 0;
          const next = l.value ? nextThreshold(l, value) : null;
          const from = next ? (TIERS.indexOf(next.tier) > 0 ? l.thresholds[TIERS.indexOf(next.tier) - 1] : 0) : 0;
          const ratio = next ? Math.min(1, Math.max(0, (value - from) / (next.at - from))) : 1;
          return (
            <section key={l.id} className={`rounded-2xl bg-white p-3 shadow-sm ${l.value ? '' : 'opacity-60'}`} data-line={l.id}>
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="font-bold">{l.title}</h2>
                <span className={`text-sm ${tier ? 'font-semibold text-amber-700' : 'text-stone-400'}`}>
                  {tier ? TIER_INFO[tier].ru : 'нет'}
                </span>
              </div>
              <div className="text-xs text-stone-500">{l.counts}</div>
              <ul className="mt-2 flex justify-between">
                {TIERS.map((t) => {
                  const has = rec[t] !== undefined;
                  return (
                    <li key={t}>
                      <Medal icon={l.id} tier={has ? t : null} size={48} label={`${l.title}, ${TIER_INFO[t].ru.toLowerCase()}${has ? '' : ': ещё нет'}`} />
                    </li>
                  );
                })}
              </ul>
              {l.value ? (
                <>
                  <div
                    className="mt-2 h-3 overflow-hidden rounded bg-wood p-[2px]"
                    role="progressbar"
                    aria-label={next ? `${l.title}: до ступени «${TIER_INFO[next.tier].ru}»` : `${l.title}: все ступени`}
                    aria-valuemin={from}
                    aria-valuemax={next?.at ?? value}
                    aria-valuenow={value}
                  >
                    <div className="h-full w-full origin-left rounded-sm bg-gold" style={{ transform: `scaleX(${ratio})` }} />
                  </div>
                  <p className="mt-1 text-sm text-stone-600 tabular-nums">{progressText(l, value)}</p>
                </>
              ) : (
                <p className="mt-2 text-sm text-stone-500">{SOON[l.id]}</p>
              )}
            </section>
          );
        })}

        <section className="rounded-2xl bg-white p-3 shadow-sm">
          <h2 className="font-bold">Тайные медали</h2>
          <p className="text-xs text-stone-500">Как их получить, узнаешь, только когда получишь.</p>
          <ul className="mt-3 grid grid-cols-3 gap-3">
            {SECRETS.map((x) => {
              const has = medals.secrets[x.id] !== undefined;
              return (
                <li key={x.id} className="flex flex-col items-center text-center">
                  <Medal icon={has ? 'secret' : 'hidden'} tier={has ? 'gold' : null} size={48} label={has ? x.title : 'Тайная медаль'} />
                  <div className={`mt-1 text-xs leading-tight font-semibold ${has ? '' : 'text-stone-400'}`}>{has ? x.title : '???'}</div>
                  {has && <div className="text-[11px] leading-tight text-stone-500">{x.text}</div>}
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </Screen>
  );
}
