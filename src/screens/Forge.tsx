import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { VARIANT, VARIANTS, XP } from '../config';
import { GRAMMAR } from '../content/grammar';
import type { VerbsFile } from '../content/schema';
import { loadVerbs } from '../content/verbs';
import { logAnswer } from '../db/answers';
import { speak, speakAs } from '../audio/tts';
import { checkForm, EXAM_KEYS, type Verdict } from '../domain/answer';
import { answerMs } from '../domain/answerLog';
import { seeded } from '../domain/generators';
import { isVerbId } from '../domain/itemId';
import { plural } from '../domain/medals';
import { dueCards, gradeFor } from '../domain/srs';
import { forgeTasks, openTenses, PERSONS, TENSE_LESSON, TENSE_RU, TENSES, verbCardId, type ForgeTask } from '../domain/verbs';
import { afterPaint } from '../lib/afterPaint';
import { LANG } from '../lang';
import { AccentBar } from '../components/AccentBar';
import { type Feedback, FeedbackSheet } from '../components/FeedbackSheet';
import { NpcPortrait } from '../components/NpcPortrait';
import { Button, Screen, SpeakButton, TopBar } from '../components/ui';
import { useCity } from '../store/city';
import { syncAndEvaluate, useMotivation } from '../store/motivation';
import { useProgress } from '../store/progress';

/** Заданий в одной плавке. */
export const FORGE_SIZE = 10;

type Result = { task: ForgeTask; verdict: Verdict };

/**
 * Кузница глаголов (задача 5.5): кузнец просит выковать форму — глагол, лицо и время из пройденных уроков, ввод
 * с клавиатуры без букв ответа. Ошибка кладёт форму в карточку `v:<глагол>.<время>.<лицо>`, такие формы кузнец
 * даёт первыми в следующих плавках, пока они не закрепятся. В общее повторение они не попадают.
 */
export function ForgeScreen() {
  const nav = useNavigate();
  const grammar = useProgress((s) => s.grammar);
  const cards = useProgress((s) => s.cards);
  const [data, setData] = useState<VerbsFile | null>(null);
  const [phase, setPhase] = useState<'intro' | 'run' | 'result'>('intro');
  const [tasks, setTasks] = useState<ForgeTask[]>([]);
  const [results, setResults] = useState<Result[]>([]);

  useEffect(() => {
    loadVerbs().then(setData);
  }, []);

  if (!data) return null;
  const { smith } = data;
  const say = (text: string) => speakAs(text, smith);
  const tenses = openTenses(LANG, (l) => !!grammar[l]);
  const due = dueCards(Object.values(cards), Date.now()).filter((c) => isVerbId(c.wordId));
  const vosotros = LANG !== 'es' || VARIANTS[VARIANT].vosotros;

  const start = () => {
    setTasks(forgeTasks(data.verbs, LANG, tenses, due.map((c) => c.wordId), FORGE_SIZE, seeded(Date.now()), vosotros));
    setResults([]);
    setPhase('run');
  };

  if (phase === 'run') {
    return (
      <ForgeRun
        tasks={tasks}
        onExit={() => setPhase('intro')}
        onFinish={(r) => {
          const correct = r.filter((x) => x.verdict !== 'wrong').length;
          useCity.getState().addCoins(correct);
          syncAndEvaluate(Date.now(), {});
          setResults(r);
          setPhase('result');
        }}
      />
    );
  }

  if (phase === 'result') {
    const correct = results.filter((r) => r.verdict !== 'wrong').length;
    const misses = results.filter((r) => r.verdict !== 'correct');
    return (
      <Screen>
        <TopBar title="Кузница глаголов" back={false} />
        <div className="flex flex-1 flex-col gap-3 px-5 pb-6">
          <div className="flex flex-col items-center rounded-2xl bg-white p-4 text-center shadow-sm" data-testid="forge-result">
            <NpcPortrait look={smith.look} size={90} label={smith.name} />
            <div className="mt-2 text-lg font-bold">{correct === results.length ? 'Всё выковано без изъяна' : 'Плавка окончена'}</div>
            <p className="text-stone-600 tabular-nums">
              Верно: {correct} из {results.length}
            </p>
            <p className="mt-1 font-semibold text-amber-700 tabular-nums">
              +{correct} 🪙 · +{results.reduce((n, r) => n + (r.verdict === 'correct' ? XP.correct : r.verdict === 'almost' ? XP.almost : 0), 0)} XP
            </p>
          </div>
          {misses.length > 0 && (
            <div className="rounded-2xl bg-white p-4 shadow-sm" data-testid="forge-misses">
              <div className="font-semibold">Кузнец перекуёт в следующий раз</div>
              <ul className="mt-2 flex flex-col gap-1">
                {misses.map(({ task }) => (
                  <li key={verbCardId(task.inf, task.tense, task.person)} className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="text-stone-500">
                      {task.inf}, {PERSONS[LANG][task.person]}, {TENSE_RU[task.tense]}
                    </span>
                    <span className="font-semibold">{task.answer}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex-1" />
          <Button className="w-full" data-testid="forge-again" onClick={start}>
            Ещё плавка
          </Button>
          <Button className="w-full" variant="secondary" onClick={() => nav('/grammar', { replace: true })}>
            К урокам грамматики
          </Button>
        </div>
      </Screen>
    );
  }

  const firstLesson = TENSE_LESSON[LANG][TENSES[LANG][0]]!;
  const firstTitle = GRAMMAR.find((l) => l.id === firstLesson)?.title ?? firstLesson;
  return (
    <Screen>
      <TopBar title="Кузница глаголов" />
      <div className="flex flex-1 flex-col gap-3 px-5 pb-6">
        <div className="rounded-2xl bg-white p-4 shadow-sm" data-testid="forge-intro">
          <div className="flex items-end gap-3">
            <NpcPortrait look={smith.look} size={90} label={smith.name} />
            <div className="min-w-0 flex-1">
              <div className="text-lg font-bold">{smith.name}</div>
              <div className="text-sm text-stone-500">{smith.role}</div>
            </div>
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-orange-50 px-3 py-2">
            <div className="flex-1">
              <div className="font-semibold">{smith.greeting.es}</div>
              <div className="text-sm text-stone-600">{smith.greeting.ru}</div>
            </div>
            <SpeakButton text={smith.greeting.es} />
          </div>
          <p className="mt-3 leading-relaxed text-stone-700">
            Кузнец называет глагол, лицо и время, вы вписываете форму. {FORGE_SIZE} заданий, глаголы из {data.verbs.length}. Ошибки
            кузнец запомнит и даст перековать в следующих плавках.
          </p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="font-semibold">Времена в горне</div>
          <ul className="mt-2 flex flex-wrap gap-2" data-testid="forge-tenses">
            {TENSES[LANG].map((t) => {
              const on = tenses.includes(t);
              return (
                <li
                  key={t}
                  data-tense={t}
                  data-open={on}
                  className={`rounded-full px-3 py-1 text-sm ${on ? 'bg-amber-100 text-amber-900' : 'bg-stone-100 text-stone-400'}`}
                >
                  {on ? '' : '🔒 '}
                  {TENSE_RU[t]}
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-sm text-stone-500">Время открывается, когда пройден его урок грамматики.</p>
          {due.length > 0 && (
            <p className="mt-1 text-sm font-semibold text-amber-700" data-testid="forge-due">
              Ждут перековки: {due.length} {plural(due.length, ['форма', 'формы', 'форм'])}
            </p>
          )}
        </div>
        <div className="flex-1" />
        {tenses.length ? (
          <Button
            className="w-full"
            data-testid="forge-start"
            onClick={() => {
              start();
              say(smith.greeting.es);
            }}
          >
            Разжечь горн
          </Button>
        ) : (
          <p className="rounded-2xl bg-orange-50 px-4 py-3 text-center text-stone-600" data-testid="forge-locked">
            Горн холодный. Кузница откроется после урока «{firstTitle}».{' '}
            <Link to={`/grammar/${firstLesson}`} className="font-semibold text-amber-700 underline">
              К уроку
            </Link>
          </p>
        )}
      </div>
    </Screen>
  );
}

function ForgeRun({ tasks, onFinish, onExit }: { tasks: ForgeTask[]; onFinish(r: Result[]): void; onExit(): void }) {
  const [index, setIndex] = useState(0);
  const [value, setValue] = useState('');
  const [fb, setFb] = useState<Feedback | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const shownAt = useRef(Date.now());
  useEffect(() => {
    shownAt.current = Date.now();
  }, [index]);

  const task = tasks[index];
  if (!task) return null;
  const locked = fb !== null;
  const id = verbCardId(task.inf, task.tense, task.person);

  const submit = () => {
    if (locked || !value.trim()) return;
    const c = checkForm(value, [task.answer, ...task.alt]);
    const now = Date.now();
    const p = useProgress.getState();
    // Ошибка заводит карточку формы, верный ответ двигает уже заведённую. Верную с первого раза форму не храним.
    if (c.verdict !== 'correct' || p.cards[id]) p.applyGrades({ [id]: gradeFor(c.verdict, true) }, now);
    p.addXp(c.verdict === 'correct' ? XP.correct : c.verdict === 'almost' ? XP.almost : 0);
    logAnswer({ itemId: id, kind: `forge-${task.tense}`, verdict: c.verdict, mode: 'forge', ms: answerMs(shownAt.current, now) }, now);
    setResults([...results, { task, verdict: c.verdict }]);
    setFb({
      verdict: c.verdict,
      title: c.verdict === 'correct' ? 'Верно!' : c.verdict === 'almost' ? 'Почти: проверьте ударение' : 'Не та форма',
      answer: task.answer,
      sub: `${PERSONS[LANG][task.person]} · ${TENSE_RU[task.tense]}`,
      speakText: task.answer,
      itemId: id,
    });
    afterPaint(() => {
      if (c.verdict !== 'wrong') speak(task.answer);
      useMotivation.getState().recordTyped(c.verdict === 'correct');
    });
  };
  const next = () => {
    setFb(null);
    setValue('');
    if (index + 1 >= tasks.length) onFinish(results);
    else setIndex(index + 1);
  };
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
  const tone = fb === null ? 'border-stone-300' : fb.verdict === 'correct' ? 'border-ok' : fb.verdict === 'almost' ? 'border-almost' : 'border-bad';

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-6" data-testid="forge-run">
      <div className="flex h-14 items-center gap-3">
        <button type="button" aria-label="Выйти из кузницы" onClick={onExit} className="press h-10 w-10 rounded-full text-xl text-stone-500">
          ✕
        </button>
        <div className="h-3.5 flex-1 overflow-hidden rounded bg-wood p-[2px]">
          <div
            className="h-full w-full origin-left rounded-sm bg-gold"
            style={{ transform: `scaleX(${index / tasks.length})`, transition: 'transform 200ms ease-out' }}
          />
        </div>
        <span className="text-sm text-stone-500 tabular-nums" data-testid="forge-progress">
          {index + 1} / {tasks.length}
        </span>
      </div>
      <div className="font-pixel text-xs tracking-widest text-amber-700 uppercase">Кузница</div>
      <div
        key={index}
        className={`flex flex-1 flex-col pt-2 ${locked ? 'pb-64' : ''}`}
        data-testid="forge-task"
        data-inf={task.inf}
        data-tense={task.tense}
        data-person={task.person}
      >
        <div className="text-sm font-medium text-stone-500">Выкуйте форму</div>
        <div className="mt-5 text-3xl font-bold" lang={LANG}>
          {task.inf}
        </div>
        <div className="text-stone-500">{task.ru}</div>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-900" lang={LANG}>
            {PERSONS[LANG][task.person]}
          </span>
          <span className="rounded-full bg-stone-100 px-3 py-1 text-stone-700">{TENSE_RU[task.tense]}</span>
        </div>
        <form
          className="mt-6 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
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
            className={`h-14 rounded-2xl border-2 bg-white px-4 text-xl outline-none focus:border-brand ${tone}`}
            placeholder="Форма"
            aria-label="Форма глагола"
          />
          {!locked && (
            <Button type="submit" disabled={!value.trim()} className="w-full">
              Проверить
            </Button>
          )}
        </form>
      </div>
      <FeedbackSheet fb={fb} onNext={next} />
    </div>
  );
}
