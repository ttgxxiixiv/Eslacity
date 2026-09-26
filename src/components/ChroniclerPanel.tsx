import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadLocation } from '../content';
import { CHRONICLER } from '../content/npcs';
import type { Word } from '../content/schema';
import { SCROLL_WORDS } from '../content/wordIndex';
import { chapterById } from '../domain/chapters';
import { scrollKey } from '../domain/itemId';
import { lessonParts } from '../domain/levels';
import { plural } from '../domain/medals';
import { dayKey } from '../domain/srs';
import { useErrands } from '../store/errands';
import { useProgress } from '../store/progress';
import { useSettings } from '../store/settings';
import { NpcCard } from './NpcCard';
import { Button } from './ui';

/** Свиток, над которым сейчас работает Летописец: первый невыученный в открытых главах. */
export function scrollChapter(opened: number, isLearned: (id: string) => boolean): number | null {
  for (let ch = 1; ch <= opened; ch++) {
    const ids = SCROLL_WORDS[ch] ?? [];
    if (ids.some((id) => !isLearned(id))) return ch;
  }
  return null;
}

/**
 * Летописец рядом с героем на карте странствий: приветствие, свиток открытой главы и «Просьба Летописца» —
 * урок новых слов свитка по шесть. Лимит новых слов в день тот же, что в городе: если он исчерпан и есть что
 * повторить, Летописец сначала отправляет к поручениям.
 */
export function ChroniclerPanel({ opened }: { opened: number }) {
  const nav = useNavigate();
  const cards = useProgress((s) => s.cards);
  const day = useProgress((s) => s.day);
  const newPerDay = useSettings((s) => s.newPerDay);
  const rep = useErrands((s) => s.rep[CHRONICLER.id] ?? 0);
  const ch = scrollChapter(opened, (id) => id in cards);
  // Последний свиток открытых глав: показываем его, когда всё выучено.
  const shownCh = ch ?? [...Array(opened).keys()].map((i) => i + 1).filter((c) => SCROLL_WORDS[c]?.length).pop() ?? null;
  const [words, setWords] = useState<Word[] | null>(null);

  useEffect(() => {
    if (shownCh === null) return;
    let alive = true;
    loadLocation(scrollKey(shownCh)).then((ws) => alive && setWords(ws));
    return () => {
      alive = false;
    };
  }, [shownCh]);

  if (shownCh === null) return null;
  const roman = chapterById(shownCh)?.roman;
  const total = SCROLL_WORDS[shownCh].length;
  const learned = SCROLL_WORDS[shownCh].filter((id) => id in cards).length;
  const parts = words ? lessonParts(words) : [];
  const part = parts.findIndex((p) => p.some((w) => !(w.id in cards)));
  const fresh = part >= 0 ? parts[part].filter((w) => !(w.id in cards)).length : 0;
  const newToday = day.date === dayKey(Date.now()) ? day.newWords : 0;
  const tired = newToday >= newPerDay;

  return (
    <NpcCard npc={CHRONICLER} rep={rep}>
      <div className="mt-3 border-t border-stone-200 pt-2" data-testid="chronicler">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-semibold">📜 Свиток главы {roman}</span>
          <span className="text-stone-500 tabular-nums" data-testid="scroll-count">
            {learned} / {total}
          </span>
        </div>
        {part >= 0 ? (
          <>
            <p className="mt-1 text-sm text-stone-600">
              Помоги записать в свиток общие слова пути. Когда свиток выучен, печать главы становится ближе.
            </p>
            {tired && (
              <p className="mt-1 text-sm text-amber-700" data-testid="chronicler-limit">
                Сегодня уже {newToday} {plural(newToday, ['новое слово', 'новых слова', 'новых слов'])}, это ваш лимит. Можно продолжить, но слова лучше запомнятся завтра.
              </p>
            )}
            <Button
              variant={tired ? 'secondary' : 'primary'}
              className="mt-2 w-full"
              data-testid="chronicler-lesson"
              onClick={() => nav(`/learn/${scrollKey(shownCh)}/1/${part}`)}
            >
              Просьба Летописца: {fresh} {plural(fresh, ['новое слово', 'новых слова', 'новых слов'])}
            </Button>
          </>
        ) : (
          words && <p className="mt-1 text-sm text-stone-600">Свиток выучен. Летописец будет просить повторить его слова в поручениях.</p>
        )}
      </div>
    </NpcCard>
  );
}
