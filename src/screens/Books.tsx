import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { speakAs } from '../audio/tts';
import { BOOK_FILE_CHAPTERS, loadBooks } from '../content/books';
import { CHRONICLER } from '../content/npcs';
import type { Book, BookFile, BookWord } from '../content/schema';
import { normalize } from '../domain/answer';
import { BOOK_PASS, BOOK_XP, bookSlots, parseBookId, type BookSlot } from '../domain/books';
import { chapterById } from '../domain/chapters';
import { plural } from '../domain/medals';
import { sceneChunks, wordTranslation } from '../domain/sceneText';
import { Button, Screen, TopBar } from '../components/ui';
import { useBooks } from '../store/books';
import { useJourney } from '../store/journey';
import { useProgress } from '../store/progress';
import { SceneQuiz } from './Scene';

const cache = new Map<number, BookFile | null>();

/** Книги глав до открытой: файлы маленькие, грузятся один раз. */
function useBookFiles(opened: number): Map<number, BookFile> | null {
  const chapters = BOOK_FILE_CHAPTERS.filter((c) => c <= opened);
  const key = chapters.join(',');
  const [files, setFiles] = useState<Map<number, BookFile> | null>(null);
  useEffect(() => {
    let alive = true;
    Promise.all(chapters.map(async (c) => [c, cache.has(c) ? cache.get(c)! : await loadBooks(c)] as const)).then((list) => {
      const m = new Map<number, BookFile>();
      for (const [c, f] of list) {
        cache.set(c, f);
        if (f) m.set(c, f);
      }
      if (alive) setFiles(m);
    });
    return () => {
      alive = false;
    };
    // Ключ — список глав: массив пересоздаётся на каждом рендере.
  }, [key]);
  return files;
}

/** Тексты по обрывкам: открытые и закрытые. Для Летописи и её бейджа. */
export function useBookSlots(): { slots: BookSlot[]; files: Map<number, BookFile> } | null {
  const opened = useJourney((s) => s.opened);
  const fragments = useJourney((s) => s.fragments);
  const files = useBookFiles(opened);
  return useMemo(() => {
    if (!files) return null;
    const ids = new Set([...files.values()].flatMap((f) => f.books.map((b) => b.id)));
    return { slots: bookSlots(opened, fragments, (id) => ids.has(id)), files };
  }, [files, opened, fragments]);
}

const titleOf = (files: Map<number, BookFile>, id: string) => {
  const p = parseBookId(id);
  return p ? files.get(p.chapter)?.books.find((b) => b.id === id)?.title : undefined;
};

/** Книги Летописца в Летописи (задача 12.4): тексты по главам, закрытые — с числом обрывков до них. */
export function BooksSection() {
  const data = useBookSlots();
  const read = useBooks((s) => s.rec.read);
  const fragments = useJourney((s) => s.fragments);
  if (!data || !data.slots.length) return null;
  return (
    <section className="flex flex-col gap-2" data-testid="books">
      <h2 className="font-bold">Книги Летописца</h2>
      <p className="text-sm text-stone-500">Истории этих земель. Читайте и берите новые слова в свои.</p>
      {data.slots.map((s) => {
        const t = titleOf(data.files, s.id);
        const r = read[s.id];
        if (!s.open) {
          const got = Object.keys(fragments).filter((k) => k.startsWith(`${s.chapter}:`)).length;
          return (
            <div key={s.id} className="rounded-2xl border-2 border-dashed border-stone-300 px-3 py-2 text-sm text-stone-500" data-testid="book-locked">
              🔒 Глава {chapterById(s.chapter)?.roman}, книга {s.n} — откроется на {s.at} {plural(s.at, ['обрывке', 'обрывках', 'обрывках'])} главы (сейчас {got})
            </div>
          );
        }
        return (
          <Link key={s.id} to={`/book/${encodeURIComponent(s.id)}`} className="press flex items-center gap-3 rounded-2xl bg-white px-3 py-2 shadow-sm" data-testid="book-open">
            <span className="text-2xl" aria-hidden>
              {r ? '📗' : '📕'}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{t?.es}</span>
              <span className="block text-sm text-stone-600">
                {t?.ru} · {r ? `понято ${r.score} из 5` : 'новая'}
              </span>
            </span>
          </Link>
        );
      })}
    </section>
  );
}

/** Экран книги: текст с переводом слов по нажатию, «В мои слова», потом вопросы на понимание. */
export function BookScreen() {
  const id = decodeURIComponent(useParams().id ?? '');
  const data = useBookSlots();
  const nav = useNavigate();
  const [phase, setPhase] = useState<'read' | 'quiz' | 'done'>('read');
  const [xp, setXp] = useState(0);
  const [score, setScore] = useState(0);
  if (!data) return null;
  const slot = data.slots.find((s) => s.id === id);
  const file = slot && data.files.get(slot.chapter);
  const book = file?.books.find((b) => b.id === id);
  if (!slot || !file || !book || !slot.open) {
    return (
      <Screen>
        <TopBar title="Книга Летописца" />
        <p className="px-5 py-6 text-stone-600" data-testid="book-closed">
          {slot ? `Эта книга откроется, когда у вас будет ${slot.at} ${plural(slot.at, ['обрывок', 'обрывка', 'обрывков'])} карты главы ${chapterById(slot.chapter)?.roman}.` : 'Такой книги нет.'}
        </p>
      </Screen>
    );
  }
  if (phase === 'quiz') {
    return (
      <Screen>
        <TopBar title={book.title.es} />
        <SceneQuiz
          scene={book}
          kind="book-question"
          onDone={(right) => {
            setScore(right);
            setXp(useBooks.getState().finish(book.id, right));
            setPhase('done');
          }}
        />
      </Screen>
    );
  }
  if (phase === 'done') {
    return (
      <Screen>
        <TopBar title={book.title.es} />
        <div className="flex flex-1 flex-col gap-3 px-5 pb-6" data-testid="book-done">
          <div className="rounded-2xl bg-white p-4 text-center shadow-sm">
            <div className="text-4xl">📗</div>
            <div className="mt-1 text-lg font-bold">Книга прочитана</div>
            <p className="text-sm text-stone-500">
              {xp ? `+${xp} опыта. Летописец доволен: вы поняли историю.` : score >= BOOK_PASS ? 'Вы снова прочли эту историю.' : `Чтобы получить ${BOOK_XP} опыта, ответьте верно хотя бы на ${BOOK_PASS} вопроса из 5. Книгу можно перечитать.`}
            </p>
          </div>
          <div className="flex-1" />
          <Button className="w-full" onClick={() => nav(-1)}>
            Готово
          </Button>
        </div>
      </Screen>
    );
  }
  return <BookText book={book} words={file.words} onQuiz={() => setPhase('quiz')} />;
}

function BookText({ book, words, onQuiz }: { book: Book; words: BookWord[]; onQuiz(): void }) {
  const [showRu, setShowRu] = useState(false);
  const [picked, setPicked] = useState<{ word: string; ru?: string; entry?: BookWord } | null>(null);
  const cards = useProgress((s) => s.cards);
  const byForm = useMemo(() => new Map(words.flatMap((w) => w.forms.map((f) => [normalize(f), w] as const))), [words]);
  const pick = (word: string, key: string) => {
    const entry = byForm.get(normalize(key));
    setPicked({ word, entry, ru: entry ? entry.ru : wordTranslation(key, book.gloss, book.auto) });
  };
  const text = book.paragraphs.map((p) => p.es).join(' ');
  return (
    <Screen>
      <TopBar title="Книга Летописца" />
      <div className="flex flex-col gap-3 px-4 pb-40">
        <div>
          <h1 className="text-2xl font-bold" data-testid="book-title">
            {book.title.es}
          </h1>
          <div className="text-sm text-stone-500">{book.title.ru} · нажмите на слово, чтобы увидеть перевод</div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => speakAs(text, CHRONICLER)}>
            🔊 Слушать
          </Button>
          <Button variant="secondary" onClick={() => setShowRu(!showRu)} data-testid="book-translate">
            {showRu ? 'Скрыть перевод' : 'Перевод'}
          </Button>
        </div>
        <article className="flex flex-col gap-3 rounded-2xl bg-white p-4 text-lg leading-relaxed shadow-sm" data-testid="book-text">
          {book.paragraphs.map((p, i) => (
            <div key={i}>
              <p>
                {sceneChunks(p.es).map((c, k) =>
                  'words' in c ? (
                    <span key={k} className="whitespace-nowrap">
                      {c.words.map((w, j) => (
                        <span key={j}>
                          {w.pre}
                          <button
                            type="button"
                            className={`rounded underline decoration-dotted underline-offset-4 hover:bg-orange-100 ${byForm.has(normalize(w.key)) ? 'decoration-brand decoration-2' : 'decoration-stone-300'}`}
                            onClick={() => pick(w.word, w.key)}
                          >
                            {w.word}
                          </button>
                          {w.post}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span key={k}>{c.text}</span>
                  ),
                )}
              </p>
              {showRu && <p className="mt-1 text-base text-stone-600">{p.ru}</p>}
            </div>
          ))}
        </article>
        <Button className="w-full" onClick={onQuiz} data-testid="book-quiz">
          К вопросам
        </Button>
      </div>
      {picked && (
        <div className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="dialog-box rounded-xl px-4 py-3 text-white" data-testid="book-word" role="status">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <span className="font-semibold">{picked.entry ? picked.entry.es : picked.word}</span> — {picked.ru ?? 'это слово из уроков грамматики'}
                {picked.entry && <div className="mt-1 text-sm text-stone-300">{picked.entry.example.es}</div>}
              </div>
              <button type="button" aria-label="Закрыть" className="press px-2 text-xl leading-none" onClick={() => setPicked(null)}>
                ×
              </button>
            </div>
            {picked.entry &&
              (cards[picked.entry.id] ? (
                <div className="mt-2 text-sm text-[#9be27a]" data-testid="book-word-mine">
                  ✓ В ваших словах
                </div>
              ) : (
                <Button className="mt-2 w-full" onClick={() => useProgress.getState().addCards([picked.entry!.id])} data-testid="book-add-word">
                  В мои слова
                </Button>
              ))}
          </div>
        </div>
      )}
    </Screen>
  );
}
