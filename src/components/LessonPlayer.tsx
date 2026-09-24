import { useState } from 'react';
import { ECONOMY, XP } from '../config';
import type { Word } from '../content/schema';
import { afterPaint } from '../lib/afterPaint';
import { speak } from '../audio/tts';
import { seeded } from '../domain/generators';
import {
  type Outcome, type SessionState, type Step,
  advance, isFinished, makeStep, recordAnswer, startSession,
} from '../domain/lessonQueue';
import { useCity } from '../store/city';
import { useProgress } from '../store/progress';
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

export function LessonPlayer({ steps, words, pool, onFinish, onExit }: Props) {
  const [session, setSession] = useState(() => startSession(steps));
  const [fb, setFb] = useState<Feedback | null>(null);
  const [totals, setTotals] = useState<LessonTotals>({ xp: 0, coins: 0 });

  const step = session.steps[session.index];

  const retry = (s: Step): Step | null => {
    if (s.kind === 'match' || s.kind === 'intro') return null;
    return makeStep(s.kind, words[s.wordId], pool, rng);
  };

  const answer = (o: Outcome, extra?: Partial<Feedback>) => {
    // Сначала визуальный ответ.
    const f = { ...defaultFeedback(step, words, o), ...extra };
    setFb(f);
    setSession((s) => recordAnswer(s, o, retry));
    const xp = o.verdict === 'correct' ? XP.correct : o.verdict === 'almost' ? XP.almost : 0;
    const coins = o.verdict === 'wrong' ? 0 : ECONOMY.coinPerCorrect;
    setTotals((t) => ({ xp: t.xp + xp, coins: t.coins + coins }));
    // Звук и запись после кадра.
    afterPaint(() => {
      if (f.speakText && o.verdict !== 'wrong') speak(f.speakText);
      useProgress.getState().addXp(xp);
      useCity.getState().addCoins(coins);
    });
  };

  const next = () => {
    const s = advance(session);
    setFb(null);
    setSession(s);
    if (isFinished(s)) onFinish(s, totals);
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
      body = <Choice step={step} words={words} locked={locked} onAnswer={answer} />;
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
      body = <TypeAnswer step={step} words={words} locked={locked} onAnswer={answer} />;
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
        <div className="h-3 flex-1 overflow-hidden rounded-full bg-stone-200">
          <div
            className="h-full w-full origin-left rounded-full bg-brand"
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
