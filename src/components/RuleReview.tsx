import { useEffect, useRef, useState } from 'react';
import { ECONOMY, XP } from '../config';
import type { GrammarExercise } from '../content/schema';
import { logAnswer } from '../db/answers';
import { answerMs } from '../domain/answerLog';
import { seeded } from '../domain/generators';
import { checkGrammar, toItem, type GrammarInput } from '../domain/grammar';
import type { Verdict } from '../domain/answer';
import type { Grade } from '../domain/srs';
import { afterPaint } from '../lib/afterPaint';
import { speak } from '../audio/tts';
import { useCity } from '../store/city';
import { useProgress } from '../store/progress';
import { grammarFeedback, GrammarItemView } from './exercises/GrammarItem';
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
 * (ошибка и так вернёт правило завтра). Ответы пишутся в журнал с режимом `review`. Им же проходится
 * поручение «Эхо»: `label` — подпись над заданием, `logKind` — вид задания в журнале.
 */
export function RuleReview({ rules, onFinish, onExit, label = 'Правило', logKind = 'grammar' }: {
  rules: { cardId: string; ex: GrammarExercise }[];
  onFinish(r: RuleResult): void;
  onExit(r: RuleResult): void;
  label?: string;
  logKind?: string;
}) {
  const [items] = useState(() => rules.map((r) => ({ cardId: r.cardId, item: toItem(r.ex, rng) })));
  const [index, setIndex] = useState(0);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [fb, setFb] = useState<Feedback | null>(null);
  const [res, setRes] = useState<RuleResult>(EMPTY_RULES);
  const shownAt = useRef(Date.now());
  useEffect(() => {
    shownAt.current = Date.now();
  }, [index]);

  const { cardId, item } = items[index];

  const pick = (input: GrammarInput) => {
    if (verdict !== null) return;
    const c = checkGrammar(item, input);
    const ok = c.verdict !== 'wrong';
    const ex = item.ex;
    const answer = c.speak;
    setVerdict(c.verdict);
    setFb({ ...grammarFeedback(item, c), itemId: cardId });
    const now = Date.now();
    logAnswer({ itemId: cardId, kind: `${logKind}-${ex.kind}`, verdict: c.verdict, mode: 'review', ms: answerMs(shownAt.current, now) }, now);
    const xp = ok ? XP.correct : 0;
    const coins = ok ? ECONOMY.coinPerCorrect : 0;
    setRes((r) => ({
      // Форма без ударения — «почти»: правило помнится, но хуже.
      grades: { ...r.grades, [cardId]: c.verdict === 'correct' ? 4 : ok ? 3 : 1 },
      correct: r.correct + (ok ? 1 : 0),
      wrong: r.wrong + (ok ? 0 : 1),
      xp: r.xp + xp,
      coins: r.coins + coins,
    }));
    afterPaint(() => {
      if (ok && answer) speak(answer);
      useProgress.getState().addXp(xp);
      useCity.getState().addCoins(coins);
    });
  };

  const next = () => {
    setFb(null);
    setVerdict(null);
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
      <div className="font-pixel text-xs tracking-widest text-amber-700 uppercase">{label} · {index + 1} из {items.length}</div>
      <div key={item.id} className={`flex flex-1 flex-col pt-2 ${fb ? 'pb-64' : ''}`}>
        <GrammarItemView item={item} verdict={verdict} onAnswer={pick} />
      </div>
      <FeedbackSheet fb={fb} onNext={next} />
    </div>
  );
}
