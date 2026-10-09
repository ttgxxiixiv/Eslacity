import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { loadLetter, loadLetters, loadNote, loadNotes } from '../content/letters';
import { LOCATION_BY_ID } from '../content/locations';
import { npcFor } from '../content/npcs';
import type { Letter, Note } from '../content/schema';
import { AccentBar } from '../components/AccentBar';
import { NpcPortrait } from '../components/NpcPortrait';
import { Button, Screen, SpeakButton, TopBar } from '../components/ui';
import { EXAM_KEYS } from '../domain/answer';
import { chapterById } from '../domain/chapters';
import { REGISTER_LABEL } from '../domain/expression';
import { canSend, LETTER_MAX_WORDS, LETTER_MIN_WORDS, wordCount, type LetterEntry } from '../domain/letter';
import { plural } from '../domain/medals';
import { canSendNote, checkNote, NOTE_MIN_WORDS, NOTE_SAMPLE_WORDS, noteXp, type NoteCheck } from '../domain/note';
import { LANG } from '../lang';
import { byHero } from '../store/settings';
import { useJourney } from '../store/journey';
import { useLetters } from '../store/letters';

/** Вставка буквы с ударением и стирание в поле текста письма или записки: по месту курсора. */
function useTextEdit(text: string, setText: (t: string) => void) {
  const area = useRef<HTMLTextAreaElement>(null);
  const insert = (ch: string) => {
    const el = area.current;
    if (!el) return;
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    setText(text.slice(0, start) + ch + text.slice(end));
    requestAnimationFrame(() => el.setSelectionRange(start + ch.length, start + ch.length));
  };
  const backspace = () => {
    const el = area.current;
    if (!el) return;
    const end = el.selectionEnd ?? text.length;
    const start = el.selectionStart ?? text.length;
    const from = start === end ? Math.max(0, start - 1) : start;
    setText(text.slice(0, from) + text.slice(end));
    requestAnimationFrame(() => el.setSelectionRange(from, from));
  };
  return { area, insert, backspace };
}

/** Просьба жителя: портрет, имя, место и реплика на изучаемом языке с переводом. */
function RequestCard({ item }: { item: Letter | Note }) {
  const npc = npcFor(item.location);
  if (!npc) return null;
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-white p-3 shadow-sm">
      <NpcPortrait look={npc.look} size={72} label={npc.name} />
      <div className="min-w-0 flex-1">
        <div className="text-sm text-stone-500">
          <span className="font-bold text-stone-800">{npc.name}</span> · {LOCATION_BY_ID[item.location]?.ru}
        </div>
        <div className="mt-1 flex items-start gap-2">
          <p className="flex-1 font-semibold" lang={LANG}>{item.request.es}</p>
          <SpeakButton text={item.request.es} />
        </div>
        <p className="text-sm text-stone-500">{item.request.ru}</p>
      </div>
    </div>
  );
}

/** Счётчик слов под полем: сколько написано и сколько нужно. */
function WordCounter({ n }: { n: number }) {
  const tone = n < LETTER_MIN_WORDS ? 'text-stone-500' : n > LETTER_MAX_WORDS ? 'text-amber-700' : 'text-ok';
  const hint = n < LETTER_MIN_WORDS ? `нужно ${LETTER_MIN_WORDS}–${LETTER_MAX_WORDS}` : n > LETTER_MAX_WORDS ? 'длиннее образца, но это не страшно' : 'в самый раз';
  return (
    <p className={`text-sm tabular-nums ${tone}`} data-testid="letter-words">
      {n} {plural(n, ['слово', 'слова', 'слов'])} · {hint}
    </p>
  );
}

/**
 * Письмо с образцом (задача 7.7): житель просит письмо, герой пишет его сам, потом видит образец и отмечает
 * по чек-листу, что у него получилось. Оценки нет, опыт — за первое письмо по просьбе. Письмо уходит в дневник.
 */
export function LetterScreen() {
  const id = decodeURIComponent(useParams().id ?? '');
  const nav = useNavigate();
  const opened = useJourney((s) => s.opened);
  const [letter, setLetter] = useState<Letter | null | undefined>(undefined);
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<'write' | 'compare' | 'done'>('write');
  const [checks, setChecks] = useState<number[]>([]);
  const [xp, setXp] = useState(0);
  const { area, insert, backspace } = useTextEdit(text, setText);

  useEffect(() => {
    loadLetter(id).then((l) => setLetter(l ?? null));
  }, [id]);

  if (letter === undefined) return null;
  if (!letter || letter.chapter > opened) {
    return (
      <Screen>
        <TopBar title="Письмо" />
        <p className="px-5 py-6 text-stone-600">
          {letter ? `Это письмо откроется в главе ${chapterById(letter.chapter)?.roman}.` : 'Такого письма нет.'}
        </p>
      </Screen>
    );
  }

  const n = wordCount(text);

  const save = () => {
    const entry: LetterEntry = { letterId: letter.id, text: text.trim(), checks: [...checks].sort((a, b) => a - b), at: Date.now() };
    setXp(useLetters.getState().save(entry));
    setPhase('done');
  };

  return (
    <Screen>
      <TopBar title={`✉️ ${letter.title}`} />
      <div className="flex flex-col gap-4 px-5 pb-8">
        <RequestCard item={letter} />

        {phase === 'write' && (
          <>
            <div className="rounded-2xl bg-amber-50 px-4 py-3">
              <div className="mb-1 text-xs font-bold tracking-wide text-amber-700 uppercase">
                Задание · {REGISTER_LABEL[letter.register]}
              </div>
              <p data-testid="letter-task">{letter.task}</p>
            </div>
            <textarea
              ref={area}
              lang={LANG}
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={10}
              aria-label="Ваше письмо"
              data-testid="letter-text"
              className="w-full rounded-2xl border-2 border-stone-300 bg-white p-3 text-[17px] leading-relaxed focus:border-wood focus:outline-none"
              placeholder="Напишите письмо здесь…"
            />
            <WordCounter n={n} />
            <AccentBar keys={EXAM_KEYS[LANG]} onKey={insert} onBackspace={backspace} />
            <Button disabled={!canSend(text)} onClick={() => setPhase('compare')}>
              Сравнить с образцом
            </Button>
            <p className="text-center text-xs text-stone-500">Письмо не оценивается: вы сами сравните его с образцом.</p>
          </>
        )}

        {phase !== 'write' && (
          <>
            <section className="rounded-2xl bg-white p-4 shadow-sm">
              <h2 className="mb-2 font-bold">Ваше письмо</h2>
              <p className="whitespace-pre-wrap" lang={LANG} data-testid="letter-mine">{text.trim()}</p>
            </section>
            <section className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-bold">Образец</h2>
                <SpeakButton text={byHero(letter).sample.replace(/\n/g, ' ')} />
              </div>
              <p className="whitespace-pre-wrap" lang={LANG} data-testid="letter-sample">{byHero(letter).sample}</p>
            </section>
            <section className="rounded-2xl bg-white p-4 shadow-sm" data-testid="letter-checks">
              <h2 className="font-bold">Что есть в вашем письме?</h2>
              <p className="mb-2 text-sm text-stone-500">Отметьте, что получилось. Примеры — из образца.</p>
              <ul className="flex flex-col gap-2">
                {letter.checks.map((c, i) => {
                  const on = checks.includes(i);
                  return (
                    <li key={i}>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={on}
                        disabled={phase === 'done'}
                        onClick={() => setChecks(on ? checks.filter((x) => x !== i) : [...checks, i])}
                        className={`press flex w-full items-start gap-3 rounded-xl border-2 px-3 py-2 text-left ${on ? 'border-ok bg-okbg' : 'border-stone-200'}`}
                      >
                        <span className="mt-0.5 text-lg" aria-hidden>{on ? '☑' : '☐'}</span>
                        <span>
                          <span className="font-semibold">{c.label}</span>
                          <span className="block text-sm text-stone-600 italic" lang={LANG}>{c.examples.join(' · ')}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
            {phase === 'compare' ? (
              <div className="flex flex-col gap-2">
                <Button onClick={save}>Записать в дневник</Button>
                <Button variant="secondary" onClick={() => setPhase('write')}>
                  Исправить письмо
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2 rounded-2xl bg-okbg p-4 text-center" data-testid="letter-done">
                <div className="font-semibold">
                  Письмо в дневнике · {checks.length} из {letter.checks.length}
                </div>
                {xp > 0 && <div className="font-semibold text-amber-700">+{xp} опыта</div>}
                <Link to="/letters" className="press text-sm text-stone-600 underline">Дневник писем →</Link>
                <Button onClick={() => nav(-1)}>Готово</Button>
              </div>
            )}
          </>
        )}
      </div>
    </Screen>
  );
}

/**
 * Записка жителю (задача 12.5): короткое письмо с главы II. Проверка частичная: ищутся слова и формы из списка
 * `must`, на пропущенное — подсказка, можно исправить или отправить как есть. Образец — после отправки. Опыт —
 * за первую записку, где есть всё из списка. Записка уходит в тот же дневник, что и письма.
 */
export function NoteScreen() {
  const id = decodeURIComponent(useParams().id ?? '');
  const nav = useNavigate();
  const opened = useJourney((s) => s.opened);
  const [note, setNote] = useState<Note | null | undefined>(undefined);
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<'write' | 'check' | 'done'>('write');
  const [result, setResult] = useState<NoteCheck>({ found: [], missing: [] });
  const [xp, setXp] = useState(0);
  const { area, insert, backspace } = useTextEdit(text, setText);

  useEffect(() => {
    loadNote(id).then((n) => setNote(n ?? null));
  }, [id]);

  if (note === undefined) return null;
  if (!note || note.chapter > opened) {
    return (
      <Screen>
        <TopBar title="Записка" />
        <p className="px-5 py-6 text-stone-600">
          {note ? `Эта записка откроется в главе ${chapterById(note.chapter)?.roman}.` : 'Такой записки нет.'}
        </p>
      </Screen>
    );
  }

  const n = wordCount(text);
  const check = () => {
    setResult(checkNote(text, note.must));
    setPhase('check');
  };
  const send = () => {
    const entry: LetterEntry = { letterId: note.id, text: text.trim(), checks: result.found, at: Date.now() };
    setXp(useLetters.getState().save(entry, noteXp(useLetters.getState().entries, note.id, note.must.length, result)));
    setPhase('done');
  };

  return (
    <Screen>
      <TopBar title={`📝 ${note.title}`} />
      <div className="flex flex-col gap-4 px-5 pb-8">
        <RequestCard item={note} />

        {phase === 'write' && (
          <>
            <div className="rounded-2xl bg-amber-50 px-4 py-3">
              <div className="mb-1 text-xs font-bold tracking-wide text-amber-700 uppercase">
                Записка · {REGISTER_LABEL[note.register]}
              </div>
              <p data-testid="note-task">{note.task}</p>
            </div>
            <textarea
              ref={area}
              lang={LANG}
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              aria-label="Ваша записка"
              data-testid="note-text"
              className="w-full rounded-2xl border-2 border-stone-300 bg-white p-3 text-[17px] leading-relaxed focus:border-wood focus:outline-none"
              placeholder="Напишите записку здесь…"
            />
            <p className={`text-sm tabular-nums ${n < NOTE_MIN_WORDS ? 'text-stone-500' : 'text-ok'}`} data-testid="note-words">
              {n} {plural(n, ['слово', 'слова', 'слов'])} · {n < NOTE_MIN_WORDS ? `нужно хотя бы ${NOTE_MIN_WORDS}` : `в образце ${NOTE_SAMPLE_WORDS.join('–')}`}
            </p>
            <AccentBar keys={EXAM_KEYS[LANG]} onKey={insert} onBackspace={backspace} />
            <Button disabled={!canSendNote(text)} onClick={check}>
              Проверить
            </Button>
          </>
        )}

        {phase !== 'write' && (
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="mb-2 font-bold">Ваша записка</h2>
            <p className="whitespace-pre-wrap" lang={LANG} data-testid="note-mine">{text.trim()}</p>
          </section>
        )}

        {phase !== 'write' && (
          <section className="rounded-2xl bg-white p-4 shadow-sm" data-testid="note-check">
            <h2 className="font-bold">
              Что есть в записке · {result.found.length} из {note.must.length}
            </h2>
            <ul className="mt-2 flex flex-col gap-2">
              {note.must.map((m, i) => {
                const ok = result.found.includes(i);
                return (
                  <li key={i} data-testid="note-must" data-ok={ok} className={`rounded-xl border-2 px-3 py-2 ${ok ? 'border-ok bg-okbg' : 'border-amber-300 bg-amber-50'}`}>
                    <div className="font-semibold">
                      <span aria-hidden>{ok ? '✓ ' : '✗ '}</span>
                      {m.label}
                    </div>
                    {!ok && <p className="text-sm text-stone-700">{m.hint}</p>}
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-xs text-stone-500">Проверка ищет только слова и формы из списка: остальное вы сравните с образцом сами.</p>
          </section>
        )}

        {phase === 'check' && (
          <div className="flex flex-col gap-2">
            {result.missing.length > 0 && (
              <Button onClick={() => setPhase('write')}>Исправить записку</Button>
            )}
            <Button variant={result.missing.length ? 'secondary' : 'primary'} onClick={send}>
              {result.missing.length ? 'Отправить как есть' : 'Отправить'}
            </Button>
          </div>
        )}

        {phase === 'done' && (
          <>
            <section className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-bold">Образец</h2>
                <SpeakButton text={byHero(note).sample.replace(/\n/g, ' ')} />
              </div>
              <p className="whitespace-pre-wrap" lang={LANG} data-testid="note-sample">{byHero(note).sample}</p>
            </section>
            <div className="flex flex-col gap-2 rounded-2xl bg-okbg p-4 text-center" data-testid="note-done">
              <div className="font-semibold">Записка в дневнике · {result.found.length} из {note.must.length}</div>
              {xp > 0 && <div className="font-semibold text-amber-700">+{xp} опыта</div>}
              <Link to="/letters" className="press text-sm text-stone-600 underline">Дневник писем →</Link>
              <Button onClick={() => nav(-1)}>Готово</Button>
            </div>
          </>
        )}
      </div>
    </Screen>
  );
}

/** Дневник писем в профиле: всё, что герой написал, новые сверху, по нажатию — текст письма. */
export function LettersDiaryScreen() {
  const entries = useLetters((s) => s.entries);
  const [letters, setLetters] = useState<Record<string, Letter | Note>>({});
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => {
    Promise.all([loadLetters(), loadNotes()]).then(([ls, ns]) => setLetters(Object.fromEntries([...ls, ...ns].map((l) => [l.id, l]))));
  }, []);
  const list = entries.map((e, i) => ({ e, i })).reverse();

  return (
    <Screen>
      <TopBar title="Дневник писем" />
      <div className="flex flex-col gap-3 px-4 pb-6" data-testid="letters-diary">
        {!list.length && (
          <div className="rounded-2xl bg-white p-4 text-center shadow-sm">
            <div className="text-4xl">✉️</div>
            <div className="mt-1 font-semibold">Пока ни одного письма</div>
            <p className="text-sm text-stone-500">С горного перевала жители просят оставить им записку, а в Лабиринте Эха — написать письмо: ищите их в местах города.</p>
          </div>
        )}
        {list.map(({ e, i }) => {
          const l = letters[e.letterId];
          const npc = l ? npcFor(l.location) : undefined;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setOpen(open === i ? null : i)}
              className="press rounded-2xl bg-white p-3 text-left shadow-sm"
              data-testid="diary-entry"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold">{l && 'must' in l ? '📝' : '✉️'} {l?.title ?? e.letterId}</span>
                <span className="shrink-0 text-xs text-stone-500 tabular-nums">{new Date(e.at).toLocaleDateString('ru-RU')}</span>
              </div>
              <div className="text-sm text-stone-500 tabular-nums">
                {npc?.name} · {wordCount(e.text)} {plural(wordCount(e.text), ['слово', 'слова', 'слов'])}
                {l ? ('must' in l ? ` · записка ${e.checks.length} из ${l.must.length}` : ` · чек-лист ${e.checks.length} из ${l.checks.length}`) : ''}
              </div>
              {open === i && <p className="mt-2 whitespace-pre-wrap" lang={LANG}>{e.text}</p>}
            </button>
          );
        })}
      </div>
    </Screen>
  );
}
