import { useEffect } from 'react';
import { gainTitle, TIER_INFO } from '../domain/medals';
import { useMotivation } from '../store/motivation';
import { useProgress } from '../store/progress';
import { Medal } from './Medal';

const SHOW_MS = 3500;

/**
 * Вручение медали: плашка сверху с медалью и рамкой цвета ступени, по одной из очереди.
 * Пока висит поздравление с уровнем, медаль ждёт. Бриллиант вручается со вспышкой.
 */
export function MedalAward() {
  const award = useMotivation((s) => s.awards[0]);
  const levelUp = useProgress((s) => s.levelUp);
  const waiting = levelUp !== null;

  useEffect(() => {
    if (!award || waiting) return;
    const t = setTimeout(() => useMotivation.getState().dismissAward(), SHOW_MS);
    return () => clearTimeout(t);
  }, [award, waiting]);

  if (!award || waiting) return null;
  const tier = award.kind === 'line' ? award.tier : 'gold';
  const color = award.kind === 'line' ? TIER_INFO[award.tier].color : '#e0b43c';
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-30 flex justify-center px-4" role="status" aria-live="polite">
      {tier === 'diamond' && <div className="medal-flash fixed inset-0" aria-hidden />}
      <div
        key={award.kind === 'line' ? `${award.line.id}.${award.tier}` : award.secret.id}
        className="level-up flex items-center gap-3 rounded-xl border-4 bg-wood px-4 py-3 text-stone-50 shadow-xl"
        style={{ borderColor: color }}
        data-testid="medal-award"
      >
        <Medal icon={award.kind === 'line' ? award.line.id : 'secret'} tier={tier} size={64} />
        <div>
          <div className="font-pixel text-xs tracking-widest uppercase" style={{ color }}>
            {award.kind === 'line' ? 'Новая медаль' : 'Тайная медаль'}
          </div>
          <div className="font-semibold">{gainTitle(award)}</div>
          <div className="text-sm text-gold">+{award.reward} 🪙</div>
        </div>
      </div>
    </div>
  );
}
