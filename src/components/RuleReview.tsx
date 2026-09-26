import { useEffect, useRef, useState } from 'react';
import { ECONOMY, XP } from '../config';
import type { GrammarExercise } from '../content/schema';
import { logAnswer } from '../db/answers';
import { answerMs } from '../domain/answerLog';
import { seeded } from '../domain/generators';
import { toItem } from '../domain/grammar';
import type { Grade } from '../domain/srs';
import { afterPaint } from '../lib/afterPaint';
import { speak } from '../audio/tts';
import { useCity } from '../store/city';
import { useProgress } from '../store/progress';
import { fillGap, GrammarItemView } from './exercises/GrammarItem';
import { type Feedback, FeedbackSheet } from './FeedbackSheet';

export interface RuleResult {
  /** Оценки для карточек правил: верно — 4, неверно — 1. */
  grades: Record<string, Grade>;
  correct: number;
  wrong: number;
  xp: number;
  coins: number;
}

export const EMPTY_RULES: RuleResult = { grades: {}, correct: 0, wrong: 0, xp: 0, coins: 0 };

const rng = seeded(Date.now());

/**
 * Повторение правил: упражнения грамматики, которые пора вспомнить, по одному разу, без повтора ошибок
 * (ошибка и так вернёт правило завтра). Ответы пишутся в журнал с режимом `review`.
 */
export function RuleReview({ rules, onFinish, onExit }: {
  rules: { cardId: string; ex: GrammarExercise }[];
  onFinish(r: RuleResult): void;
  onExit(r: RuleResult): void;
}) {
  const [items] = useState(() => rules.map((r) => ({ cardId: r.cardId, item: toItem(r.ex, rng) })));
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [fb, setFb] = useState<Feedback | null>(null);
  const [res, setRes] = useState<RuleResult>(EMPTY_RULES);
  const shownAt = useRef(Date.now());
  useEffect(() => {
    shownAt.current = Date.now();
  }, [index]);

  const { cardId, item } = items[index];

  const pick = (i: number) => {
    if (picked !== null) return;
    const ok = i === item.answer;
    const ex = item.ex;
    const right = item.options[item.answer];
    const answer = ex.kind === 'gap' ? fillGap(ex.sentence, right) : ex.kind === 'choose' ? right : undefined;
    setPicked(i);
    setFb({
      verdict: ok ? 'correct' : 'wrong',
      title: ok ? 'Верно!' : ex.kind === 'truefalse' ? `Неверно, правильно: ${right.toLowerCase()}` : 'Неверно',
      answer,
      note: ex.explain,
      speakText: ex.kind === 'truefalse' ? undefined : answer,
    });
    const now = Date.now();
    logAnswer({ itemId: cardId, kind: `grammar-${ex.kind}`, verdict: ok ? 'correct' : 'wrong', mode: 'review', ms: answerMs(shownAt.current, now) }, now);
    const xp = ok ? XP.correct : 0;
    const coins = ok ? ECONOMY.coinPerCorrect : 0;
    setRes((r) => ({
      grades: { ...r.grades, [cardId]: ok ? 4 : 1 },
      correct: r.correct + (ok ? 1 : 0),
      wrong: r.wrong + (ok ? 0 : 1),
      xp: r.xp + xp,
      coins: r.coins + coins,
    }));
    afterPaint(() => {
      if (ok && answer && ex.kind !== 'truefalse') speak(answer);
      useProgress.getState().addXp(xp);
      useCity.getState().addCoins(coins);
    });
  };

  const next = () => {
    setFb(null);
    setPicked(null);
    if (index + 1 >= items.length) onFinish(res);
    else setIndex(index + 1);
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-6" data-testid="rule-review">
      <div className="flex h-14 items-center gap-3">
        <button type="button" aria-label="Выйти" onClick={() => onExit(res)} className="press h-10 w-10 rounded-full text-xl text-stone-500">
          ✕
        </button>
        <div className="h-3.5 flex-1 overflow-hidden rounded bg-wood p-[2px]">
          <div
            className="h-full w-full origin-left rounded-sm bg-gold"
            style={{ transform: `scaleX(${index / items.length})`, transition: 'transform 200ms ease-out' }}
          />
        </div>
      </div>
      <div className="font-pixel text-xs tracking-widest text-amber-700 uppercase">Правило · {index + 1} из {items.length}</div>
      <div key={item.id} className={`flex flex-1 flex-col pt-2 ${fb ? 'pb-64' : ''}`}>
        <GrammarItemView item={item} picked={picked} onPick={pick} />
      </div>
      <FeedbackSheet fb={fb} onNext={next} />
    </div>
  );
}
