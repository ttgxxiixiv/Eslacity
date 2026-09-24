import { useState } from 'react';
import { Button } from '../ui';
import type { ExerciseProps } from './types';

export function BuildPhrase({ step, words, locked, onAnswer }: ExerciseProps<'phrase'>) {
  const word = words[step.wordId];
  const [chosen, setChosen] = useState<number[]>([]);
  const [result, setResult] = useState<boolean | null>(null);

  const check = () => {
    const got = chosen.map((i) => step.tokens[i].toLowerCase()).join(' ');
    const ok = got === step.answer.map((t) => t.toLowerCase()).join(' ');
    setResult(ok);
    onAnswer(
      { verdict: ok ? 'correct' : 'wrong' },
      { answer: word.example.es, sub: word.example.ru, speakText: word.example.es },
    );
  };

  const tone = result === null ? 'border-stone-300' : result ? 'border-ok bg-okbg' : 'border-bad bg-badbg';

  return (
    <div className="flex flex-1 flex-col">
      <div className="text-sm font-medium text-stone-500">Соберите фразу</div>
      <div className="mt-6 text-2xl font-bold">{word.example.ru}</div>

      <div className={`mt-6 flex min-h-24 flex-wrap content-start gap-2 rounded-2xl border-2 border-dashed p-2 ${tone}`}>
        {chosen.map((idx, pos) => (
          <button
            key={idx}
            type="button"
            disabled={locked}
            onClick={() => setChosen(chosen.filter((_, p) => p !== pos))}
            className="press h-11 rounded-xl bg-white px-3 text-lg shadow-sm"
          >
            {step.tokens[idx]}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {step.tokens.map((t, idx) => {
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
