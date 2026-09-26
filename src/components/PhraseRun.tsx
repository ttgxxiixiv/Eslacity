import { useEffect, useRef, useState } from 'react';
import { ECONOMY, XP } from '../config';
import type { Phrase } from '../content/schema';
import { logAnswer } from '../db/answers';
import { checkPhrase, normalize, type CheckResult, type Verdict } from '../domain/answer';
import { answerMs, type AnswerMode } from '../domain/answerLog';
import { seeded } from '../domain/generators';
import { fullPhrase } from '../domain/phrase';
import { lowerGrade, makeOptions, makeTiles, type PhraseStep } from '../domain/phraseSteps';
import type { Grade } from '../domain/srs';
import { afterPaint } from '../lib/afterPaint';
import { L, LANG } from '../lang';
import { speak } from '../audio/tts';
import { useCity } from '../store/city';
import { useProgress } from '../store/progress';
import { AccentBar } from './AccentBar';
import { type Feedback, FeedbackSheet } from './FeedbackSheet';
import { Button, SpeakButton } from './ui';

export interface PhraseResult {
  /** Худшая оценка по каждой фразе за сессию. */
  grades: Record<string, Grade>;
  correct: number;
  almost: number;
  wrong: number;
  xp: number;
  coins: number;
}

export const EMPTY_PHRASES: PhraseResult = { grades: {}, correct: 0, almost: 0, wrong: 0, xp: 0, coins: 0 };

const REASON: Record<string, string> = {
  accent: 'Обратите внимание на ударения.',
  typo: 'Небольшая опечатка, фразу поймут.',
};

const rng = seeded(Date.now());
let seq = 0;

/**
 * Прохождение фраз места: знакомство, выбор, сборка из плиток и ввод. В уроке (`learn`) ошибка возвращает
 * задание в конец очереди, в повторении — нет: фраза и так вернётся завтра. Ответы пишутся в журнал.
 */
export function PhraseRun({ steps: initial, phrases, pool, mode, label, onFinish, onExit }: {
  steps: PhraseStep[];
  phrases: Record<string, Phrase>;
  pool: Phrase[];
  mode: AnswerMode;
  label: string;
  onFinish(r: PhraseResult): void;
  onExit(r: PhraseResult): void;
}) {
  const [steps, setSteps] = useState(() => initial.map((s) => ({ ...s, key: ++seq })));
  const [index, setIndex] = useState(0);
  const [fb, setFb] = useState<Feedback | null>(null);
  const [res, setRes] = useState<PhraseResult>(EMPTY_PHRASES);
  const shownAt = useRef(Date.now());
  useEffect(() => {
    shownAt.current = Date.now();
  }, [index]);

  const step = steps[index];
  const phrase = phrases[step.id];

  const answer = (verdict: Verdict, check?: CheckResult) => {
    const typed = step.kind === 'type';
    const now = Date.now();
    logAnswer({ itemId: step.id, kind: `phrase-${step.kind}`, verdict, mode, ms: answerMs(shownAt.current, now) }, now);
    const xp = verdict === 'wrong' ? 0 : XP.correct;
    const coins = verdict === 'correct' ? ECONOMY.coinPerCorrect : 0;
    setRes((r) => {
      const grades = { ...r.grades };
      lowerGrade(grades, step.id, verdict, typed);
      return {
        grades,
        correct: r.correct + (verdict === 'correct' ? 1 : 0),
        almost: r.almost + (verdict === 'almost' ? 1 : 0),
        wrong: r.wrong + (verdict === 'wrong' ? 1 : 0),
        xp: r.xp + xp,
        coins: r.coins + coins,
      };
    });
    const full = fullPhrase(phrase.es);
    const alt = phrase.alt?.[0] ? `Можно и так: ${fullPhrase(phrase.alt[0])}` : undefined;
    setFb({
      verdict,
      title: verdict === 'correct' ? 'Верно!' : verdict === 'almost' ? 'Почти' : 'Неверно',
      answer: full,
      sub: phrase.ru,
      note: [check?.reason ? REASON[check.reason] : undefined, phrase.note ?? alt].filter(Boolean).join(' ') || undefined,
      speakText: full,
    });
    // Ошибка в уроке: то же задание ещё раз в конце, с новыми вариантами.
    if (verdict === 'wrong' && mode === 'learn') {
      const again: PhraseStep =
        step.kind === 'choose' ? { ...step, options: makeOptions(phrase, pool, rng) } : step.kind === 'tiles' ? { ...step, tiles: makeTiles(phrase, pool, rng) } : step;
      setSteps((s) => [...s, { ...again, key: ++seq }]);
    }
    afterPaint(() => {
      if (verdict !== 'wrong') speak(full);
      useProgress.getState().addXp(xp);
      useCity.getState().addCoins(coins);
    });
  };

  const next = () => {
    setFb(null);
    if (index + 1 >= steps.length) onFinish(res);
    else setIndex(index + 1);
  };

  const graded = steps.filter((s) => s.kind !== 'intro').length;
  const passed = steps.slice(0, index).filter((s) => s.kind !== 'intro').length;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-6" data-testid="phrase-run">
      <div className="flex h-14 items-center gap-3">
        <button type="button" aria-label="Выйти" onClick={() => onExit(res)} className="press h-10 w-10 rounded-full text-xl text-stone-500">
          ✕
        </button>
        <div className="h-3.5 flex-1 overflow-hidden rounded bg-wood p-[2px]">
          <div
            className="h-full w-full origin-left rounded-sm bg-gold"
            style={{ transform: `scaleX(${graded ? passed / graded : 0})`, transition: 'transform 200ms ease-out' }}
          />
        </div>
      </div>
      <div className="font-pixel text-xs tracking-widest text-amber-700 uppercase">{label}</div>
      <div key={step.key} className={`flex flex-1 flex-col pt-2 ${fb ? 'pb-64' : ''}`}>
        {step.kind === 'intro' && <PhraseIntro phrase={phrase} onNext={next} />}
        {step.kind === 'choose' && <PhraseChoose phrase={phrase} options={step.options.map((id) => phrases[id]).filter(Boolean)} locked={!!fb} onAnswer={answer} />}
        {step.kind === 'tiles' && <PhraseTiles phrase={phrase} tiles={step.tiles} locked={!!fb} onAnswer={answer} />}
        {step.kind === 'type' && <PhraseType phrase={phrase} locked={!!fb} onAnswer={answer} />}
      </div>
      <FeedbackSheet fb={fb} onNext={next} />
    </div>
  );
}

function PhraseIntro({ phrase, onNext }: { phrase: Phrase; onNext(): void }) {
  const full = fullPhrase(phrase.es);
  useEffect(() => speak(full), [full]);
  return (
    <div className="flex flex-1 flex-col">
      <div className="text-sm font-medium text-stone-500">Новая фраза</div>
      <div className="mt-6 flex items-center gap-3">
        <div className="flex-1 text-2xl font-bold" data-testid="phrase-text">
          {phrase.es}
        </div>
        <SpeakButton text={full} size="lg" />
      </div>
      <div className="mt-2 text-lg text-stone-600">{phrase.ru}</div>
      {phrase.es.includes('(') && <p className="mt-3 text-sm text-stone-500">Слова в скобках можно не говорить.</p>}
      {phrase.alt?.length ? <p className="mt-1 text-sm text-stone-500">Можно и так: {phrase.alt.map(fullPhrase).join(' / ')}</p> : null}
      {phrase.note && <p className="mt-1 text-sm text-stone-500">{phrase.note}</p>}
      <div className="flex-1" />
      <Button className="mt-6 w-full" onClick={onNext}>
        Понятно
      </Button>
    </div>
  );
}

function PhraseChoose({ phrase, options, locked, onAnswer }: {
  phrase: Phrase;
  options: Phrase[];
  locked: boolean;
  onAnswer(v: Verdict): void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <div className="flex flex-1 flex-col">
      <div className="text-sm font-medium text-stone-500">Выберите фразу</div>
      <div className="mt-6 text-2xl font-bold" data-testid="phrase-prompt">
        {phrase.ru}
      </div>
      <div className="mt-6 flex flex-col gap-2">
        {options.map((o) => {
          const tone = picked === null ? 'border-stone-300 bg-white' : o.id === phrase.id ? 'border-ok bg-okbg' : o.id === picked ? 'border-bad bg-badbg' : 'border-stone-300 bg-white';
          return (
            <button
              key={o.id}
              type="button"
              disabled={locked}
              onClick={() => {
                setPicked(o.id);
                onAnswer(o.id === phrase.id ? 'correct' : 'wrong');
              }}
              className={`press min-h-14 rounded-2xl border-2 px-4 py-3 text-left text-lg ${tone}`}
            >
              {fullPhrase(o.es)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PhraseTiles({ phrase, tiles, locked, onAnswer }: {
  phrase: Phrase;
  tiles: string[];
  locked: boolean;
  onAnswer(v: Verdict, r: CheckResult): void;
}) {
  const [chosen, setChosen] = useState<number[]>([]);
  const [result, setResult] = useState<Verdict | null>(null);
  const check = () => {
    const r = checkPhrase(chosen.map((i) => tiles[i]).join(' '), phrase);
    setResult(r.verdict);
    onAnswer(r.verdict, r);
  };
  const tone = result === null ? 'border-stone-300' : result === 'wrong' ? 'border-bad bg-badbg' : 'border-ok bg-okbg';
  return (
    <div className="flex flex-1 flex-col">
      <div className="text-sm font-medium text-stone-500">Соберите фразу из плиток</div>
      <div className="mt-6 text-2xl font-bold" data-testid="phrase-prompt">
        {phrase.ru}
      </div>
      <p className="mt-1 text-sm text-stone-500">Две плитки лишние.</p>
      <div className={`mt-4 flex min-h-24 flex-wrap content-start gap-2 rounded-2xl border-2 border-dashed p-2 ${tone}`}>
        {chosen.map((idx, pos) => (
          <button
            key={idx}
            type="button"
            disabled={locked}
            onClick={() => setChosen(chosen.filter((_, p) => p !== pos))}
            className="press h-11 rounded-xl bg-white px-3 text-lg shadow-sm"
          >
            {tiles[idx]}
          </button>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-2" data-testid="phrase-tiles">
        {tiles.map((t, idx) => {
          const used = chosen.includes(idx);
          return (
            <button
              key={idx}
              type="button"
              disabled={used || locked}
              onClick={() => setChosen([...chosen, idx])}
              className={`press h-11 rounded-xl border-2 border-stone-300 bg-white px-3 text-lg ${used ? 'opacity-0' : ''}`}
            >
              {t}
            </button>
          );
        })}
      </div>
      <div className="flex-1" />
      {!locked && (
        <Button className="mt-6 w-full" disabled={!chosen.length} onClick={check}>
          Проверить
        </Button>
      )}
    </div>
  );
}

function PhraseType({ phrase, locked, onAnswer }: { phrase: Phrase; locked: boolean; onAnswer(v: Verdict, r: CheckResult): void }) {
  const [value, setValue] = useState('');
  const [result, setResult] = useState<Verdict | null>(null);
  const input = useRef<HTMLInputElement>(null);
  // Над полем — только буквы с ударением и апостроф из этой фразы: остальное есть на любой клавиатуре.
  const keys = [...new Set(normalize(fullPhrase(phrase.es)).match(/[áéíóúüñàèìòù']/g) ?? [])];
  const insert = (ch: string) => {
    const el = input.current;
    if (!el) return;
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    setValue(value.slice(0, start) + ch + value.slice(end));
    requestAnimationFrame(() => el.setSelectionRange(start + ch.length, start + ch.length));
  };
  const backspace = () => {
    const el = input.current;
    if (!el) return;
    const end = el.selectionEnd ?? value.length;
    const start = el.selectionStart ?? value.length;
    const from = start === end ? Math.max(0, start - 1) : start;
    setValue(value.slice(0, from) + value.slice(end));
    requestAnimationFrame(() => el.setSelectionRange(from, from));
  };
  const submit = () => {
    if (locked || !value.trim()) return;
    const r = checkPhrase(value, phrase);
    setResult(r.verdict);
    onAnswer(r.verdict, r);
  };
  const tone = result === null ? 'border-stone-300' : result === 'correct' ? 'border-ok' : result === 'almost' ? 'border-almost' : 'border-bad';
  return (
    <div className="flex flex-1 flex-col">
      <div className="text-sm font-medium text-stone-500">Напишите фразу {L.adverb}</div>
      <div className="mt-6 text-2xl font-bold" data-testid="phrase-prompt">
        {phrase.ru}
      </div>
      <form
        className="mt-6 flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <AccentBar keys={keys} onKey={insert} onBackspace={backspace} disabled={locked} />
        <input
          ref={input}
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          readOnly={locked}
          lang={LANG}
          autoCapitalize="sentences"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="done"
          className={`h-14 rounded-2xl border-2 bg-white px-4 text-xl outline-none focus:border-brand ${tone}`}
          placeholder="Фраза"
        />
        {!locked && (
          <Button type="submit" disabled={!value.trim()} className="w-full">
            Проверить
          </Button>
        )}
      </form>
    </div>
  );
}
