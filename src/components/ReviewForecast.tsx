import { useMemo } from 'react';
import { isVerbId } from '../domain/itemId';
import { plural } from '../domain/medals';
import { REVIEW_FIRST } from '../domain/next';
import { reviewForecast } from '../domain/srs';
import { useProgress } from '../store/progress';
import { useSettings } from '../store/settings';

const DAY_MS = 86_400_000;
const WEEKDAY = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

/** Подпись дня прогноза: «сег.», дальше день недели (на телефоне в столбец влезает только короткое слово). */
const dayLabel = (i: number, now: number) => (i === 0 ? 'сег.' : WEEKDAY[new Date(now + i * DAY_MS).getDay()]);

/**
 * Прогноз повторений на 7 дней (задача 12.6) в настройках: сколько карточек FSRS поставит к повтору в каждый
 * день. Формы кузницы не считаются: они повторяются только в кузнице, как и на главной.
 */
export function ReviewForecast() {
  const cards = useProgress((s) => s.cards);
  const newPerDay = useSettings((s) => s.newPerDay);
  const now = Date.now();
  const days = useMemo(() => reviewForecast(Object.values(cards).filter((c) => !isVerbId(c.wordId)), now), [cards, now]);
  const max = Math.max(1, ...days);
  const week = days.reduce((a, b) => a + b, 0);

  return (
    <section className="rounded-3xl bg-white p-4 shadow-sm" data-testid="review-forecast">
      <h2 className="font-bold">Повторения на неделю</h2>
      <div className="mt-3 grid grid-cols-7 items-end gap-1.5" aria-label={`Повторений за 7 дней: ${week}`}>
        {days.map((n, i) => (
          <div key={i} className="flex flex-col items-center gap-1" data-testid="forecast-day">
            <span className="text-sm font-semibold tabular-nums">{n}</span>
            <div className="flex h-16 w-full items-end rounded-md bg-stone-100">
              <div className={`w-full rounded-md ${i === 0 ? 'bg-brand' : 'bg-wood/60'}`} style={{ height: `${n ? Math.max(6, (n / max) * 100) : 0}%` }} />
            </div>
            <span className="text-xs text-stone-500">{dayLabel(i, now)}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-sm text-stone-500">
        Всего {week} {plural(week, ['повторение', 'повторения', 'повторений'])} за 7 дней, сегодня — вместе с просроченными. Если к повтору больше{' '}
        {newPerDay * REVIEW_FIRST} (лимит новых слов × {REVIEW_FIRST}), «Продолжить» сначала ведёт к повторению.
      </p>
    </section>
  );
}
