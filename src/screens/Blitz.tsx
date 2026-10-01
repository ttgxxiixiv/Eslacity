import { wordIds } from '../domain/itemId';
import { useEffect, useRef, useState } from 'react';
import { logAnswer } from '../db/answers';
import { answerMs } from '../domain/answerLog';
import { useNavigate } from 'react-router-dom';
import { LESSON, XP, type BlitzMode } from '../config';
import { wordsByIds } from '../content';
import type { Word } from '../content/schema';
import { makeChoice, seeded, type ChoiceData } from '../domain/generators';
import { afterPaint } from '../lib/afterPaint';
import { listeningEnabled, speak } from '../audio/tts';
import { BLITZ_LABEL, SURVIVAL_LIVES, unlockLevel } from '../domain/rewards';
import { useRewards } from '../store/rewards';
import { useProgress } from '../store/progress';
import { useSettings } from '../store/settings';
import { useMotivation } from '../store/motivation';
import type { MedalGain } from '../domain/medals';
import { MedalLines } from '../components/LessonResult';
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
  const shownAt = useRef(0);
  const best = useSettings((s) => s.blitzBest);
  const [newBest, setNewBest] = useState(false);
  const [ach, setAch] = useState<MedalGain[]>([]);
  // Режимы блица — награды уровней героя (задача 9.2).
  const unlocked = useRewards((s) => s.rec.blitz);
  const modeBest = useRewards((s) => s.rec.blitzBest);
  const [mode, setMode] = useState<BlitzMode>('classic');
  const [lives, setLives] = useState(SURVIVAL_LIVES);
  const livesRef = useRef(SURVIVAL_LIVES);
  const modeRef = useRef<BlitzMode>('classic');
  const bestOf = (m: BlitzMode) => (m === 'classic' ? best : (modeBest[m] ?? 0));

  useEffect(() => {
    const ids = wordIds(Object.keys(useProgress.getState().cards));
    // Дистракторы тоже только из выученных слов: незнакомое слово среди вариантов подсказывает ответ.
    wordsByIds(ids).then((ws) => {
      setLearned(ws);
      setPool(ws);
    });
  }, []);

  const nextQuestion = () => {
    if (!learned) return;
    const word = learned[Math.floor(rng() * learned.length)];
    // На слух — всегда звучит слово на изучаемом языке, выбирается перевод.
    const dir = modeRef.current === 'listen' || rng() < 0.5 ? 'es-ru' : 'ru-es';
    setQ({ word, dir, ...makeChoice(word, pool, dir, rng) });
    if (modeRef.current === 'listen') afterPaint(() => speak(word.es));
    shownAt.current = Date.now();
    setPicked(null);
  };

  const finish = (final: number) => {
    endAt.current = 0;
    setPhase('done');
    afterPaint(() => {
      useProgress.getState().addXp(final * XP.blitzCorrect);
      const s = useSettings.getState();
      // Рекорд обычного блица — в настройках (по нему медали «Блиц»), остальных режимов — в наградах.
      if (modeRef.current !== 'classic') setNewBest(useRewards.getState().recordBlitz(modeRef.current, final));
      else if (final > s.blitzBest) {
        s.update({ blitzBest: final });
        setNewBest(true);
      }
      setAch(useMotivation.getState().evaluate());
    });
  };

  useEffect(() => {
    if (phase !== 'play' || mode === 'survival') return;
    const t = setInterval(() => {
      if (Date.now() >= endAt.current) {
        clearInterval(t);
        finish(scoreRef.current);
      }
    }, 200);
    return () => clearInterval(t);
  }, [phase, mode]);

  const start = (m: BlitzMode = mode) => {
    setMode(m);
    modeRef.current = m;
    livesRef.current = SURVIVAL_LIVES;
    setLives(SURVIVAL_LIVES);
    setScore(0);
    scoreRef.current = 0;
    setMisses([]);
    setNewBest(false);
    setAch([]);
    // Без права на ошибку времени нет: конец — третья ошибка. endAt тогда только признак, что игра идёт.
    endAt.current = m === 'survival' ? Number.MAX_SAFE_INTEGER : Date.now() + LESSON.blitzSeconds * 1000;
    nextQuestion();
    setPhase('play');
  };

  const pick = (i: number) => {
    if (!q || picked !== null) return;
    setPicked(i);
    const now = Date.now();
    logAnswer(
      { itemId: q.word.id, kind: `blitz-${q.dir}`, verdict: i === q.answer ? 'correct' : 'wrong', mode: 'blitz', ms: answerMs(shownAt.current, now) },
      now,
    );
    if (i === q.answer) setScore(++scoreRef.current);
    else {
      setMisses((m) => (m.some((w) => w.id === q.word.id) ? m : [...m, q.word]));
      if (modeRef.current === 'survival') {
        livesRef.current -= 1;
        setLives(livesRef.current);
        if (livesRef.current <= 0) {
          setTimeout(() => finish(scoreRef.current), 700);
          return;
        }
      }
    }
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
          <p className="text-center text-stone-600">Слова из выученных, на повторение не влияет.</p>
          <div className="flex flex-col gap-2" data-testid="blitz-modes">
            {(Object.keys(BLITZ_LABEL) as BlitzMode[]).map((m) => {
              const open = unlocked.includes(m);
              const deaf = m === 'listen' && !listeningEnabled();
              return (
                <button
                  key={m}
                  type="button"
                  disabled={!open || deaf}
                  onClick={() => start(m)}
                  className="press flex items-center gap-3 rounded-2xl border-2 border-stone-300 bg-white px-4 py-3 text-left disabled:opacity-50"
                  data-testid={`blitz-${m}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-bold">{BLITZ_LABEL[m].title}</div>
                    <div className="text-sm text-stone-500">
                      {!open ? `Откроется на ${unlockLevel({ blitz: m })}-м уровне героя.` : deaf ? 'Звук сейчас недоступен.' : BLITZ_LABEL[m].text}
                    </div>
                  </div>
                  {open && <div className="text-sm text-stone-500 tabular-nums">Рекорд: {bestOf(m)}</div>}
                </button>
              );
            })}
          </div>
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
            {BLITZ_LABEL[mode].title} · {newBest ? 'Новый рекорд!' : `Рекорд: ${Math.max(bestOf(mode), score)}`} · +{score * XP.blitzCorrect} XP
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
          <MedalLines list={ach} />
          <div className="flex-1" />
          <Button className="mt-6" onClick={() => start(mode)}>
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
        {mode === 'survival' ? (
          <div className="flex-1 text-center text-xl tracking-widest" aria-label={`Ошибок осталось: ${lives}`} data-testid="blitz-lives">
            {Array.from({ length: SURVIVAL_LIVES }, (_, i) => (i < lives ? '❤️' : '🖤')).join('')}
          </div>
        ) : (
          <div className="h-3.5 flex-1 overflow-hidden rounded bg-wood p-[2px]">
            <div className="drain h-full w-full rounded-sm bg-gold" style={{ animationDuration: `${LESSON.blitzSeconds}s` }} />
          </div>
        )}
        <div className="w-10 text-right text-xl font-bold tabular-nums">{score}</div>
      </div>
      {q && (
        <div className="flex flex-1 flex-col">
          {mode === 'listen' ? (
            <div className="mt-8 flex justify-center">
              <SpeakButton text={q.word.es} size="lg" />
            </div>
          ) : (
            <div className="mt-8 text-center text-3xl font-bold" data-testid="blitz-word">
              {q.dir === 'es-ru' ? q.word.es : q.word.ru}
            </div>
          )}
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
