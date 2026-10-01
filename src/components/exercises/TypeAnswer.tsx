import { L, LANG } from '../../lang';
import { useRef, useState } from 'react';
import { answerLetters, checkTyped, EXAM_KEYS, type CheckResult } from '../../domain/answer';
import { AccentBar } from '../AccentBar';
import { CantListen, ListenControls } from './ListenControls';
import { Button, genderLabel } from '../ui';
import type { ExerciseProps } from './types';
import { hintPrefix } from '../../domain/rewards';
import { useRewards } from '../../store/rewards';

const REASON_NOTE: Record<NonNullable<CheckResult['reason']>, string> = {
  accent: 'Обратите внимание на ударение.',
  typo: 'Опечатка в одной букве.',
  article: 'Существительное учим вместе с артиклем.',
};

/** exam — испытание: над полем только буквы с ударением языка, без букв ответа. */
export function TypeAnswer({ step, words, locked, onAnswer, onCantListen, exam = false }: ExerciseProps<'type' | 'listen-type'> & { onCantListen?: () => void; exam?: boolean }) {
  const dictation = step.kind === 'listen-type';
  const word = words[step.wordId];
  const [value, setValue] = useState('');
  const [result, setResult] = useState<CheckResult | null>(null);
  const [hinted, setHinted] = useState(false);
  const hints = useRewards((s) => s.rec.hints);
  const input = useRef<HTMLInputElement>(null);

  // Жетон подсказки (награда уровня героя): первая буква ответа, верный ответ тогда засчитывается как «почти».
  const hint = () => {
    if (hinted || locked || !useRewards.getState().spendHint()) return;
    const prefix = hintPrefix(word.es, [...L.singular, ...L.plural]);
    setHinted(true);
    setValue(prefix);
    requestAnimationFrame(() => {
      input.current?.focus();
      input.current?.setSelectionRange(prefix.length, prefix.length);
    });
  };

  const insert = (ch: string) => {
    const el = input.current;
    if (!el) return;
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + ch + value.slice(end);
    setValue(next);
    requestAnimationFrame(() => el.setSelectionRange(start + ch.length, start + ch.length));
  };

  // Стирает выделение или букву перед курсором.
  const backspace = () => {
    const el = input.current;
    if (!el) return;
    const end = el.selectionEnd ?? value.length;
    const start = el.selectionStart ?? value.length;
    const from = start === end ? Math.max(0, start - 1) : start;
    setValue(value.slice(0, from) + value.slice(end));
    requestAnimationFrame(() => el.setSelectionRange(from, from));
  };

  const keys = exam ? { letters: EXAM_KEYS[LANG], space: false } : answerLetters(word.es);

  const submit = () => {
    if (locked || !value.trim()) return;
    const checked = checkTyped(value, [word.es, ...(word.alt ?? [])]);
    // С подсказкой ответ не выше «почти»: в повторении это оценка Hard.
    const r: CheckResult = hinted && checked.verdict === 'correct' ? { ...checked, verdict: 'almost' } : checked;
    setResult(r);
    const title = hinted && r.verdict === 'almost' ? 'С подсказкой' : r.verdict === 'almost' ? 'Почти' : undefined;
    const note = hinted && r.verdict === 'almost' ? 'С подсказкой ответ засчитан как «почти».' : r.reason ? REASON_NOTE[r.reason] : undefined;
    onAnswer({ verdict: r.verdict }, { title, note, answer: checked.verdict === 'correct' ? word.es : r.expected });
  };

  const tone =
    result === null ? 'border-stone-300' : result.verdict === 'correct' ? 'border-ok' : result.verdict === 'almost' ? 'border-almost' : 'border-bad';

  return (
    <div className="flex flex-1 flex-col">
      <div className="text-sm font-medium text-stone-500">{dictation ? 'Напишите, что услышали' : `Напишите ${L.adverb}`}</div>
      {dictation ? (
        <ListenControls text={word.es} />
      ) : (
        <>
          <div className="mt-6 text-3xl font-bold break-words hyphens-auto">{word.ru}</div>
          {word.pos === 'noun' && (
            <div className="mt-1 text-sm text-stone-500">с артиклем · {genderLabel(word.gender)}</div>
          )}
        </>
      )}
      <form
        className="mt-6 flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <AccentBar keys={keys.letters} space={keys.space} onKey={insert} onBackspace={backspace} disabled={locked} />
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
          placeholder="Ответ"
        />
        {!locked && (
          <div className="flex gap-2">
            {!exam && (hints > 0 || hinted) && (
              <button
                type="button"
                onClick={hint}
                disabled={hinted}
                className="press shrink-0 rounded-xl border-2 border-stone-300 bg-white px-3 text-sm font-semibold disabled:opacity-50"
                aria-label={`Подсказка: первая буква. Жетонов: ${hints}`}
                data-testid="hint"
              >
                💡 {hints}
              </button>
            )}
            <Button type="submit" disabled={!value.trim()} className="w-full">
              Проверить
            </Button>
          </div>
        )}
      </form>
      {dictation && !locked && onCantListen && <CantListen onClick={onCantListen} />}
    </div>
  );
}
