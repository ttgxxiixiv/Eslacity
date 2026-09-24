import { useState } from 'react';
import { SpeakButton } from '../ui';
import type { ExerciseProps } from './types';

export function Choice({ step, words, locked, onAnswer }: ExerciseProps<'choice-es-ru' | 'choice-ru-es'>) {
  const word = words[step.wordId];
  const [picked, setPicked] = useState<number | null>(null);
  const esToRu = step.kind === 'choice-es-ru';

  const pick = (i: number) => {
    if (locked || picked !== null) return;
    setPicked(i);
    onAnswer({ verdict: i === step.answer ? 'correct' : 'wrong' });
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="text-sm font-medium text-stone-500">{esToRu ? 'Выберите перевод' : 'Как сказать по-испански?'}</div>
      <div className="mt-6 flex items-center gap-3">
        <div className="flex-1 text-3xl font-bold">{esToRu ? word.es : word.ru}</div>
        {esToRu && <SpeakButton text={word.es} size="lg" />}
      </div>
      <div className="mt-8 grid gap-3">
        {step.options.map((o, i) => {
          let cls = 'bg-white border-stone-300';
          if (picked !== null) {
            if (i === step.answer) cls = 'bg-okbg border-ok text-ok';
            else if (i === picked) cls = 'bg-badbg border-bad text-bad';
            else cls = 'bg-white border-stone-200 opacity-60';
          }
          return (
            <button
              key={i}
              type="button"
              onClick={() => pick(i)}
              className={`press min-h-14 rounded-2xl border-2 px-4 py-3 text-left text-lg font-medium ${cls}`}
            >
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}
