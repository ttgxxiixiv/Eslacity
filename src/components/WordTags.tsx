import type { Word } from '../content/schema';
import { wordTags } from '../domain/expression';

/** Метки пометки употребления, регистра и вида выражения (идиома, ложный друг). У обычного слова ничего не рисует. */
export function WordTags({ word, className = '' }: { word: Pick<Word, 'kind' | 'register' | 'usage'>; className?: string }) {
  const tags = wordTags(word);
  if (!tags.length) return null;
  return (
    <span className={`inline-flex flex-wrap gap-1 ${className}`} data-testid="word-tags">
      {tags.map((t) => (
        <span key={t} className="rounded-md border border-amber-700/40 font-normal bg-amber-50 px-1.5 text-xs text-amber-900">
          {t}
        </span>
      ))}
    </span>
  );
}
