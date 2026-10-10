import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { wordsByIds } from '../content';
import { GRAMMAR } from '../content/grammar';
import { LOCATION_BY_ID } from '../content/locations';
import { phrasesByIds } from '../content/phrases';
import { EXPRESSION_IDS, PHRASE_IDS, SCROLL_WORDS, WORD_LEVELS } from '../content/wordIndex';
import { answersSince } from '../db/answers';
import type { AnswerRecord, AnswerSummary } from '../domain/answerLog';
import { CHAPTERS, chapterOfLevel } from '../domain/chapters';
import { exerciseOf, isPhraseId, isRuleId, lessonOfExercise } from '../domain/itemId';
import { plural } from '../domain/medals';
import { MISTAKES_DAYS, MISTAKES_FLOOR, mistakesPlan, weakItems, type WeakItem } from '../domain/mistakes';
import { minutesPerDay, PATH_SKILLS, PATH_WEAK, pathAccuracy, wordsByChapter } from '../domain/myPath';
import { dayNumber } from '../domain/srs';
import { ReviewForecast } from '../components/ReviewForecast';
import { Button, Screen, TopBar } from '../components/ui';
import { useErrands } from '../store/errands';
import { useJourney } from '../store/journey';
import { useProgress } from '../store/progress';

const DAY = 86_400_000;
const WEEKDAY = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

/** Глава каждого слова мест и свитков, без фраз и выражений: тот же счёт, что у словарного запаса. */
const WORD_CHAPTER: ReadonlyMap<string, number> = (() => {
  const out = new Map<string, number>();
  for (const [place, levels] of Object.entries(WORD_LEVELS)) {
    if (!(place in LOCATION_BY_ID)) continue;
    for (const [level, ids] of Object.entries(levels)) {
      const chapter = chapterOfLevel(Number(level))?.id;
      if (chapter) for (const id of ids) out.set(id, chapter);
    }
  }
  for (const [chapter, ids] of Object.entries(SCROLL_WORDS)) for (const id of ids) out.set(id, Number(chapter));
  for (const id of [...PHRASE_IDS, ...EXPRESSION_IDS]) out.delete(id);
  return out;
})();

const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)}%`);

/**
 * «Мой путь» (задача 14.5): точность по навыкам за 7 и 30 дней, минуты в заданиях, слова по главам,
 * прогноз повторений и пять слабых мест с переходом к «Разбору ошибок». Графики — блоки разметки, без библиотек.
 */
export function MyPathScreen() {
  const [rows, setRows] = useState<AnswerRecord[] | null>(null);
  const [now] = useState(() => Date.now());
  useEffect(() => {
    let alive = true;
    answersSince(now - MISTAKES_DAYS * DAY).then((r) => {
      if (alive) setRows(r);
    });
    return () => {
      alive = false;
    };
  }, [now]);

  return (
    <Screen>
      <TopBar title="Мой путь" />
      <div className="flex flex-col gap-4 px-5 pb-6">
        {rows === null ? (
          <p className="py-6 text-center text-stone-500">Летописец листает записи…</p>
        ) : (
          <>
            <Accuracy rows={rows} now={now} />
            <Minutes rows={rows} now={now} />
          </>
        )}
        <ChapterWordsCard />
        <ReviewForecast />
        {rows && <WeakSpots rows={rows} now={now} />}
      </div>
    </Screen>
  );
}

function Accuracy({ rows, now }: { rows: AnswerRecord[]; now: number }) {
  const week = useMemo(() => pathAccuracy(rows, now, 7), [rows, now]);
  const month = useMemo(() => pathAccuracy(rows, now, 30), [rows, now]);
  return (
    <section className="rounded-3xl bg-white p-4 shadow-sm" data-testid="path-accuracy">
      <h2 className="font-bold">Точность</h2>
      <div className="mt-2 flex justify-end gap-3 text-xs text-stone-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-gold" aria-hidden /> 7 дней
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-wood/50" aria-hidden /> 30 дней
        </span>
      </div>
      <div className="mt-1 flex flex-col gap-2.5">
        {PATH_SKILLS.map((s) => (
          <div key={s.id} data-testid="path-skill" data-skill={s.id}>
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-semibold">{s.title}</span>
              <span className="tabular-nums text-stone-600" data-testid="path-skill-value">
                {pct(week[s.id].accuracy)} · {pct(month[s.id].accuracy)}
              </span>
            </div>
            <Bar summary={week[s.id]} className="bg-gold" label={`${s.title}, 7 дней`} />
            <Bar summary={month[s.id]} className="bg-wood/50" label={`${s.title}, 30 дней`} />
          </div>
        ))}
      </div>
      <p className="mt-2 text-sm text-stone-500">Доля верных ответов, «почти» — половина. Прочерк — заданий этого вида не было.</p>
    </section>
  );
}

function Bar({ summary, className, label }: { summary: AnswerSummary; className: string; label: string }) {
  const v = summary.accuracy ?? 0;
  return (
    <div
      className="mt-1 h-2 overflow-hidden rounded bg-stone-100"
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
    >
      <div className={`h-full rounded ${className}`} style={{ width: `${v * 100}%` }} />
    </div>
  );
}

function Minutes({ rows, now }: { rows: AnswerRecord[]; now: number }) {
  const days = useMemo(() => minutesPerDay(rows, now, 7), [rows, now]);
  const max = Math.max(1, ...days.map((d) => d.minutes));
  const week = days.reduce((n, d) => n + d.minutes, 0);
  return (
    <section className="rounded-3xl bg-white p-4 shadow-sm" data-testid="path-minutes">
      <h2 className="font-bold">Минуты в день</h2>
      <div className="mt-3 grid grid-cols-7 items-end gap-1.5" aria-label={`Минут за 7 дней: ${week}`}>
        {days.map((d, i) => (
          <div key={d.key} className="flex flex-col items-center gap-1" data-testid="path-minutes-day">
            <span className="text-sm font-semibold tabular-nums">{d.minutes}</span>
            <div className="flex h-16 w-full items-end rounded-md bg-stone-100">
              <div className={`w-full rounded-md ${i === 6 ? 'bg-brand' : 'bg-wood/60'}`} style={{ height: `${d.minutes ? Math.max(6, (d.minutes / max) * 100) : 0}%` }} />
            </div>
            <span className="text-xs text-stone-500">{i === 6 ? 'сег.' : WEEKDAY[new Date(now - (6 - i) * DAY).getDay()]}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-sm text-stone-500">
        {week} {plural(week, ['минута', 'минуты', 'минут'])} за неделю. Считается время ответов в заданиях, без чтения теории и разговоров.
      </p>
    </section>
  );
}

function ChapterWordsCard() {
  const cards = useProgress((s) => s.cards);
  const opened = useJourney((s) => s.opened);
  const rows = useMemo(
    () => wordsByChapter(WORD_CHAPTER.keys(), (id) => WORD_CHAPTER.get(id), cards, CHAPTERS.map((c) => c.id)),
    [cards],
  );
  return (
    <section className="rounded-3xl bg-white p-4 shadow-sm" data-testid="path-chapters">
      <h2 className="font-bold">Слова по главам</h2>
      <div className="mt-2 flex flex-col gap-2.5">
        {rows.map((r) => {
          const ch = CHAPTERS.find((c) => c.id === r.chapter)!;
          const shut = r.chapter > opened;
          const total = Math.max(1, r.total);
          return (
            <div key={r.chapter} data-testid="path-chapter" data-chapter={r.chapter} className={shut ? 'opacity-50' : ''}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-semibold">
                  {shut ? '🔒 ' : ''}
                  {ch.roman}. {ch.land}
                </span>
                <span className="tabular-nums text-stone-600" data-testid="path-chapter-value">
                  {r.learned} / {r.total}
                </span>
              </div>
              <div className="relative mt-1 h-3 overflow-hidden rounded bg-wood p-[2px]">
                <div className="absolute inset-y-[2px] left-[2px] rounded-sm bg-gold/45" style={{ width: `${(r.learned / total) * 100}%` }} />
                <div className="absolute inset-y-[2px] left-[2px] rounded-sm bg-gold" style={{ width: `${(r.solid / total) * 100}%` }} />
              </div>
              {r.learned > 0 && <div className="mt-0.5 text-xs text-stone-500 tabular-nums">закреплено {r.solid}</div>}
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-sm text-stone-500">Светлая часть — выучено, яркая — закреплено (повтор не раньше чем через три недели).</p>
    </section>
  );
}

/** Подпись слабого места: слово с переводом, фраза или название урока правила. */
function useWeakLabels(items: WeakItem[]): Record<string, string> {
  const [labels, setLabels] = useState<Record<string, string>>({});
  useEffect(() => {
    let alive = true;
    const ids = items.map((w) => w.itemId);
    const rules = ids.filter(isRuleId);
    const phrases = ids.filter(isPhraseId);
    const words = ids.filter((id) => !isRuleId(id) && !isPhraseId(id));
    Promise.all([wordsByIds(words), phrasesByIds(phrases)]).then(([ws, ps]) => {
      if (!alive) return;
      const out: Record<string, string> = {};
      for (const w of ws) out[w.id] = `${w.es} — ${w.ru}`;
      for (const p of ps) out[p.id] = `${p.es} — ${p.ru}`;
      for (const id of rules) {
        const lesson = GRAMMAR.find((l) => l.id === lessonOfExercise(exerciseOf(id)));
        out[id] = lesson ? `Правило: ${lesson.title}` : 'Правило';
      }
      setLabels(out);
    });
    return () => {
      alive = false;
    };
  }, [items]);
  return labels;
}

function WeakSpots({ rows, now }: { rows: AnswerRecord[]; now: number }) {
  const cards = useProgress((s) => s.cards);
  const weak = useMemo(() => weakItems(rows, now, (id) => id in cards), [rows, now, cards]);
  const top = useMemo(() => weak.slice(0, PATH_WEAK), [weak]);
  const labels = useWeakLabels(top);
  const done = useErrands((s) => s.mistakes) === dayNumber(now);
  const plan = mistakesPlan(weak);
  const nav = useNavigate();
  return (
    <section className="rounded-3xl bg-white p-4 shadow-sm" data-testid="path-weak">
      <h2 className="font-bold">Слабые места</h2>
      {!top.length ? (
        <p className="mt-1 text-sm text-stone-500">За последние {MISTAKES_DAYS} дней ошибок почти нет.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {top.map((w) => (
            <li key={w.itemId} className="rounded-xl bg-stone-50 px-3 py-2" data-testid="path-weak-item" data-id={w.itemId}>
              <div className="leading-snug">{labels[w.itemId] ?? '…'}</div>
              <div className="text-xs text-stone-500 tabular-nums">
                {[w.wrong && `ошибок ${w.wrong}`, w.almost && `«почти» ${w.almost}`, w.slow && `долго думали ${w.slow}`].filter(Boolean).join(' · ')}
              </div>
            </li>
          ))}
        </ul>
      )}
      {plan && !done && (
        <Button className="mt-3 w-full" onClick={() => nav('/mistakes')} data-testid="path-weak-fix">
          Разобрать
        </Button>
      )}
      {plan && done && <p className="mt-2 text-sm text-stone-500">Сегодня ошибки уже разобраны, Летописец ждёт завтра.</p>}
      {!plan && top.length > 0 && <p className="mt-2 text-sm text-stone-500">Разбор начнётся, когда слабых мест наберётся хотя бы {MISTAKES_FLOOR}.</p>}
    </section>
  );
}
