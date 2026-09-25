import { useState } from 'react';
import { SpeakButton } from '../ui';
import { CantListen, ListenControls } from './ListenControls';
import type { ExerciseProps } from './types';

export function Choice({ step, words, locked, onAnswer, onCantListen }: ExerciseProps<'choice-es-ru' | 'choice-ru-es' | 'listen-choice'> & { onCantListen?: () => void }) {
  const word = words[step.wordId];
  const [picked, setPicked] = useState<number | null>(null);
  const listen = step.kind === 'listen-choice';
  const esToRu = step.kind === 'choice-es-ru';

  const pick = (i: number) => {
    if (locked || picked !== null) return;
    setPicked(i);
    onAnswer({ verdict: i === step.answer ? 'correct' : 'wrong' });
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="text-sm font-medium text-stone-500">
        {listen ? 'Что вы услышали?' : esToRu ? 'Выберите перевод' : 'Как сказать по-испански?'}
      </div>
      {listen ? (
        <ListenControls text={word.es} />
      ) : (
        <div className="mt-6 flex items-center gap-3">
          <div className="flex-1 text-3xl font-bold">{esToRu ? word.es : word.ru}</div>
          {esToRu && <SpeakButton text={word.es} size="lg" />}
        </div>
      )}
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
      {listen && !locked && onCantListen && <CantListen onClick={onCantListen} />}
    </div>
  );
}
