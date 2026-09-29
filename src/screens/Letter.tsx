import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { loadLetter, loadLetters } from '../content/letters';
import { LOCATION_BY_ID } from '../content/locations';
import { npcFor } from '../content/npcs';
import type { Letter } from '../content/schema';
import { AccentBar } from '../components/AccentBar';
import { NpcPortrait } from '../components/NpcPortrait';
import { Button, Screen, SpeakButton, TopBar } from '../components/ui';
import { EXAM_KEYS } from '../domain/answer';
import { chapterById } from '../domain/chapters';
import { REGISTER_LABEL } from '../domain/expression';
import { canSend, LETTER_MAX_WORDS, LETTER_MIN_WORDS, wordCount, type LetterEntry } from '../domain/letter';
import { plural } from '../domain/medals';
import { LANG } from '../lang';
import { useJourney } from '../store/journey';
import { useLetters } from '../store/letters';

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
  const area = useRef<HTMLTextAreaElement>(null);

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

  const npc = npcFor(letter.location);
  const n = wordCount(text);

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

  const save = () => {
    const entry: LetterEntry = { letterId: letter.id, text: text.trim(), checks: [...checks].sort((a, b) => a - b), at: Date.now() };
    setXp(useLetters.getState().save(entry));
    setPhase('done');
  };

  return (
    <Screen>
      <TopBar title={`✉️ ${letter.title}`} />
      <div className="flex flex-col gap-4 px-5 pb-8">
        {npc && (
          <div className="flex items-start gap-3 rounded-2xl bg-white p-3 shadow-sm">
            <NpcPortrait look={npc.look} size={72} label={npc.name} />
            <div className="min-w-0 flex-1">
              <div className="text-sm text-stone-500">
                <span className="font-bold text-stone-800">{npc.name}</span> · {LOCATION_BY_ID[letter.location]?.ru}
              </div>
              <div className="mt-1 flex items-start gap-2">
                <p className="flex-1 font-semibold" lang={LANG}>{letter.request.es}</p>
                <SpeakButton text={letter.request.es} />
              </div>
              <p className="text-sm text-stone-500">{letter.request.ru}</p>
            </div>
          </div>
        )}

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
                <SpeakButton text={letter.sample.replace(/\n/g, ' ')} />
              </div>
              <p className="whitespace-pre-wrap" lang={LANG} data-testid="letter-sample">{letter.sample}</p>
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

/** Дневник писем в профиле: всё, что герой написал, новые сверху, по нажатию — текст письма. */
export function LettersDiaryScreen() {
  const entries = useLetters((s) => s.entries);
  const [letters, setLetters] = useState<Record<string, Letter>>({});
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => {
    loadLetters().then((list) => setLetters(Object.fromEntries(list.map((l) => [l.id, l]))));
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
            <p className="text-sm text-stone-500">В Лабиринте Эха жители просят написать им письмо: ищите «Письмо» в местах города.</p>
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
                <span className="font-semibold">✉️ {l?.title ?? e.letterId}</span>
                <span className="shrink-0 text-xs text-stone-500 tabular-nums">{new Date(e.at).toLocaleDateString('ru-RU')}</span>
              </div>
              <div className="text-sm text-stone-500 tabular-nums">
                {npc?.name} · {wordCount(e.text)} {plural(wordCount(e.text), ['слово', 'слова', 'слов'])}
                {l ? ` · чек-лист ${e.checks.length} из ${l.checks.length}` : ''}
              </div>
              {open === i && <p className="mt-2 whitespace-pre-wrap" lang={LANG}>{e.text}</p>}
            </button>
          );
        })}
      </div>
    </Screen>
  );
}
