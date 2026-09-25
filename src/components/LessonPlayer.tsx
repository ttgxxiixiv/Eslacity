import { useEffect, useRef, useState } from 'react';
import { ECONOMY, XP } from '../config';
import type { Word } from '../content/schema';
import { afterPaint } from '../lib/afterPaint';
import { pauseListening, speak } from '../audio/tts';
import { seeded } from '../domain/generators';
import {
  type Outcome, type SessionState, type Step,
  advance, isFinished, isTyped, makeStep, recordAnswer, startSession, withoutListening,
} from '../domain/lessonQueue';
import { useCity } from '../store/city';
import { useProgress } from '../store/progress';
import { useMotivation } from '../store/motivation';
import { logAnswer } from '../db/answers';
import { type AnswerMode, answerMs, isListening } from '../domain/answerLog';
import { BuildPhrase } from './exercises/BuildPhrase';
import { Choice } from './exercises/Choice';
import { Intro } from './exercises/Intro';
import { MatchPairs } from './exercises/MatchPairs';
import { Scramble } from './exercises/Scramble';
import { TypeAnswer } from './exercises/TypeAnswer';
import { type Feedback, FeedbackSheet } from './FeedbackSheet';
import { genderLabel } from './ui';

export interface LessonTotals {
  xp: number;
  coins: number;
}

interface Props {
  steps: Step[];
  words: Record<string, Word>;
  pool: Word[];
  /** Для журнала ответов: урок, тренировка или повторение. */
  mode: AnswerMode;
  onFinish(s: SessionState, totals: LessonTotals): void;
  onExit(s: SessionState): void;
}

const TITLES = { correct: 'Верно!', almost: 'Почти', wrong: 'Неверно' } as const;

const rng = seeded(Date.now());

function defaultFeedback(step: Step, words: Record<string, Word>, o: Outcome): Feedback {
  if (step.kind === 'match') return { verdict: o.verdict, title: TITLES[o.verdict] };
  const w = words[(step as { wordId: string }).wordId];
  const g = w.gender ? `, ${genderLabel(w.gender)}` : '';
  return { verdict: o.verdict, title: TITLES[o.verdict], answer: w.es, sub: `${w.ru}${g}`, speakText: w.es };
}

export function LessonPlayer({ steps, words, pool, mode, onFinish, onExit }: Props) {
  const [session, setSession] = useState(() => startSession(steps));
  const [fb, setFb] = useState<Feedback | null>(null);
  const [totals, setTotals] = useState<LessonTotals>({ xp: 0, coins: 0 });
  const finished = useRef(false);

  const step = session.steps[session.index];
  // Когда показано текущее задание: время ответа идёт в журнал.
  const shownAt = useRef(Date.now());
  useEffect(() => {
    shownAt.current = Date.now();
  }, [step?.id]);

  const retry = (s: Step): Step | null => {
    if (s.kind === 'match' || s.kind === 'intro') return null;
    return makeStep(s.kind, words[s.wordId], pool, rng);
  };

  const answer = (o: Outcome, extra?: Partial<Feedback>) => {
    // Сначала визуальный ответ.
    // Поля extra со значением undefined не должны затирать стандартные (например, заголовок «Верно!»).
    const defined = Object.fromEntries(Object.entries(extra ?? {}).filter(([, v]) => v !== undefined));
    const f = { ...defaultFeedback(step, words, o), ...defined };
    setFb(f);
    setSession((s) => recordAnswer(s, o, retry));
    const now = Date.now();
    const ms = answerMs(shownAt.current, now);
    if (step.kind === 'match') {
      for (const id of step.wordIds) logAnswer({ itemId: id, kind: 'match', verdict: o.perWord?.[id] ?? o.verdict, mode, ms }, now);
    } else if (step.kind !== 'intro') {
      logAnswer({ itemId: step.wordId, kind: step.kind, verdict: o.verdict, mode, ms }, now);
    }
    const xp = o.verdict === 'correct' ? XP.correct : o.verdict === 'almost' ? XP.almost : 0;
    const coins = o.verdict === 'wrong' ? 0 : ECONOMY.coinPerCorrect;
    setTotals((t) => ({ xp: t.xp + xp, coins: t.coins + coins }));
    // Звук и запись после кадра.
    afterPaint(() => {
      if (f.speakText && o.verdict !== 'wrong') speak(f.speakText);
      useProgress.getState().addXp(xp);
      useCity.getState().addCoins(coins);
      if (isTyped(step.kind)) useMotivation.getState().recordTyped(o.verdict === 'correct');
      if (isListening(step.kind) && o.verdict === 'correct') useMotivation.getState().recordListening();
    });
  };

  const next = () => {
    const s = advance(session);
    setFb(null);
    setSession(s);
    if (isFinished(s) && !finished.current) {
      finished.current = true;
      onFinish(s, totals);
    }
  };

  // «Не могу слушать»: оставшиеся задания на слух становятся обычными, на час вперёд тоже.
  const cantListen = () => {
    pauseListening();
    setSession((s) => ({ ...s, steps: withoutListening(s.steps) }));
  };

  if (!step) return null;

  const progress = Math.min(1, session.index / session.steps.length);
  const locked = fb !== null;

  let body: React.ReactNode;
  switch (step.kind) {
    case 'intro':
      body = <Intro word={words[step.wordId]} onNext={next} />;
      break;
    case 'choice-es-ru':
    case 'choice-ru-es':
    case 'listen-choice':
      body = <Choice step={step} words={words} locked={locked} onAnswer={answer} onCantListen={cantListen} />;
      break;
    case 'scramble':
      body = <Scramble step={step} words={words} locked={locked} onAnswer={answer} />;
      break;
    case 'phrase':
      body = <BuildPhrase step={step} words={words} locked={locked} onAnswer={answer} />;
      break;
    case 'match':
      body = <MatchPairs step={step} words={words} locked={locked} onAnswer={answer} />;
      break;
    case 'type':
    case 'listen-type':
      body = <TypeAnswer step={step} words={words} locked={locked} onAnswer={answer} onCantListen={cantListen} />;
      break;
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-6">
      <div className="flex h-14 items-center gap-3">
        <button
          type="button"
          aria-label="Выйти из урока"
          onClick={() => onExit(session)}
          className="press h-10 w-10 rounded-full text-xl text-stone-500"
        >
          ✕
        </button>
        <div className="h-3.5 flex-1 overflow-hidden rounded bg-wood p-[2px]">
          <div
            className="h-full w-full origin-left rounded-sm bg-gold"
            style={{ transform: `scaleX(${progress})`, transition: 'transform 200ms ease-out' }}
          />
        </div>
      </div>
      <div key={step.id} className={`flex flex-1 flex-col pt-2 ${locked ? 'pb-56' : ''}`}>
        {body}
      </div>
      <FeedbackSheet fb={fb} onNext={next} />
    </div>
  );
}
