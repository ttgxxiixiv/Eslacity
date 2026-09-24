import { useState } from 'react';
import { Button } from '../ui';
import type { ExerciseProps } from './types';

export function Scramble({ step, words, locked, onAnswer }: ExerciseProps<'scramble'>) {
  const word = words[step.wordId];
  const [article, setArticle] = useState<string | null>(null);
  // Индексы плиток в порядке выбора.
  const [chosen, setChosen] = useState<number[]>([]);
  const [result, setResult] = useState<boolean | null>(null);

  const full = chosen.length === step.letters.length && (!step.articles || article);

  const check = () => {
    const ok = chosen.map((i) => step.letters[i]).join('') === step.core && article === step.article;
    setResult(ok);
    const note = ok ? undefined : article !== step.article ? `Артикль: ${step.article}` : undefined;
    onAnswer({ verdict: ok ? 'correct' : 'wrong' }, { note });
  };

  const tone = result === null ? 'border-stone-300' : result ? 'border-ok bg-okbg' : 'border-bad bg-badbg';

  return (
    <div className="flex flex-1 flex-col">
      <div className="text-sm font-medium text-stone-500">Соберите слово</div>
      <div className="mt-6 text-3xl font-bold">{word.ru}</div>

      {step.articles && (
        <div className="mt-6 flex gap-2">
          {step.articles.map((a) => (
            <button
              key={a}
              type="button"
              disabled={locked}
              onClick={() => setArticle(a)}
              className={`press h-12 flex-1 rounded-xl border-2 text-lg font-semibold ${
                article === a ? 'border-brand bg-orange-50 text-brand' : 'border-stone-300 bg-white'
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      )}

      <div className={`mt-4 flex min-h-16 flex-wrap items-center gap-1.5 rounded-2xl border-2 border-dashed p-2 ${tone}`}>
        {chosen.map((idx, pos) => (
          <button
            key={idx}
            type="button"
            disabled={locked}
            onClick={() => setChosen(chosen.filter((_, p) => p !== pos))}
            className="press h-11 min-w-10 rounded-lg bg-white px-2 text-xl font-semibold shadow-sm"
          >
            {step.letters[idx]}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {step.letters.map((ch, idx) => {
          const used = chosen.includes(idx);
          return (
            <button
              key={idx}
              type="button"
              disabled={used || locked}
              onClick={() => setChosen([...chosen, idx])}
              className={`press h-12 min-w-12 rounded-xl border-2 border-stone-300 bg-white px-2 text-xl font-semibold ${
                used ? 'opacity-0' : ''
              }`}
            >
              {ch}
            </button>
          );
        })}
      </div>
      <div className="flex-1" />
      {!locked && (
        <Button className="mt-6 w-full" disabled={!full} onClick={check}>
          Проверить
        </Button>
      )}
    </div>
  );
}
