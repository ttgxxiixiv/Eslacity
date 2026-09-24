import { useRef, useState } from 'react';
import type { Verdict } from '../../domain/answer';
import { afterPaint } from '../../lib/afterPaint';
import { speak } from '../../audio/tts';
import type { ExerciseProps } from './types';

type Side = 'l' | 'r';

export function MatchPairs({ step, words, locked, onAnswer }: ExerciseProps<'match'>) {
  const [sel, setSel] = useState<{ side: Side; id: string } | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [flash, setFlash] = useState<string[]>([]);
  const perWord = useRef<Record<string, Verdict>>({});

  const tap = (side: Side, id: string) => {
    if (locked || done.includes(id)) return;
    if (side === 'r') afterPaint(() => speak(words[id].es));
    if (!sel || sel.side === side) {
      setSel({ side, id });
      return;
    }
    if (sel.id === id) {
      const next = [...done, id];
      setDone(next);
      setSel(null);
      if (next.length === step.wordIds.length) {
        const anyWrong = Object.values(perWord.current).includes('wrong');
        onAnswer(
          { verdict: anyWrong ? 'almost' : 'correct', perWord: { ...perWord.current } },
          { title: anyWrong ? 'Пары собраны, но с ошибками' : 'Все пары верно', answer: undefined },
        );
      }
    } else {
      // Ошибка засчитывается слову из левой колонки (русскому).
      const leftId = side === 'l' ? id : sel.id;
      perWord.current[leftId] = 'wrong';
      setFlash([sel.id + sel.side, id + side]);
      setSel(null);
      setTimeout(() => setFlash([]), 400);
    }
  };

  const cell = (side: Side, id: string, text: string) => {
    const isDone = done.includes(id);
    const isSel = sel?.side === side && sel.id === id;
    const isBad = flash.includes(id + side);
    return (
      <button
        key={id + side}
        type="button"
        disabled={isDone}
        onClick={() => tap(side, id)}
        className={`press min-h-14 rounded-2xl border-2 px-3 py-2 text-base font-medium ${
          isDone
            ? 'border-stone-200 bg-stone-100 opacity-40'
            : isBad
              ? 'border-bad bg-badbg'
              : isSel
                ? 'border-brand bg-orange-50'
                : 'border-stone-300 bg-white'
        }`}
      >
        {text}
      </button>
    );
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="text-sm font-medium text-stone-500">Соедините пары</div>
      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="grid gap-3">{step.left.map((id) => cell('l', id, words[id].ru))}</div>
        <div className="grid gap-3">{step.right.map((id) => cell('r', id, words[id].es))}</div>
      </div>
    </div>
  );
}
