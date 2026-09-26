import { useMemo } from 'react';
import { PHRASE_IDS } from '../content/wordIndex';
import { plural } from '../domain/medals';
import { CHAPTER_MARKS, SCALE_MAX, VOCAB_GOAL, vocabulary } from '../domain/vocabulary';
import { useProgress } from '../store/progress';

const pct = (n: number) => `${Math.min(100, (n / SCALE_MAX) * 100)}%`;

/** Словарный запас в профиле: выучено и закреплено, полоса до цели 3000 с отметками конца глав. */
export function VocabCard() {
  const cards = useProgress((s) => s.cards);
  const { learned, solid } = useMemo(() => vocabulary(cards, (id) => PHRASE_IDS.has(id)), [cards]);
  return (
    <section className="rounded-3xl bg-white p-4 shadow-sm" data-testid="vocab-card">
      <h2 className="font-bold">Словарный запас</h2>
      <p className="mt-1 text-sm text-stone-600 tabular-nums" data-testid="vocab-text">
        {learned} {plural(learned, ['слово', 'слова', 'слов'])}, из них {solid} закреплено
      </p>
      <div
        className="relative mt-3 h-4 overflow-hidden rounded bg-wood p-[2px]"
        role="progressbar"
        aria-label={`Словарный запас до цели ${VOCAB_GOAL}`}
        aria-valuemin={0}
        aria-valuemax={VOCAB_GOAL}
        aria-valuenow={learned}
      >
        <div className="absolute inset-y-[2px] left-[2px] rounded-sm bg-gold/45" style={{ width: pct(learned) }} />
        <div className="absolute inset-y-[2px] left-[2px] rounded-sm bg-gold" style={{ width: pct(solid) }} />
        {CHAPTER_MARKS.map((m) => (
          <div key={m.chapter} className="absolute inset-y-0 w-px bg-stone-50/70" style={{ left: pct(m.at) }} />
        ))}
        <div className="absolute inset-y-0 w-0.5 bg-ok" style={{ left: pct(VOCAB_GOAL) }} />
      </div>
      {/* Подписи отметок: главы и цель. */}
      <div className="relative mt-1 h-4 text-[10px] text-stone-500 tabular-nums">
        {CHAPTER_MARKS.map((m) => (
          <span key={m.chapter} className="absolute -translate-x-full pr-0.5" style={{ left: pct(m.at) }}>
            {m.chapter}
          </span>
        ))}
      </div>
      <p className="mt-1 text-xs text-stone-500">
        Светлая часть полосы — выучено, яркая — закреплено. Цель пути — {VOCAB_GOAL} слов, зелёная черта.
      </p>
    </section>
  );
}
