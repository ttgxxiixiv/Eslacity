import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LESSON, XP } from '../config';
import { wordsByIds } from '../content';
import type { Word } from '../content/schema';
import { makeChoice, seeded, type ChoiceData } from '../domain/generators';
import { afterPaint } from '../lib/afterPaint';
import { speak } from '../audio/tts';
import { useProgress } from '../store/progress';
import { useSettings } from '../store/settings';
import { useMotivation } from '../store/motivation';
import type { Achievement } from '../domain/achievements';
import { AchievementLines } from '../components/LessonResult';
import { Button, Screen, SpeakButton, TopBar } from '../components/ui';

interface Question extends ChoiceData {
  word: Word;
  dir: 'es-ru' | 'ru-es';
}

const rng = seeded(Date.now());

export function BlitzScreen() {
  const nav = useNavigate();
  const [learned, setLearned] = useState<Word[] | null>(null);
  const [pool, setPool] = useState<Word[]>([]);
  const [phase, setPhase] = useState<'ready' | 'play' | 'done'>('ready');
  const [q, setQ] = useState<Question | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [misses, setMisses] = useState<Word[]>([]);
  const endAt = useRef(0);
  const scoreRef = useRef(0);
  const best = useSettings((s) => s.blitzBest);
  const [newBest, setNewBest] = useState(false);
  const [ach, setAch] = useState<Achievement[]>([]);

  useEffect(() => {
    const ids = Object.keys(useProgress.getState().cards);
    // Дистракторы тоже только из выученных слов: незнакомое слово среди вариантов подсказывает ответ.
    wordsByIds(ids).then((ws) => {
      setLearned(ws);
      setPool(ws);
    });
  }, []);

  const nextQuestion = () => {
    if (!learned) return;
    const word = learned[Math.floor(rng() * learned.length)];
    const dir = rng() < 0.5 ? 'es-ru' : 'ru-es';
    setQ({ word, dir, ...makeChoice(word, pool, dir, rng) });
    setPicked(null);
  };

  const finish = (final: number) => {
    endAt.current = 0;
    setPhase('done');
    afterPaint(() => {
      useProgress.getState().addXp(final * XP.blitzCorrect);
      const s = useSettings.getState();
      if (final > s.blitzBest) {
        s.update({ blitzBest: final });
        setNewBest(true);
      }
      setAch(useMotivation.getState().evaluate());
    });
  };

  useEffect(() => {
    if (phase !== 'play') return;
    const t = setInterval(() => {
      if (Date.now() >= endAt.current) {
        clearInterval(t);
        finish(scoreRef.current);
      }
    }, 200);
    return () => clearInterval(t);
  }, [phase]);

  const start = () => {
    setScore(0);
    scoreRef.current = 0;
    setMisses([]);
    setNewBest(false);
    setAch([]);
    endAt.current = Date.now() + LESSON.blitzSeconds * 1000;
    nextQuestion();
    setPhase('play');
  };

  const pick = (i: number) => {
    if (!q || picked !== null) return;
    setPicked(i);
    if (i === q.answer) setScore(++scoreRef.current);
    else setMisses((m) => (m.some((w) => w.id === q.word.id) ? m : [...m, q.word]));
    if (q.dir === 'ru-es' && i === q.answer) afterPaint(() => speak(q.word.es));
    setTimeout(() => endAt.current && nextQuestion(), i === q.answer ? 250 : 700);
  };

  if (!learned) return null;

  if (learned.length < LESSON.blitzMinWords) {
    return (
      <Screen>
        <TopBar title="Блиц" />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
          <div className="text-5xl">⚡</div>
          <p className="text-stone-600">
            Для блица нужно хотя бы {LESSON.blitzMinWords} выученных слов. Сейчас: {learned.length}.
          </p>
        </div>
      </Screen>
    );
  }

  if (phase === 'ready') {
    return (
      <Screen>
        <TopBar title="Блиц" />
        <div className="flex flex-1 flex-col justify-center gap-4 px-6">
          <div className="text-center text-6xl">⚡</div>
          <p className="text-center text-stone-600">
            60 секунд, выбор из четырёх вариантов. Слова из выученных, на повторение не влияет.
          </p>
          <p className="text-center text-sm text-stone-500">Рекорд: {best}</p>
          <Button onClick={start}>Старт</Button>
        </div>
      </Screen>
    );
  }

  if (phase === 'done') {
    return (
      <Screen>
        <TopBar title="Блиц" back={false} />
        <div className="flex flex-1 flex-col px-6 pb-6">
          <div className="mt-6 text-center text-6xl font-bold tabular-nums">{score}</div>
          <div className="text-center text-stone-500">
            {newBest ? 'Новый рекорд!' : `Рекорд: ${Math.max(best, score)}`} · +{score * XP.blitzCorrect} XP
          </div>
          {misses.length > 0 && (
            <ul className="mt-6 divide-y divide-stone-200 rounded-2xl bg-white shadow-sm">
              {misses.map((w) => (
                <li key={w.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="flex-1">
                    <div className="font-semibold">{w.es}</div>
                    <div className="text-sm text-stone-500">{w.ru}</div>
                  </div>
                  <SpeakButton text={w.es} />
                </li>
              ))}
            </ul>
          )}
          <AchievementLines list={ach} />
          <div className="flex-1" />
          <Button className="mt-6" onClick={start}>
            Ещё раз
          </Button>
          <Button variant="secondary" className="mt-2" onClick={() => nav('/', { replace: true })}>
            В город
          </Button>
        </div>
      </Screen>
    );
  }

  return (
    <Screen className="px-5">
      <div className="flex h-14 items-center gap-3">
        <button type="button" onClick={() => finish(scoreRef.current)} className="press h-10 w-10 text-xl text-stone-500" aria-label="Закончить">
          ✕
        </button>
        <div className="h-3.5 flex-1 overflow-hidden rounded bg-wood p-[2px]">
          <div className="drain h-full w-full rounded-sm bg-gold" style={{ animationDuration: `${LESSON.blitzSeconds}s` }} />
        </div>
        <div className="w-10 text-right text-xl font-bold tabular-nums">{score}</div>
      </div>
      {q && (
        <div className="flex flex-1 flex-col">
          <div className="mt-8 text-center text-3xl font-bold">{q.dir === 'es-ru' ? q.word.es : q.word.ru}</div>
          <div className="mt-10 grid gap-3">
            {q.options.map((o, i) => {
              let cls = 'bg-white border-stone-300';
              if (picked !== null) {
                if (i === q.answer) cls = 'bg-okbg border-ok text-ok';
                else if (i === picked) cls = 'bg-badbg border-bad text-bad';
              }
              return (
                <button
                  key={`${q.word.id}-${i}`}
                  type="button"
                  onClick={() => pick(i)}
                  className={`press min-h-14 rounded-2xl border-2 px-4 py-3 text-lg font-medium ${cls}`}
                >
                  {o}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </Screen>
  );
}
