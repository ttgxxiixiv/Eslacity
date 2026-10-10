import { useRef, useState, type ReactNode, type RefObject } from 'react';
import { EXAM_KEYS, type Verdict } from '../../domain/answer';
import { diagnoseGrammar, fixWords, grammarTitle, tableForms, type GrammarCheck, type GrammarInput, type GrammarItem } from '../../domain/grammar';
import { cachedLesson, GRAMMAR } from '../../content/grammar';
import { lessonOfExercise } from '../../domain/itemId';
import type { GrammarExercise, Register } from '../../content/schema';
import type { Feedback } from '../FeedbackSheet';
import { LANG } from '../../lang';
import { AccentBar } from '../AccentBar';
import { Button } from '../ui';

/**
 * Итог ответа на упражнение грамматики: заголовок, правильный ответ, причина ошибки (задача 12.3), объяснение
 * правила. `rule` — показать урок правила: 'link' в повторении, 'text' в испытаниях (уйти из испытания нельзя),
 * в самом уроке не нужен.
 */
export function grammarFeedback(item: GrammarItem, c: GrammarCheck, input?: GrammarInput, rule?: 'link' | 'text'): Feedback {
  const lessonId = lessonOfExercise(item.ex.id);
  const lesson = cachedLesson(lessonId);
  const why = input ? diagnoseGrammar(item, input, c, lesson ? tableForms(lesson.theory) : []) : undefined;
  const accent = !why && c.reason === 'accent' ? 'Обратите внимание на ударение.' : '';
  const meta = rule ? GRAMMAR.find((l) => l.id === lessonId) : undefined;
  return {
    verdict: c.verdict,
    title: grammarTitle(item, c),
    answer: c.shown,
    note: [why?.text, accent, item.ex.explain].filter(Boolean).join(' '),
    speakText: c.speak,
    why: why?.kind,
    rule: meta ? { title: meta.title, to: rule === 'link' ? `/grammar/${meta.id}` : undefined } : undefined,
  };
}

const TO_REGISTER: Record<Register, string> = {
  formal: 'Скажите официально',
  neutral: 'Скажите нейтрально',
  informal: 'Скажите по-дружески',
};

const LABEL: Record<Exclude<GrammarExercise['kind'], 'register'>, string> = {
  choose: 'Выберите форму',
  gap: 'Заполните пропуск',
  truefalse: 'Верно или неверно?',
  build: 'Соберите предложение',
  type: 'Впишите форму',
  transform: 'Перескажите с этим словом',
  cloze: 'Заполните пропуски',
  fix: 'Найдите ошибку',
  combine: 'Соедините фразы',
  paraphrase: 'Что значит то же самое?',
};

const label = (ex: GrammarExercise) => (ex.kind === 'register' ? TO_REGISTER[ex.to] : LABEL[ex.kind]);

/**
 * Упражнение грамматики: выбор формы, пропуск, верно/неверно, сборка, ввод формы и задания C1 (пересказ
 * с ключевым словом, текст с пропусками, поиск ошибки, другой регистр, связка, тот же смысл).
 * Общее для урока, повторения и стражей. verdict — итог проверки (null, пока ответа нет): после него всё закрыто.
 */
export function GrammarItemView({ item, verdict, onAnswer }: { item: GrammarItem; verdict: Verdict | null; onAnswer: (a: GrammarInput) => void }) {
  const { ex } = item;
  const props = { item, verdict, onAnswer };
  let body: ReactNode;
  if (item.tiles) body = <BuildView {...props} />;
  else if (ex.kind === 'type') body = <TypeView {...props} />;
  else if (ex.kind === 'transform' || ex.kind === 'combine') body = <SentenceView {...props} />;
  else if (ex.kind === 'cloze') body = <ClozeView {...props} />;
  else if (ex.kind === 'fix') body = <FixView {...props} />;
  else body = <ChoiceView {...props} />;
  return (
    <div className="flex flex-1 flex-col" data-ex={ex.id}>
      <div className="text-sm font-medium text-stone-500">{label(ex)}</div>
      {body}
    </div>
  );
}

type ViewProps = { item: GrammarItem; verdict: Verdict | null; onAnswer: (a: GrammarInput) => void };

/** Перевод под заданием, если он есть. */
function Ru({ ex }: { ex: GrammarExercise }) {
  return 'ru' in ex && ex.ru ? <div className="mt-2 text-stone-500">{ex.ru}</div> : null;
}

function ChoiceView({ item, verdict, onAnswer }: ViewProps) {
  const { ex } = item;
  const [picked, setPicked] = useState<number | null>(null);
  const shownWord = picked === null ? null : item.options[picked];
  return (
    <>
      <div className="mt-5 text-2xl leading-snug font-bold">
        {ex.kind === 'choose' && ex.prompt}
        {ex.kind === 'truefalse' && ex.statement}
        {ex.kind === 'paraphrase' && ex.sentence}
        {ex.kind === 'register' && ex.source}
        {ex.kind === 'gap' &&
          ex.sentence.split('___').map((part, i) => (
            <span key={i}>
              {i > 0 && (
                <span
                  className={`mx-1 inline-block min-w-16 border-b-4 text-center ${
                    shownWord === null ? 'border-stone-300' : picked === item.answer ? 'border-ok text-ok' : 'border-bad text-bad'
                  }`}
                >
                  {shownWord ?? ' '}
                </span>
              )}
              {part}
            </span>
          ))}
      </div>
      <Ru ex={ex} />
      <div className={`mt-8 grid gap-3 ${ex.kind === 'truefalse' ? 'grid-cols-2' : ''}`}>
        {item.options.map((o, i) => {
          let cls = 'bg-white border-stone-300';
          if (picked !== null) {
            if (i === item.answer) cls = 'bg-okbg border-ok text-ok';
            else if (i === picked) cls = 'bg-badbg border-bad text-bad';
            else cls = 'bg-white border-stone-200 opacity-60';
          }
          return (
            <button
              key={i}
              type="button"
              onClick={() => {
                if (picked !== null || verdict !== null) return;
                setPicked(i);
                onAnswer({ pick: i });
              }}
              className={`press min-h-14 rounded-2xl border-2 px-4 py-3 text-lg font-medium ${ex.kind === 'truefalse' ? 'text-center' : 'text-left'} ${cls}`}
            >
              {o}
            </button>
          );
        })}
      </div>
    </>
  );
}

/** Сборка предложения из плиток: по переводу (build) или ту же мысль в другом регистре (register). */
function BuildView({ item, verdict, onAnswer }: ViewProps) {
  const tiles = item.tiles ?? [];
  const [chosen, setChosen] = useState<number[]>([]);
  const locked = verdict !== null;
  const tone = verdict === null ? 'border-stone-300' : verdict === 'wrong' ? 'border-bad bg-badbg' : 'border-ok bg-okbg';
  const extra = 'extra' in item.ex ? item.ex.extra.length : 0;
  return (
    <>
      <div className="mt-5 text-2xl leading-snug font-bold" data-testid="grammar-prompt">
        {item.ex.kind === 'register' ? item.ex.source : 'ru' in item.ex ? item.ex.ru : ''}
      </div>
      <p className="mt-1 text-sm text-stone-500">
        {extra === 1 ? 'Одна плитка лишняя.' : `Лишних плиток: ${extra}.`}
      </p>
      <div className={`mt-4 flex min-h-24 flex-wrap content-start gap-2 rounded-2xl border-2 border-dashed p-2 ${tone}`}>
        {chosen.map((idx, pos) => (
          <button
            key={idx}
            type="button"
            disabled={locked}
            onClick={() => setChosen(chosen.filter((_, p) => p !== pos))}
            className="press h-11 rounded-xl bg-white px-3 text-lg shadow-sm"
          >
            {tiles[idx]}
          </button>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-2" data-testid="grammar-tiles">
        {tiles.map((t, idx) => {
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
        <Button className="mt-6 w-full" disabled={!chosen.length} onClick={() => onAnswer({ tiles: chosen.map((i) => tiles[i]) })}>
          Проверить
        </Button>
      )}
    </>
  );
}

/**
 * Вставка буквы с ударением в место курсора поля и «стереть». Над полем только буквы с ударением языка:
 * буквы ответа подсказали бы форму, а в ней весь смысл задания.
 */
function caretEditing(value: string, setValue: (v: string) => void, input: RefObject<HTMLInputElement | null>) {
  const insert = (ch: string) => {
    const el = input.current;
    if (!el) return;
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    setValue(value.slice(0, start) + ch + value.slice(end));
    requestAnimationFrame(() => el.setSelectionRange(start + ch.length, start + ch.length));
  };
  const backspace = () => {
    const el = input.current;
    if (!el) return;
    const end = el.selectionEnd ?? value.length;
    const start = el.selectionStart ?? value.length;
    const from = start === end ? Math.max(0, start - 1) : start;
    setValue(value.slice(0, from) + value.slice(end));
    requestAnimationFrame(() => el.setSelectionRange(from, from));
  };
  return { insert, backspace };
}

const verdictTone = (v: Verdict | null) =>
  v === null ? 'border-stone-300' : v === 'correct' ? 'border-ok' : v === 'almost' ? 'border-almost' : 'border-bad';

/** Поле ввода с буквами с ударением и кнопкой «Проверить». `onChange` — если текст нужен снаружи (пропуск в предложении). */
function AnswerField({ verdict, placeholder, onSubmit, onChange }: {
  verdict: Verdict | null; placeholder: string; onSubmit: (text: string) => void; onChange?: (text: string) => void;
}) {
  const [value, setRaw] = useState('');
  const setValue = (v: string) => {
    setRaw(v);
    onChange?.(v);
  };
  const input = useRef<HTMLInputElement>(null);
  const { insert, backspace } = caretEditing(value, setValue, input);
  const locked = verdict !== null;
  return (
    <form
      className="mt-6 flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!locked && value.trim()) onSubmit(value);
      }}
    >
      <AccentBar keys={EXAM_KEYS[LANG]} onKey={insert} onBackspace={backspace} disabled={locked} />
      <input
        ref={input}
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        readOnly={locked}
        lang={LANG}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="done"
        className={`h-14 rounded-2xl border-2 bg-white px-4 text-xl outline-none focus:border-brand ${verdictTone(verdict)}`}
        placeholder={placeholder}
      />
      {!locked && (
        <Button type="submit" disabled={!value.trim()} className="w-full">
          Проверить
        </Button>
      )}
    </form>
  );
}

/** Ввод формы в пропуск. */
function TypeView({ item, verdict, onAnswer }: ViewProps) {
  const ex = item.ex.kind === 'type' ? item.ex : null;
  const [value, setValue] = useState('');
  if (!ex) return null;
  const [before, after] = ex.sentence.split('___');
  return (
    <>
      <div className="mt-5 text-2xl leading-snug font-bold" data-testid="grammar-prompt">
        {before}
        <span className="mx-1 inline-block min-w-16 border-b-4 border-stone-300 text-center text-stone-500">{value.trim() || ' '}</span>
        {after}
      </div>
      {ex.hint && <div className="mt-1 text-sm text-stone-500" data-testid="grammar-hint">({ex.hint})</div>}
      <div className="mt-2 text-stone-500">{ex.ru}</div>
      <AnswerField verdict={verdict} placeholder="Форма" onChange={setValue} onSubmit={(text) => onAnswer({ text })} />
    </>
  );
}

/** Пересказ с ключевым словом (transform) и соединение двух фраз связкой (combine): ввод целой фразы. */
function SentenceView({ item, verdict, onAnswer }: ViewProps) {
  const { ex } = item;
  if (ex.kind !== 'transform' && ex.kind !== 'combine') return null;
  return (
    <>
      {ex.kind === 'transform' ? (
        <div className="mt-5 text-2xl leading-snug font-bold">{ex.source}</div>
      ) : (
        <div className="mt-5 flex flex-col gap-2 text-xl leading-snug font-bold">
          <div>{ex.first}</div>
          <div>{ex.second}</div>
        </div>
      )}
      <Ru ex={ex} />
      <div className="mt-3 flex items-center gap-2 text-stone-600">
        <span>{ex.kind === 'transform' ? 'Слово:' : 'Связка:'}</span>
        <span className="rounded-lg border-2 border-amber-700/40 bg-amber-50 px-2 py-0.5 font-semibold text-amber-900" data-testid="grammar-key">
          {ex.kind === 'transform' ? ex.keyword : ex.connector}
        </span>
      </div>
      <AnswerField verdict={verdict} placeholder="Фраза целиком" onSubmit={(text) => onAnswer({ text })} />
    </>
  );
}

/** Связный текст с несколькими пропусками без вариантов: поле в каждом пропуске. */
function ClozeView({ item, verdict, onAnswer }: ViewProps) {
  const ex = item.ex.kind === 'cloze' ? item.ex : null;
  const parts = ex ? ex.text.split('___') : [];
  const [values, setValues] = useState<string[]>(() => parts.slice(1).map(() => ''));
  const [focus, setFocus] = useState(0);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const locked = verdict !== null;
  if (!ex) return null;
  const set = (i: number, v: string) => setValues(values.map((x, j) => (j === i ? v : x)));
  const current = { current: inputs.current[focus] ?? null };
  const { insert, backspace } = caretEditing(values[focus] ?? '', (v) => set(focus, v), current);
  const ready = values.every((v) => v.trim());
  return (
    <form
      className="flex flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        if (!locked && ready) onAnswer({ texts: values });
      }}
    >
      <div className="mt-5 text-xl leading-loose">
        {parts.map((part, i) => (
          <span key={i}>
            {i > 0 && (
              <input
                ref={(el) => {
                  inputs.current[i - 1] = el;
                }}
                autoFocus={i === 1}
                value={values[i - 1]}
                onFocus={() => setFocus(i - 1)}
                onChange={(e) => set(i - 1, e.target.value)}
                readOnly={locked}
                lang={LANG}
                aria-label={`Пропуск ${i}`}
                autoCapitalize="off"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                className={`mx-1 inline-block w-28 border-b-4 bg-transparent text-center font-semibold outline-none focus:border-brand ${verdictTone(verdict)}`}
              />
            )}
            {part}
          </span>
        ))}
      </div>
      <Ru ex={ex} />
      <div className="mt-6">
        <AccentBar keys={EXAM_KEYS[LANG]} onKey={insert} onBackspace={backspace} disabled={locked} />
      </div>
      <div className="flex-1" />
      {!locked && (
        <Button type="submit" disabled={!ready} className="mt-6 w-full">
          Проверить
        </Button>
      )}
    </form>
  );
}

/** Найти слово с ошибкой: сначала нажать на него, потом вписать верную форму. */
function FixView({ item, verdict, onAnswer }: ViewProps) {
  const ex = item.ex.kind === 'fix' ? item.ex : null;
  const [at, setAt] = useState<number | null>(null);
  const locked = verdict !== null;
  if (!ex) return null;
  const words = fixWords(ex.sentence);
  return (
    <>
      <div className="mt-5 flex flex-wrap gap-x-1.5 gap-y-2 text-2xl leading-snug font-bold" data-testid="fix-words">
        {words.map((w, i) => {
          const picked = at === i;
          const tone = !picked ? 'border-transparent' : verdict === null ? 'border-brand bg-amber-50' : verdict === 'wrong' ? 'border-bad bg-badbg' : 'border-ok bg-okbg';
          return (
            <button key={i} type="button" disabled={locked} onClick={() => setAt(i)} className={`press rounded-lg border-2 px-1 ${tone}`}>
              {w}
            </button>
          );
        })}
      </div>
      <Ru ex={ex} />
      {at === null ? (
        <p className="mt-6 text-stone-500">Нажмите на слово с ошибкой.</p>
      ) : (
        <AnswerField key={at} verdict={verdict} placeholder={`Вместо «${words[at]}»`} onSubmit={(text) => onAnswer({ at, text })} />
      )}
    </>
  );
}
