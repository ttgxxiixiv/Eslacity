import { L } from '../lang';
import { useEffect, useMemo, useState } from 'react';
import { wordsByIds } from '../content';
import { LOCATION_BY_ID } from '../content/locations';
import type { LocationId, Word } from '../content/schema';
import { normalize, stripAccents } from '../domain/answer';
import { dayNumber } from '../domain/srs';
import { useProgress } from '../store/progress';
import { Screen, SpeakButton, TopBar } from '../components/ui';

function dueText(due: number, today: number) {
  const d = due - today;
  if (d <= 0) return 'сегодня';
  if (d === 1) return 'завтра';
  return `через ${d} дн.`;
}

export function WordsScreen() {
  const cards = useProgress((s) => s.cards);
  const [words, setWords] = useState<Word[]>([]);
  const [q, setQ] = useState('');
  const today = dayNumber(Date.now());

  useEffect(() => {
    wordsByIds(Object.keys(cards)).then(setWords);
  }, [cards]);

  const list = useMemo(() => {
    const needle = stripAccents(normalize(q));
    const found = needle
      ? words.filter((w) => stripAccents(normalize(w.es)).includes(needle) || w.ru.toLowerCase().includes(needle))
      : words;
    return found.slice().sort((a, b) => a.es.localeCompare(b.es, L.locale));
  }, [words, q]);

  return (
    <Screen>
      <TopBar title={`Мои слова · ${words.length}`} />
      <div className="px-5 pb-6">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={`Поиск ${L.adverb} или по-русски`}
          className="h-12 w-full rounded-2xl border-2 border-stone-200 bg-white px-4 outline-none focus:border-brand"
        />
        {!words.length && <p className="mt-6 text-center text-stone-500">Здесь появятся слова после первого урока.</p>}
        <ul className="mt-3 divide-y divide-stone-100 rounded-2xl bg-white shadow-sm">
          {list.map((w) => {
            const c = cards[w.id];
            const loc = LOCATION_BY_ID[w.id.split('.')[0] as LocationId];
            return (
              <li key={w.id} className="flex items-center gap-3 px-4 py-2.5">
                <span title={loc?.ru}>{loc?.emoji}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{w.es}</div>
                  <div className="truncate text-sm text-stone-500">{w.ru}</div>
                </div>
                <div className="text-right text-xs text-stone-400">
                  <div>{dueText(c.due, today)}</div>
                  {c.lapses > 0 && <div>ошибок: {c.lapses}</div>}
                </div>
                <SpeakButton text={w.es} />
              </li>
            );
          })}
        </ul>
      </div>
    </Screen>
  );
}
