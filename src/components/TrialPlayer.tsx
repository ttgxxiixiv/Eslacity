import { useEffect, useRef, useState } from 'react';
import type { Phrase, Word } from '../content/schema';
import { logAnswer } from '../db/answers';
import { pauseListening, speak } from '../audio/tts';
import { answerMs, isListening, type AnswerMode } from '../domain/answerLog';
import type { CheckResult, Verdict } from '../domain/answer';
import { checkGrammar, type GrammarInput } from '../domain/grammar';
import { withoutListening, type Outcome } from '../domain/lessonQueue';
import { isTypedItem, type TrialItem } from '../domain/trial';
import { afterPaint } from '../lib/afterPaint';
import { useMotivation } from '../store/motivation';
import { defaultFeedback } from './LessonPlayer';
import { phraseFeedback, PhraseTiles, PhraseType } from './PhraseRun';
import { Choice } from './exercises/Choice';
import { grammarFeedback, GrammarItemView } from './exercises/GrammarItem';
import { Scramble } from './exercises/Scramble';
import { TypeAnswer } from './exercises/TypeAnswer';
import { type Feedback, FeedbackSheet } from './FeedbackSheet';

export interface TrialScore {
  correct: number;
  almost: number;
  wrong: number;
}

let seq = 0;

/**
 * Задания испытания места или стража по одному: слова — заданиями уроков, фразы — плитками и вводом, грамматика —
 * упражнениями уроков. Без повторов ошибок и без подсказки букв ответа. Ответы идут в журнал с режимом `trial`.
 */
export function TrialPlayer({ items: initial, words, phrases = {}, label = 'Испытание', mode = 'trial', aside, onAnswer, onFinish, onExit }: {
  items: TrialItem[];
  words: Record<string, Word>;
  phrases?: Record<string, Phrase>;
  label?: string;
  mode?: AnswerMode;
  /** Кнопка справа от подписи (у Сфинкса — перечитать текст загадки). */
  aside?: React.ReactNode;
  /** Каждый ответ: id карточки (слово, `g:<упражнение>`, фраза) и итог. */
  onAnswer?(itemId: string, verdict: Verdict): void;
  onFinish(s: TrialScore): void;
  onExit(): void;
}) {
  const [items, setItems] = useState(() => initial.map((it) => ({ ...it, key: ++seq })));
  const [index, setIndex] = useState(0);
  const [fb, setFb] = useState<Feedback | null>(null);
  const [score, setScore] = useState<TrialScore>({ correct: 0, almost: 0, wrong: 0 });
  const shownAt = useRef(Date.now());
  useEffect(() => {
    shownAt.current = Date.now();
  }, [index]);

  const item = items[index];
  const record = (verdict: Verdict, f: Feedback, itemId: string, kind: string) => {
    setFb({ ...f, itemId });
    setScore((s) => ({ ...s, [verdict]: s[verdict] + 1 }));
    const now = Date.now();
    logAnswer({ itemId, kind, verdict, mode, ms: answerMs(shownAt.current, now), why: f.why }, now);
    onAnswer?.(itemId, verdict);
    afterPaint(() => {
      if (f.speakText && verdict !== 'wrong') speak(f.speakText);
      if (isTypedItem(item)) useMotivation.getState().recordTyped(verdict === 'correct');
      if (item.kind === 'word' && isListening(item.step.kind) && verdict === 'correct') useMotivation.getState().recordListening();
    });
  };
  const wordAnswer = (o: Outcome, extra?: Partial<Feedback>) => {
    if (item.kind !== 'word') return;
    const defined = Object.fromEntries(Object.entries(extra ?? {}).filter(([, v]) => v !== undefined));
    const step = item.step as Exclude<typeof item.step, { kind: 'match' | 'intro' }>;
    record(o.verdict, { ...defaultFeedback(step, words, o), ...defined }, step.wordId, step.kind);
  };
  const [grammarVerdict, setGrammarVerdict] = useState<Verdict | null>(null);
  const grammarAnswer = (input: GrammarInput) => {
    if (item.kind !== 'grammar' || grammarVerdict !== null) return;
    const c = checkGrammar(item.item, input);
    setGrammarVerdict(c.verdict);
    record(c.verdict, grammarFeedback(item.item, c, input, 'text'), item.cardId ?? `g:${item.item.ex.id}`, `grammar-${item.item.ex.kind}`);
  };
  const phraseAnswer = (verdict: Verdict, check?: CheckResult) => {
    if (item.kind !== 'phrase') return;
    record(verdict, phraseFeedback(phrases[item.step.id], verdict, check), item.step.id, `phrase-${item.step.kind}`);
  };
  const [picked, setPicked] = useState<number | null>(null);
  const questionAnswer = (i: number) => {
    if (item.kind !== 'question' || fb) return;
    const verdict: Verdict = i === item.answer ? 'correct' : 'wrong';
    setPicked(i);
    record(verdict, { verdict, title: verdict === 'correct' ? 'Верно!' : 'Неверно', answer: item.options[item.answer] }, item.id, 'sphinx-question');
  };
  const next = () => {
    setPicked(null);
    setFb(null);
    setGrammarVerdict(null);
    if (index + 1 >= items.length) onFinish(score);
    else setIndex(index + 1);
  };
  // «Не могу слушать»: оставшиеся задания на слух становятся обычными.
  const cantListen = () => {
    pauseListening();
    const plain = withoutListening(items.filter((it) => it.kind === 'word').map((it) => it.step));
    let i = 0;
    setItems(items.map((it) => (it.kind === 'word' ? { ...it, step: plain[i++] } : it)));
  };

  if (!item) return null;
  const locked = fb !== null;
  let body: React.ReactNode = null;
  if (item.kind === 'word') {
    const step = item.step;
    if (step.kind === 'choice-es-ru' || step.kind === 'choice-ru-es' || step.kind === 'listen-choice') {
      body = <Choice step={step} words={words} locked={locked} onAnswer={wordAnswer} onCantListen={cantListen} />;
    } else if (step.kind === 'scramble') {
      body = <Scramble step={step} words={words} locked={locked} onAnswer={wordAnswer} />;
    } else if (step.kind === 'type' || step.kind === 'listen-type') {
      body = <TypeAnswer step={step} words={words} locked={locked} onAnswer={wordAnswer} onCantListen={cantListen} exam />;
    }
  } else if (item.kind === 'grammar') {
    body = <GrammarItemView item={item.item} verdict={grammarVerdict} onAnswer={grammarAnswer} />;
  } else if (item.kind === 'question') {
    body = (
      <>
        <div className="mt-5 text-xl leading-snug font-bold" data-testid="sphinx-question">
          {item.q}
        </div>
        <div className="mt-5 flex flex-col gap-2">
          {item.options.map((o, i) => (
            <button
              key={i}
              type="button"
              disabled={locked}
              onClick={() => questionAnswer(i)}
              className={`press rounded-2xl border-2 px-4 py-3 text-left text-lg ${
                picked === null ? 'border-stone-300 bg-white' : i === item.answer ? 'border-ok bg-okbg' : i === picked ? 'border-bad bg-badbg' : 'border-stone-200 bg-white opacity-60'
              }`}
            >
              {o}
            </button>
          ))}
        </div>
      </>
    );
  } else if (item.step.kind === 'tiles') {
    body = <PhraseTiles phrase={phrases[item.step.id]} tiles={item.step.tiles} locked={locked} onAnswer={phraseAnswer} />;
  } else {
    body = <PhraseType phrase={phrases[item.step.id]} locked={locked} onAnswer={phraseAnswer} exam />;
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-6" data-testid="trial-run">
      <div className="flex h-14 items-center gap-3">
        <button type="button" aria-label="Выйти из испытания" onClick={onExit} className="press h-10 w-10 rounded-full text-xl text-stone-500">
          ✕
        </button>
        <div className="h-3.5 flex-1 overflow-hidden rounded bg-wood p-[2px]">
          <div
            className="h-full w-full origin-left rounded-sm bg-gold"
            style={{ transform: `scaleX(${index / items.length})`, transition: 'transform 200ms ease-out' }}
          />
        </div>
        <span className="text-sm text-stone-500 tabular-nums" data-testid="trial-progress">
          {index + 1} / {items.length}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className="font-pixel flex-1 text-xs tracking-widest text-amber-700 uppercase">{label}</div>
        {aside}
      </div>
      <div key={item.key} className={`flex flex-1 flex-col pt-2 ${locked ? 'pb-64' : ''}`} data-testid={item.kind === 'phrase' ? 'phrase-run' : undefined}>
        {body}
      </div>
      <FeedbackSheet fb={fb} onNext={next} />
    </div>
  );
}
