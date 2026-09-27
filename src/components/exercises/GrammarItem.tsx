import { useRef, useState } from 'react';
import { EXAM_KEYS, type Verdict } from '../../domain/answer';
import { grammarTitle, type GrammarCheck, type GrammarInput, type GrammarItem } from '../../domain/grammar';
import type { Feedback } from '../FeedbackSheet';
import { LANG } from '../../lang';
import { AccentBar } from '../AccentBar';
import { Button } from '../ui';

/** Итог ответа на упражнение грамматики: заголовок, правильный ответ, объяснение правила. */
export function grammarFeedback(item: GrammarItem, c: GrammarCheck): Feedback {
  return {
    verdict: c.verdict,
    title: grammarTitle(item, c),
    answer: c.shown,
    note: [c.reason === 'accent' ? 'Обратите внимание на ударение.' : '', item.ex.explain].filter(Boolean).join(' '),
    speakText: c.speak,
  };
}

const LABEL = {
  choose: 'Выберите форму',
  gap: 'Заполните пропуск',
  truefalse: 'Верно или неверно?',
  build: 'Соберите предложение',
  type: 'Впишите форму',
} as const;

/**
 * Упражнение грамматики: выбор формы, пропуск, верно/неверно, сборка предложения из плиток и ввод формы.
 * Общее для урока, повторения и стражей. verdict — итог проверки (null, пока ответа нет): после него всё закрыто.
 */
export function GrammarItemView({ item, verdict, onAnswer }: { item: GrammarItem; verdict: Verdict | null; onAnswer: (a: GrammarInput) => void }) {
  const { ex } = item;
  return (
    <div className="flex flex-1 flex-col">
      <div className="text-sm font-medium text-stone-500">{LABEL[ex.kind]}</div>
      {ex.kind === 'build' ? (
        <BuildView item={item} verdict={verdict} onAnswer={onAnswer} />
      ) : ex.kind === 'type' ? (
        <TypeView item={item} verdict={verdict} onAnswer={onAnswer} />
      ) : (
        <ChoiceView item={item} verdict={verdict} onAnswer={onAnswer} />
      )}
    </div>
  );
}

type ViewProps = { item: GrammarItem; verdict: Verdict | null; onAnswer: (a: GrammarInput) => void };

function ChoiceView({ item, verdict, onAnswer }: ViewProps) {
  const { ex } = item;
  const [picked, setPicked] = useState<number | null>(null);
  const shownWord = picked === null ? null : item.options[picked];
  return (
    <>
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
                  {shownWord ?? ' '}
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
              onClick={() => {
                if (picked !== null || verdict !== null) return;
                setPicked(i);
                onAnswer({ pick: i });
              }}
              className={`press min-h-14 rounded-2xl border-2 px-4 py-3 text-lg font-medium ${ex.kind === 'truefalse' ? 'text-center' : 'text-left'} ${cls}`}
            >
              {o}
            </button>
          );
        })}
      </div>
    </>
  );
}

/** Сборка предложения по переводу: плитки слов ответа и лишние. */
function BuildView({ item, verdict, onAnswer }: ViewProps) {
  const tiles = item.tiles ?? [];
  const [chosen, setChosen] = useState<number[]>([]);
  const locked = verdict !== null;
  const tone = verdict === null ? 'border-stone-300' : verdict === 'wrong' ? 'border-bad bg-badbg' : 'border-ok bg-okbg';
  const extra = item.ex.kind === 'build' ? item.ex.extra.length : 0;
  return (
    <>
      <div className="mt-5 text-2xl leading-snug font-bold" data-testid="grammar-prompt">
        {'ru' in item.ex ? item.ex.ru : ''}
      </div>
      <p className="mt-1 text-sm text-stone-500">
        {extra === 1 ? 'Одна плитка лишняя.' : `Лишних плиток: ${extra}.`}
      </p>
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
      <div className="mt-4 flex flex-wrap justify-center gap-2" data-testid="grammar-tiles">
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
        <Button className="mt-6 w-full" disabled={!chosen.length} onClick={() => onAnswer({ tiles: chosen.map((i) => tiles[i]) })}>
          Проверить
        </Button>
      )}
    </>
  );
}

/**
 * Ввод формы в пропуск. Над полем только буквы с ударением языка: буквы ответа подсказали бы форму,
 * а в ней весь смысл задания.
 */
function TypeView({ item, verdict, onAnswer }: ViewProps) {
  const ex = item.ex.kind === 'type' ? item.ex : null;
  const [value, setValue] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const locked = verdict !== null;
  if (!ex) return null;
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
    onAnswer({ text: value });
  };
  const tone = verdict === null ? 'border-stone-300' : verdict === 'correct' ? 'border-ok' : verdict === 'almost' ? 'border-almost' : 'border-bad';
  const [before, after] = ex.sentence.split('___');
  return (
    <>
      <div className="mt-5 text-2xl leading-snug font-bold" data-testid="grammar-prompt">
        {before}
        <span className="mx-1 inline-block min-w-16 border-b-4 border-stone-300 text-center text-stone-400">{value.trim() || ' '}</span>
        {after}
      </div>
      {ex.hint && <div className="mt-1 text-sm text-stone-500" data-testid="grammar-hint">({ex.hint})</div>}
      <div className="mt-2 text-stone-500">{ex.ru}</div>
      <form
        className="mt-6 flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <AccentBar keys={EXAM_KEYS[LANG]} onKey={insert} onBackspace={backspace} disabled={locked} />
        <input
          ref={input}
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          readOnly={locked}
          lang={LANG}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="done"
          className={`h-14 rounded-2xl border-2 bg-white px-4 text-xl outline-none focus:border-brand ${tone}`}
          placeholder="Форма"
        />
        {!locked && (
          <Button type="submit" disabled={!value.trim()} className="w-full">
            Проверить
          </Button>
        )}
      </form>
    </>
  );
}
