import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { speakAs } from '../audio/tts';
import { CHRONICLER } from '../content/npcs';
import { loadThread } from '../content/scenes';
import type { Scene, ThreadFile } from '../content/schema';
import { chapterById } from '../domain/chapters';
import { plural } from '../domain/medals';
import {
  fragmentsOf, noteDue, noteOf, openThread, parseThreadId, shardsToday, THREAD_AT, THREAD_TRIGGERS, threadDue, threadId, TRIGGER_LABEL,
} from '../domain/thread';
import { NpcPortrait } from '../components/NpcPortrait';
import { Button, Loading, Screen, TopBar } from '../components/ui';
import { useJourney } from '../store/journey';
import { heroText } from '../store/settings';
import { useThread } from '../store/thread';
import { useBooks } from '../store/books';
import { unreadBooks } from '../domain/books';
import { BooksSection, useBookSlots } from './Books';

type Thread = Pick<ThreadFile, 'scenes' | 'notes'>;
let cached: Thread | null = null;

/** Нить глав из контента: файл маленький, грузится один раз. */
export function useThreadContent(): Thread | null {
  const [thread, setThread] = useState(cached);
  useEffect(() => {
    if (!cached) {
      loadThread().then((t) => {
        cached = t;
        setThread(t);
      });
    }
  }, []);
  return thread;
}

/** Что ждёт в Летописи: новые сцены нити и записка дня. Для кнопки на главной. */
export function useChronicleDue(now = Date.now()): { scenes: string[]; note: boolean; books: number } | null {
  const thread = useThreadContent();
  const opened = useJourney((s) => s.opened);
  const fragments = useJourney((s) => s.fragments);
  const rec = useThread((s) => s.rec);
  // Книги Летописца (задача 12.4): открытые и ещё не прочитанные.
  const bookData = useBookSlots();
  const booksRec = useBooks((s) => s.rec);
  return useMemo(() => {
    if (!thread || !bookData) return null;
    const ids = new Set(thread.scenes.map((s) => s.id));
    const note = noteDue(fragments, rec, now) && noteOf(thread.notes, opened, now) !== null;
    return { scenes: threadDue(opened, fragments, rec, (id) => ids.has(id)), note, books: unreadBooks(bookData.slots, booksRec).length };
  }, [thread, bookData, booksRec, opened, fragments, rec, now]);
}

const sceneTitle = (id: string) => {
  const t = parseThreadId(id);
  return t ? `Глава ${chapterById(t.chapter)?.roman}. ${TRIGGER_LABEL[t.trigger]}` : id;
};

/**
 * Летопись (задача 13.1): сцены нити глав, которые Летописец записал по ходу пути, и его записка за день,
 * когда добыт обрывок. Новые сцены сверху, прочитанные можно перечитать.
 */
export function ChronicleScreen() {
  const thread = useThreadContent();
  const opened = useJourney((s) => s.opened);
  const fragments = useJourney((s) => s.fragments);
  const rec = useThread((s) => s.rec);
  const [now] = useState(Date.now);
  const [showRu, setShowRu] = useState(false);
  // Записка остаётся на экране до ухода, даже когда уже прочитана.
  const [noteShown] = useState(() => shardsToday(useJourney.getState().fragments, now) > 0);

  if (!thread) return <Loading />;
  const ids = new Set(thread.scenes.map((s) => s.id));
  const exists = (id: string) => ids.has(id);
  const open = openThread(opened, fragments, exists);
  const due = open.filter((id) => rec.seen[id] === undefined);
  const seen = open.filter((id) => rec.seen[id] !== undefined).reverse();
  const note = noteShown ? noteOf(thread.notes, opened, now) : null;
  const unread = noteDue(fragments, rec, now);
  const text = note ? heroText(note) : null;
  const today = shardsToday(fragments, now);
  // Следующая сцена открытой главы: сколько обрывков до неё.
  const got = fragmentsOf(fragments, opened);
  const nextTrigger = THREAD_TRIGGERS.find((t) => exists(threadId(opened, t)) && got < THREAD_AT[t]);

  return (
    <Screen>
      <TopBar title="Летопись" />
      <div className="flex flex-col gap-3 px-4 pb-6">
        <div className="flex items-center gap-3">
          <NpcPortrait look={CHRONICLER.look} size={64} />
          <p className="text-stone-600">
            {CHRONICLER.name} записывает, что жители рассказали о Хранилище, и сводит их рассказы в одну историю.
          </p>
        </div>

        {note && text && (
          <section className="rounded-2xl border-2 border-gold bg-amber-50 p-3" data-testid="thread-note">
            <div className="text-sm text-stone-600">
              Летописец оставил записку: сегодня {today} {plural(today, ['обрывок', 'обрывка', 'обрывков'])} карты.
            </div>
            <p className="mt-2 text-lg leading-snug" data-testid="thread-note-text">
              {text.es}
            </p>
            {note.gloss && (
              <p className="mt-1 text-sm text-stone-500">
                {Object.entries(note.gloss)
                  .map(([w, ru]) => `${w} — ${ru}`)
                  .join(' · ')}
              </p>
            )}
            {showRu && <p className="mt-1 text-sm text-stone-600">{text.ru}</p>}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => speakAs(text.es, CHRONICLER)}>
                🔊 Слушать
              </Button>
              <Button variant="secondary" onClick={() => setShowRu(!showRu)}>
                {showRu ? 'Скрыть перевод' : 'Перевод'}
              </Button>
            </div>
            {unread && (
              <Button className="mt-2 w-full" onClick={() => useThread.getState().readNote()} data-testid="thread-note-read">
                Прочитано
              </Button>
            )}
          </section>
        )}

        {due.map((id) => (
          <Link key={id} to={`/scene/${encodeURIComponent(id)}`} className="press flex items-center gap-3 rounded-2xl border-2 border-gold bg-white px-3 py-3 shadow-sm" data-testid="thread-due">
            <span className="text-2xl" aria-hidden>
              📖
            </span>
            <span>
              <span className="block font-semibold">Новая запись</span>
              <span className="block text-sm text-stone-600">{sceneTitle(id)}</span>
            </span>
          </Link>
        ))}

        {nextTrigger && (
          <p className="text-sm text-stone-500" data-testid="thread-next">
            Следующая запись главы {chapterById(opened)?.roman} — когда соберёте {THREAD_AT[nextTrigger]}{' '}
            {plural(THREAD_AT[nextTrigger], ['обрывок', 'обрывка', 'обрывков'])} карты (сейчас {got}).
          </p>
        )}

        {seen.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="font-bold">Прочитано</h2>
            {seen.map((id) => (
              <Link key={id} to={`/scene/${encodeURIComponent(id)}`} className="press rounded-2xl bg-white px-3 py-2 shadow-sm" data-testid="thread-seen">
                {sceneTitle(id)}
              </Link>
            ))}
          </section>
        )}

        <BooksSection />
      </div>
    </Screen>
  );
}

/** Заголовок сцены нити для экрана сцены. */
export const threadSceneTitle = (scene: Scene) => `Летопись: ${sceneTitle(scene.id)}`;
