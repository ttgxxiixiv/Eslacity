import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ECONOMY, XP } from '../config';
import { hasLesson, loadLesson } from '../content/grammar';
import type { GrammarLesson as Lesson } from '../content/schema';
import {
  answerGrammar, buildGrammarQueue, checkGrammar, grammarScore, rulesForReview, startGrammar, type GrammarInput, type GrammarRun,
} from '../domain/grammar';
import type { Verdict } from '../domain/answer';
import { seeded } from '../domain/generators';
import { afterPaint } from '../lib/afterPaint';
import { speak } from '../audio/tts';
import { useCity } from '../store/city';
import { useProgress } from '../store/progress';
import { syncAndEvaluate } from '../store/motivation';
import { useJourney } from '../store/journey';
import { chapterOfDistrict, isDistrictOpen } from '../domain/chapters';
import { logAnswer } from '../db/answers';
import { answerMs, grammarItemId } from '../domain/answerLog';
import { lessonOfExercise, ruleCardId, isRuleId, exerciseOf } from '../domain/itemId';
import type { MedalGain } from '../domain/medals';
import { MedalLines } from '../components/LessonResult';
import { type Feedback, FeedbackSheet } from '../components/FeedbackSheet';
import { Md } from '../components/Md';
import { grammarFeedback, GrammarItemView } from '../components/exercises/GrammarItem';
import { Button, Loading, Screen, SpeakButton, TopBar } from '../components/ui';

const rng = seeded(Date.now());

type TableBlock = Extract<Lesson['theory'][number], { kind: 'table' }>;

/**
 * Таблица теории. Широкие (спряжение в нескольких временах, от 4 колонок) плотнее, у трёх колонок шрифт и поля
 * чуть меньше, чем у двух. Если таблица всё же не влезла в экран, под ней подсказка, что её можно листать вбок.
 */
function TheoryTable({ table }: { table: TableBlock }) {
  const wide = table.head.length >= 4;
  const dense = table.head.length === 3;
  const cell = wide ? 'px-2.5 py-2' : dense ? 'px-2.5 py-2' : 'px-4 py-2';
  const box = useRef<HTMLDivElement>(null);
  const [scrolls, setScrolls] = useState(wide);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const check = () => setScrolls(el.scrollWidth > el.clientWidth + 1);
    check();
    const obs = new ResizeObserver(check);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div>
      <div ref={box} className="overflow-x-auto rounded-2xl bg-white shadow-sm" data-testid="theory-table">
        {table.caption && <div className="px-4 pt-3 text-sm font-semibold text-stone-500">{table.caption}</div>}
        <table className={`w-full text-left ${wide ? 'text-sm' : dense ? 'text-[14px]' : 'text-[15px]'}`}>
          <thead>
            <tr className="border-b border-stone-200 text-stone-500">
              {table.head.map((h, j) => (
                <th key={j} className={`${cell} font-medium`}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r, j) => (
              <tr key={j} className="border-b border-stone-100 last:border-0">
                {r.cells.map((c, k) => (
                  <td key={k} className={`${cell} ${k === 1 ? 'font-semibold' : ''} ${wide && k > 0 ? 'whitespace-nowrap' : ''}`}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {scrolls && <p className="mt-1 px-2 text-right text-xs text-stone-500">таблицу можно листать вбок →</p>}
    </div>
  );
}

function Theory({ lesson, onStart }: { lesson: Lesson; onStart: () => void }) {
  return (
    <Screen>
      <TopBar title={<span className="font-sans text-lg font-bold tracking-normal normal-case">{lesson.title}</span>} />
      <div className="flex flex-col gap-4 px-5 pb-8 text-[17px] leading-relaxed">
        {lesson.theory.map((b, i) => {
          if (b.kind === 'text') return <Md key={i} text={b.md} />;
          if (b.kind === 'tip') {
            return (
              <div key={i} className="rounded-2xl bg-amber-50 px-4 py-3 text-[15px]">
                <div className="mb-1 text-xs font-bold tracking-wide text-amber-700 uppercase">Запомни</div>
                <Md text={b.md} />
              </div>
            );
          }
          return <TheoryTable key={i} table={b} />;
        })}

        <h2 className="mt-2 font-bold">Примеры</h2>
        <ul className="flex flex-col gap-2">
          {lesson.examples.map((e, i) => (
            <li key={i} className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm">
              <div className="flex-1">
                <div className="font-medium">{e.es}</div>
                <div className="text-[15px] text-stone-500">{e.ru}</div>
              </div>
              <SpeakButton text={e.es} />
            </li>
          ))}
        </ul>
        <Button className="mt-4" onClick={onStart}>
          К упражнениям
        </Button>
      </div>
    </Screen>
  );
}

export function GrammarLessonScreen() {
  const id = useParams().id!;
  const [lesson, setLesson] = useState<Lesson | null | undefined>(undefined);
  const opened = useJourney((s) => s.opened);

  useEffect(() => {
    let alive = true;
    setLesson(undefined);
    if (!hasLesson(id)) {
      setLesson(null);
      return;
    }
    loadLesson(id).then((l) => alive && setLesson(l ?? null));
    return () => {
      alive = false;
    };
  }, [id]);

  // Пока грузится чанк района (обычно доли секунды), экран пустой, как у уроков слов.
  if (lesson === undefined) return <Loading />;
  if (lesson === null) return <div className="p-6">Урок не найден</div>;
  if (!isDistrictOpen(lesson.district, opened)) {
    return (
      <Screen>
        <TopBar title={lesson.title} />
        <p className="px-5 py-6 text-stone-600" data-testid="district-lock">
          Этот урок откроется в главе {chapterOfDistrict(lesson.district)?.roman}.
        </p>
      </Screen>
    );
  }
  return <LessonRunner key={lesson.id} lesson={lesson} />;
}

function LessonRunner({ lesson }: { lesson: Lesson }) {
  const nav = useNavigate();
  const [phase, setPhase] = useState<'theory' | 'practice' | 'done'>('theory');
  const initial = useMemo(() => startGrammar(buildGrammarQueue(lesson.exercises, rng)), [lesson]);
  const [run, setRun] = useState<GrammarRun>(initial);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [fb, setFb] = useState<Feedback | null>(null);
  const [earned, setEarned] = useState({ xp: 0, coins: 0 });
  const [ach, setAch] = useState<MedalGain[]>([]);
  const shownAt = useRef(Date.now());
  // Упражнения, где ошиблись с первой попытки: они пойдут в повторение.
  const wrongFirst = useRef(new Set<string>());
  const itemKey = run.queue[run.index]?.id;
  useEffect(() => {
    shownAt.current = Date.now();
  }, [itemKey, phase]);

  if (phase === 'theory') {
    const start = () => {
      // После «Перечитать теорию» очередь уже пройдена: начинаем заново.
      if (run.index >= run.queue.length) {
        setRun(startGrammar(buildGrammarQueue(lesson.exercises, rng)));
        wrongFirst.current = new Set();
        setEarned({ xp: 0, coins: 0 });
        setAch([]);
      }
      setPhase('practice');
    };
    return <Theory lesson={lesson} onStart={start} />;
  }

  if (phase === 'done') {
    const score = grammarScore(run);
    return (
      <Screen className="px-5 py-8">
        <h1 className="text-2xl font-bold">Урок пройден</h1>
        <p className="mt-1 text-stone-500">{lesson.title}</p>
        <div className="mt-6 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-2xl bg-white p-3 shadow-sm">
            <div className="text-2xl font-bold">{score}%</div>
            <div className="text-sm text-stone-500">с первой попытки</div>
          </div>
          <div className="rounded-2xl bg-white p-3 shadow-sm">
            <div className="text-2xl font-bold">+{earned.xp}</div>
            <div className="text-sm text-stone-500">XP</div>
          </div>
          <div className="rounded-2xl bg-white p-3 shadow-sm">
            <div className="text-2xl font-bold">+{earned.coins}</div>
            <div className="text-sm text-stone-500">монет</div>
          </div>
        </div>
        <MedalLines list={ach} />
        <div className="flex-1" />
        <Button className="mt-8" onClick={() => nav('/grammar', { replace: true })}>
          Готово
        </Button>
        <Button variant="ghost" className="mt-2" onClick={() => setPhase('theory')}>
          Перечитать теорию
        </Button>
      </Screen>
    );
  }

  const item = run.queue[run.index];

  const pick = (input: GrammarInput) => {
    if (verdict !== null) return;
    const c = checkGrammar(item, input);
    // «Почти» (форма без ударения) засчитывается, как в уроках слов.
    const ok = c.verdict !== 'wrong';
    setVerdict(c.verdict);
    const ex = item.ex;
    const spoken = c.speak;
    const f = grammarFeedback(item, c, input);
    setFb({ ...f, itemId: `g:${item.ex.id}` });
    setRun(answerGrammar(run, ok, rng));
    if (!ok && !item.retry) wrongFirst.current.add(ex.id);
    const now = Date.now();
    logAnswer(
      {
        itemId: grammarItemId(ex.id),
        kind: `grammar-${ex.kind}`,
        verdict: c.verdict,
        mode: 'grammar',
        ms: answerMs(shownAt.current, now),
        why: f.why,
      },
      now,
    );
    const firstTry = ok && !item.retry;
    const xp = firstTry ? XP.correct : 0;
    const coins = firstTry ? ECONOMY.coinPerCorrect : 0;
    setEarned((e) => ({ xp: e.xp + xp, coins: e.coins + coins }));
    afterPaint(() => {
      if (ok && spoken) speak(spoken);
      useProgress.getState().addXp(xp);
      useCity.getState().addCoins(coins);
    });
  };

  const next = () => {
    const nextIndex = run.index + 1;
    setFb(null);
    setVerdict(null);
    if (nextIndex >= run.queue.length) {
      const progress = useProgress.getState();
      const first = progress.completeGrammar(lesson.id, grammarScore(run));
      // Правила в повторение: ошибки и случайные до трёх карточек на урок.
      const already = new Set(
        Object.keys(progress.cards).filter((id) => isRuleId(id)).map(exerciseOf).filter((e) => lessonOfExercise(e) === lesson.id),
      );
      const picks = rulesForReview(lesson.exercises, wrongFirst.current, already, rng);
      if (picks.length) progress.applyGrades(Object.fromEntries(picks.map((p) => [ruleCardId(p.exerciseId), p.grade])));
      const bonus = first ? ECONOMY.grammarBonus : 0;
      useCity.getState().addCoins(bonus);
      setEarned((e) => ({ ...e, coins: e.coins + bonus }));
      setRun({ ...run, index: nextIndex });
      setAch(syncAndEvaluate(Date.now(), { perfectLesson: run.firstTry === run.total, lessonAt: Date.now() }));
      setPhase('done');
      return;
    }
    setRun({ ...run, index: nextIndex });
  };

  const progress = run.index / run.queue.length;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-6">
      <div className="flex h-14 items-center gap-3">
        <button type="button" aria-label="Выйти" onClick={() => nav(-1)} className="press h-10 w-10 rounded-full text-xl text-stone-500">
          ✕
        </button>
        <div className="h-3.5 flex-1 overflow-hidden rounded bg-wood p-[2px]">
          <div
            className="h-full w-full origin-left rounded-sm bg-gold"
            style={{ transform: `scaleX(${progress})`, transition: 'transform 200ms ease-out' }}
          />
        </div>
      </div>
      <div key={item.id} className={`flex flex-1 flex-col pt-2 ${fb ? 'pb-64' : ''}`}>
        <GrammarItemView item={item} verdict={verdict} onAnswer={pick} />
      </div>
      <FeedbackSheet fb={fb} onNext={next} />
    </div>
  );
}
