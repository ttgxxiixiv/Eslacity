import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ECONOMY, XP } from '../config';
import { GRAMMAR_BY_ID } from '../content/grammar';
import type { GrammarLesson as Lesson } from '../content/schema';
import {
  answerGrammar, buildGrammarQueue, grammarScore, startGrammar, type GrammarItem, type GrammarRun,
} from '../domain/grammar';
import { seeded } from '../domain/generators';
import { afterPaint } from '../lib/afterPaint';
import { speak } from '../audio/tts';
import { useCity } from '../store/city';
import { useProgress } from '../store/progress';
import { useMotivation } from '../store/motivation';
import type { Achievement } from '../domain/achievements';
import { AchievementLines } from '../components/LessonResult';
import { type Feedback, FeedbackSheet } from '../components/FeedbackSheet';
import { Md } from '../components/Md';
import { Button, Screen, SpeakButton, TopBar } from '../components/ui';

const rng = seeded(Date.now());

function Theory({ lesson, onStart }: { lesson: Lesson; onStart: () => void }) {
  return (
    <Screen>
      <TopBar title={lesson.title} />
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
          return (
            <div key={i} className="overflow-x-auto rounded-2xl bg-white shadow-sm">
              {b.caption && <div className="px-4 pt-3 text-sm font-semibold text-stone-500">{b.caption}</div>}
              <table className="w-full text-left text-[15px]">
                <thead>
                  <tr className="border-b border-stone-200 text-stone-500">
                    {b.head.map((h, j) => (
                      <th key={j} className="px-4 py-2 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {b.rows.map((r, j) => (
                    <tr key={j} className="border-b border-stone-100 last:border-0">
                      {r.cells.map((c, k) => (
                        <td key={k} className={`px-4 py-2 ${k === 1 ? 'font-semibold' : ''}`}>
                          {c}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
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

function fillGap(sentence: string, word: string) {
  return sentence.replace('___', word);
}

function ItemView({ item, picked, onPick }: { item: GrammarItem; picked: number | null; onPick: (i: number) => void }) {
  const { ex } = item;
  const shownWord = picked === null ? null : item.options[picked];
  return (
    <div className="flex flex-1 flex-col">
      <div className="text-sm font-medium text-stone-500">
        {ex.kind === 'choose' ? 'Выберите форму' : ex.kind === 'gap' ? 'Заполните пропуск' : 'Верно или неверно?'}
      </div>
      <div className="mt-5 text-2xl leading-snug font-bold">
        {ex.kind === 'choose' && ex.prompt}
        {ex.kind === 'truefalse' && ex.statement}
        {ex.kind === 'gap' &&
          ex.sentence.split('___').map((part, i) => (
            <span key={i}>
              {i > 0 && (
                <span
                  className={`mx-1 inline-block min-w-16 border-b-4 text-center ${
                    shownWord === null ? 'border-stone-300' : picked === item.answer ? 'border-ok text-ok' : 'border-bad text-bad'
                  }`}
                >
                  {shownWord ?? ' '}
                </span>
              )}
              {part}
            </span>
          ))}
      </div>
      {'ru' in ex && ex.ru && <div className="mt-2 text-stone-500">{ex.ru}</div>}
      <div className={`mt-8 grid gap-3 ${ex.kind === 'truefalse' ? 'grid-cols-2' : ''}`}>
        {item.options.map((o, i) => {
          let cls = 'bg-white border-stone-300';
          if (picked !== null) {
            if (i === item.answer) cls = 'bg-okbg border-ok text-ok';
            else if (i === picked) cls = 'bg-badbg border-bad text-bad';
            else cls = 'bg-white border-stone-200 opacity-60';
          }
          return (
            <button
              key={i}
              type="button"
              onClick={() => onPick(i)}
              className={`press min-h-14 rounded-2xl border-2 px-4 py-3 text-lg font-medium ${ex.kind === 'truefalse' ? 'text-center' : 'text-left'} ${cls}`}
            >
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function GrammarLessonScreen() {
  const id = useParams().id!;
  const nav = useNavigate();
  const lesson = GRAMMAR_BY_ID[id];
  const [phase, setPhase] = useState<'theory' | 'practice' | 'done'>('theory');
  const initial = useMemo(() => (lesson ? startGrammar(buildGrammarQueue(lesson.exercises, rng)) : null), [lesson]);
  const [run, setRun] = useState<GrammarRun | null>(initial);
  const [picked, setPicked] = useState<number | null>(null);
  const [fb, setFb] = useState<Feedback | null>(null);
  const [earned, setEarned] = useState({ xp: 0, coins: 0 });
  const [ach, setAch] = useState<Achievement[]>([]);

  if (!lesson || !run) return <div className="p-6">Урок не найден</div>;
  if (phase === 'theory') return <Theory lesson={lesson} onStart={() => setPhase('practice')} />;

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
        <AchievementLines list={ach} />
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

  const pick = (i: number) => {
    if (picked !== null) return;
    const ok = i === item.answer;
    setPicked(i);
    const ex = item.ex;
    const right = item.options[item.answer];
    const answer = ex.kind === 'gap' ? fillGap(ex.sentence, right) : ex.kind === 'choose' ? right : undefined;
    const spoken = ex.kind === 'truefalse' ? undefined : answer;
    setFb({
      verdict: ok ? 'correct' : 'wrong',
      title: ok ? 'Верно!' : ex.kind === 'truefalse' ? `Неверно, правильно: ${right.toLowerCase()}` : 'Неверно',
      answer,
      note: ex.explain,
      speakText: spoken,
    });
    setRun(answerGrammar(run, ok, rng));
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
    setPicked(null);
    if (nextIndex >= run.queue.length) {
      const first = useProgress.getState().completeGrammar(lesson.id, grammarScore(run));
      const bonus = first ? ECONOMY.grammarBonus : 0;
      useCity.getState().addCoins(bonus);
      setEarned((e) => ({ ...e, coins: e.coins + bonus }));
      setRun({ ...run, index: nextIndex });
      setAch(useMotivation.getState().evaluate());
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
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-stone-200">
          <div
            className="h-full w-full origin-left rounded-full bg-brand"
            style={{ transform: `scaleX(${progress})`, transition: 'transform 200ms ease-out' }}
          />
        </div>
      </div>
      <div key={item.id} className={`flex flex-1 flex-col pt-2 ${fb ? 'pb-64' : ''}`}>
        <ItemView item={item} picked={picked} onPick={pick} />
      </div>
      <FeedbackSheet fb={fb} onNext={next} />
    </div>
  );
}
