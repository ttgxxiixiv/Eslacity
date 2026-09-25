import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LESSON } from '../config';
import { loadLocations, locationOfWord, wordsByIds } from '../content';
import type { Word } from '../content/schema';
import { seeded } from '../domain/generators';
import { buildReviewSteps, type SessionState, type Step } from '../domain/lessonQueue';
import { dueCards } from '../domain/srs';
import { useProgress } from '../store/progress';
import { useMotivation } from '../store/motivation';
import { listeningEnabled } from '../audio/tts';
import type { Achievement } from '../domain/achievements';
import { LessonPlayer, type LessonTotals } from '../components/LessonPlayer';
import { LessonResult } from '../components/LessonResult';
import { Screen, TopBar } from '../components/ui';

interface Ready {
  steps: Step[];
  words: Record<string, Word>;
  pool: Word[];
}

export function ReviewScreen() {
  const nav = useNavigate();
  const [ready, setReady] = useState<Ready | null>(null);
  const [result, setResult] = useState<{ s: SessionState; totals: LessonTotals; ach: Achievement[] } | null>(null);

  useEffect(() => {
    const cards = useProgress.getState().cards;
    const due = dueCards(Object.values(cards), Date.now()).slice(0, LESSON.reviewBatch);
    const ids = due.map((c) => c.wordId);
    (async () => {
      const words = await wordsByIds(ids);
      const found = new Set(words.map((w) => w.id));
      useProgress.getState().dropCards(ids.filter((wid) => !found.has(wid)));
      const loaded = await loadLocations(ids.map(locationOfWord));
      // Варианты ответа из выученных слов, если их хватает на четыре варианта.
      const known = loaded.filter((w) => w.id in cards);
      const pool = known.length >= 8 ? known : loaded;
      const steps = buildReviewSteps(words, cards, pool, seeded(Date.now()), { listening: listeningEnabled() });
      setReady({ steps, pool, words: Object.fromEntries(loaded.map((w) => [w.id, w])) });
    })();
  }, []);

  const save = (s: SessionState) => {
    const graded = Object.keys(s.grades).length;
    if (!graded) return;
    const p = useProgress.getState();
    p.applyGrades(s.grades);
    p.bumpDay({ reviews: graded });
  };

  if (result && ready) {
    return (
      <LessonResult
        title="Повторение завершено"
        session={result.s}
        totals={result.totals}
        achievements={result.ach}
        words={ready.words}
        onDone={() => nav('/', { replace: true })}
      />
    );
  }
  if (!ready) return null;
  if (!ready.steps.length) {
    return (
      <Screen>
        <TopBar title="Повторение" />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
          <div className="text-5xl">✅</div>
          <div className="text-lg font-semibold">На сегодня повторять нечего</div>
          <p className="text-stone-500">Выучите новые слова в городе или сыграйте в блиц.</p>
          <Link to="/" className="press mt-4 rounded-2xl bg-brand px-6 py-3 font-semibold text-white">
            В город
          </Link>
        </div>
      </Screen>
    );
  }

  return (
    <LessonPlayer
      steps={ready.steps}
      words={ready.words}
      pool={ready.pool}
      onExit={(s) => {
        // Ответы уже данные сохраняем, остальные слова останутся на сегодня.
        save(s);
        nav(-1);
      }}
      onFinish={(s, totals) => {
        save(s);
        setResult({ s, totals, ach: useMotivation.getState().evaluate() });
      }}
    />
  );
}
