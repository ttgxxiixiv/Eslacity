import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { XP } from '../config';
import type { PairsFile } from '../content/schema';
import { loadPairs } from '../content/pairs';
import { logAnswer } from '../db/answers';
import { listeningEnabled, speak, speakAs, untilSpoken } from '../audio/tts';
import { answerMs } from '../domain/answerLog';
import { seeded } from '../domain/generators';
import { BELLS_SIZE, pairItemId, pairTasks, pairVerdict, retryTask, type PairTask } from '../domain/minimalPairs';
import { afterPaint } from '../lib/afterPaint';
import { LANG } from '../lang';
import { type Feedback, FeedbackSheet } from '../components/FeedbackSheet';
import { NpcPortrait } from '../components/NpcPortrait';
import { Button, Screen, SpeakButton, TopBar } from '../components/ui';
import { useCity } from '../store/city';
import { syncAndEvaluate, useMotivation } from '../store/motivation';
import { useProgress } from '../store/progress';

type Result = { task: PairTask; right: boolean };

/** Медленный звон: так слышнее длинная согласная и ударный слог. */
const SLOW = 0.6;

/**
 * Звонница (задача 10.2): звонарь бьёт в колокол — звучит одно из двух похожих слов (pero — perro, papa — papá,
 * pala — palla), игрок выбирает, какое прозвучало. Противопоставления можно выбрать. Без звука звонить нельзя.
 * Верные ответы идут в линию медалей «Слушатель», ошибка возвращает пару в конец звона с другим словом.
 */
export function BellsScreen() {
  const nav = useNavigate();
  const [data, setData] = useState<PairsFile | null>(null);
  const [picked, setPicked] = useState<string[] | null>(null);
  const [phase, setPhase] = useState<'intro' | 'run' | 'result'>('intro');
  const [tasks, setTasks] = useState<PairTask[]>([]);
  const [results, setResults] = useState<Result[]>([]);

  useEffect(() => {
    loadPairs().then(setData);
  }, []);

  if (!data) return null;
  const { ringer } = data;
  const chosen = picked ?? data.contrasts.map((c) => c.id);
  const sound = listeningEnabled();
  const toggle = (id: string) =>
    setPicked(chosen.includes(id) ? (chosen.length > 1 ? chosen.filter((x) => x !== id) : chosen) : [...chosen, id]);

  const start = () => {
    setTasks(pairTasks(data.contrasts.filter((c) => chosen.includes(c.id)), BELLS_SIZE, seeded(Date.now())));
    setResults([]);
    setPhase('run');
  };

  if (phase === 'run') {
    return (
      <BellsRun
        tasks={tasks}
        hints={Object.fromEntries(data.contrasts.map((c) => [c.id, c.hint]))}
        onExit={() => setPhase('intro')}
        onFinish={(r) => {
          useCity.getState().addCoins(r.filter((x) => x.right).length);
          syncAndEvaluate(Date.now(), {});
          setResults(r);
          setPhase('result');
        }}
      />
    );
  }

  if (phase === 'result') {
    const right = results.filter((r) => r.right).length;
    const misses = results.filter((r) => !r.right);
    return (
      <Screen>
        <TopBar title="Звонница" back={false} />
        <div className="flex flex-1 flex-col gap-3 px-5 pb-6">
          <div className="flex flex-col items-center rounded-2xl bg-white p-4 text-center shadow-sm" data-testid="bells-result">
            <NpcPortrait look={ringer.look} size={90} label={ringer.name} />
            <div className="mt-2 text-lg font-bold">{misses.length ? 'Звон окончен' : 'Ни одного фальшивого звука'}</div>
            <p className="text-stone-600 tabular-nums">
              Верно: {right} из {results.length}
            </p>
            <p className="mt-1 font-semibold text-amber-700 tabular-nums">
              +{right} 🪙 · +{right * XP.correct} XP
            </p>
          </div>
          {misses.length > 0 && (
            <div className="rounded-2xl bg-white p-4 shadow-sm" data-testid="bells-misses">
              <div className="font-semibold">Перепутались</div>
              <ul className="mt-2 flex flex-col gap-2">
                {misses.map(({ task }, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 text-sm">
                    <span>
                      <b lang={LANG}>{task.words[task.target].es}</b> <span className="text-stone-500">— {task.words[task.target].ru}</span>
                      <span className="text-stone-400"> · не </span>
                      <span lang={LANG}>{task.words[task.target === 0 ? 1 : 0].es}</span>
                    </span>
                    <SpeakButton text={task.words[task.target].es} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex-1" />
          <Button className="w-full" data-testid="bells-again" onClick={start}>
            Ещё звон
          </Button>
          <Button className="w-full" variant="secondary" onClick={() => nav('/grammar', { replace: true })}>
            К урокам грамматики
          </Button>
        </div>
      </Screen>
    );
  }

  return (
    <Screen>
      <TopBar title="Звонница" />
      <div className="flex flex-1 flex-col gap-3 px-5 pb-6">
        <div className="rounded-2xl bg-white p-4 shadow-sm" data-testid="bells-intro">
          <div className="flex items-end gap-3">
            <NpcPortrait look={ringer.look} size={90} label={ringer.name} />
            <div className="min-w-0 flex-1">
              <div className="text-lg font-bold">{ringer.name}</div>
              <div className="text-sm text-stone-500">{ringer.role}</div>
            </div>
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-orange-50 px-3 py-2">
            <div className="flex-1">
              <div className="font-semibold" lang={LANG}>
                {ringer.greeting.es}
              </div>
              <div className="text-sm text-stone-600">{ringer.greeting.ru}</div>
            </div>
            <button
              type="button"
              aria-label="Озвучить"
              onClick={() => speakAs(ringer.greeting.es, ringer)}
              className="press inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100 text-lg text-brand shadow-sm"
            >
              🔊
            </button>
          </div>
          <p className="mt-3 leading-relaxed text-stone-700">
            Звонарь произносит одно слово из пары похожих, вы выбираете, какое прозвучало. {BELLS_SIZE} ударов колокола, ошибка вернётся в
            конце звона.
          </p>
        </div>
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="font-semibold">Что слушаем</div>
          <ul className="mt-2 flex flex-col gap-2" data-testid="bells-contrasts">
            {data.contrasts.map((c) => {
              const on = chosen.includes(c.id);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(c.id)}
                    data-testid={`contrast-${c.id}`}
                    className={`press w-full rounded-xl border-2 px-3 py-2 text-left ${on ? 'border-gold bg-amber-50' : 'border-stone-200 bg-white text-stone-400'}`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-semibold">{c.title}</span>
                      <span className="text-sm tabular-nums" lang={LANG}>
                        {c.pairs[0][0].es} — {c.pairs[0][1].es}
                      </span>
                    </div>
                    <div className="text-sm text-stone-500">{c.hint}</div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="flex-1" />
        {sound ? (
          <Button className="w-full" data-testid="bells-start" onClick={start}>
            Ударить в колокол
          </Button>
        ) : (
          <p className="rounded-2xl bg-orange-50 px-4 py-3 text-center text-stone-600" data-testid="bells-silent">
            Звоннице нужен звук. Включите звук или голос языка в настройках «Озвучка», и звонарь начнёт.
          </p>
        )}
      </div>
    </Screen>
  );
}

function BellsRun({ tasks: initial, hints, onFinish, onExit }: { tasks: PairTask[]; hints: Record<string, string>; onFinish(r: Result[]): void; onExit(): void }) {
  const [tasks, setTasks] = useState(initial);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<0 | 1 | null>(null);
  const [fb, setFb] = useState<Feedback | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const shownAt = useRef(Date.now());
  const current = useRef(0);
  const task = tasks[index];
  const heard = task?.words[task.target].es;

  useEffect(() => {
    shownAt.current = Date.now();
    current.current = index;
    if (heard) afterPaint(() => speak(heard));
  }, [index, heard]);
  useEffect(() => {
    return () => {
      current.current = -1;
    };
  }, []);

  if (!task) return null;
  const locked = picked !== null;

  const answer = (k: 0 | 1) => {
    if (locked) return;
    const v = pairVerdict(task, k);
    const now = Date.now();
    const id = pairItemId(task.contrast, task.pair);
    logAnswer({ itemId: id, kind: `pairs-${task.contrast}`, verdict: v, mode: 'pairs', ms: answerMs(shownAt.current, now) }, now);
    setPicked(k);
    setResults((r) => [...r, { task, right: v === 'correct' }]);
    // Ошибка: та же пара ещё раз в конце, теперь звучит другое слово. Повтор не повторяется.
    if (v === 'wrong' && index < initial.length) setTasks((t) => [...t, retryTask(task)]);
    const other = task.words[task.target === 0 ? 1 : 0];
    setFb({
      verdict: v,
      title: v === 'correct' ? 'Верно!' : 'Прозвучало другое слово',
      answer: task.words[task.target].es,
      sub: task.words[task.target].ru,
      note: `Второе: ${other.es} — ${other.ru}. ${hints[task.contrast] ?? ''}`.trim(),
      speakText: task.words[task.target].es,
    });
    if (v === 'correct') {
      useProgress.getState().addXp(XP.correct);
      useMotivation.getState().recordListening();
    }
  };

  // «Оба слова» говорит по очереди и ждёт конца каждого. Если игрок уже перешёл дальше, цикл обрывается:
  // иначе старое слово прозвучало бы поверх нового задания.
  const both = async () => {
    const at = index;
    for (const k of task.order) {
      if (current.current !== at) return;
      speak(task.words[k].es, SLOW);
      await untilSpoken();
    }
  };

  const next = () => {
    setFb(null);
    setPicked(null);
    if (index + 1 >= tasks.length) onFinish(results);
    else setIndex(index + 1);
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-6" data-testid="bells-run">
      <div className="flex h-14 items-center gap-3">
        <button type="button" aria-label="Выйти из Звонницы" onClick={onExit} className="press h-10 w-10 rounded-full text-xl text-stone-500">
          ✕
        </button>
        <div className="h-3.5 flex-1 overflow-hidden rounded bg-wood p-[2px]">
          <div
            className="h-full w-full origin-left rounded-sm bg-gold"
            style={{ transform: `scaleX(${index / tasks.length})`, transition: 'transform 200ms ease-out' }}
          />
        </div>
        <span className="text-sm text-stone-500 tabular-nums" data-testid="bells-progress">
          {index + 1} / {tasks.length}
        </span>
      </div>
      <div className="font-pixel text-xs tracking-widest text-amber-700 uppercase">Звонница</div>
      <div key={index} className={`flex flex-1 flex-col pt-2 ${locked ? 'pb-64' : ''}`} data-testid="bells-task" data-heard={heard} data-contrast={task.contrast}>
        <div className="text-sm font-medium text-stone-500">Что вы услышали?</div>
        <div className="mt-6 flex items-center justify-center gap-4">
          <button
            type="button"
            aria-label="Звон ещё раз"
            onClick={() => speak(heard)}
            className="press flex h-24 w-24 items-center justify-center rounded-full bg-gold text-5xl shadow-md"
            data-testid="bells-ring"
          >
            🔔
          </button>
          <button
            type="button"
            aria-label="Медленнее"
            onClick={() => speak(heard, SLOW)}
            className="press flex h-14 w-14 items-center justify-center rounded-full bg-orange-100 text-2xl shadow-sm"
            data-testid="bells-slow"
          >
            🐢
          </button>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-3">
          {task.order.map((k) => {
            const w = task.words[k];
            const tone = !locked ? 'border-stone-300 bg-white' : k === task.target ? 'border-ok bg-okbg' : k === picked ? 'border-bad bg-badbg' : 'border-stone-300 bg-white';
            return (
              <button
                key={k}
                type="button"
                disabled={locked}
                onClick={() => answer(k)}
                className={`press flex min-h-24 flex-col items-center justify-center rounded-2xl border-2 px-3 py-3 ${tone}`}
                data-testid="bells-option"
                data-word={w.es}
              >
                <span className="text-2xl font-bold" lang={LANG}>
                  {w.es}
                </span>
                <span className="text-sm text-stone-500">{w.ru}</span>
              </button>
            );
          })}
        </div>
        {locked && (
          <button type="button" onClick={both} className="press mt-3 self-center rounded-full bg-orange-100 px-4 py-2 font-semibold text-brand" data-testid="bells-both">
            🔊 Оба слова медленно
          </button>
        )}
      </div>
      <FeedbackSheet fb={fb} onNext={next} />
    </div>
  );
}
