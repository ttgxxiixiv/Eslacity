import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ECONOMY } from '../config';
import { loadLocation } from '../content';
import type { LocationId, Word } from '../content/schema';
import { seeded } from '../domain/generators';
import { buildLearnSteps, buildReviewSteps, type SessionState, type Step } from '../domain/lessonQueue';
import { lessonParts, levelWords } from '../domain/levels';
import { useCity } from '../store/city';
import { useProgress } from '../store/progress';
import { useMotivation } from '../store/motivation';
import type { Achievement } from '../domain/achievements';
import { LessonPlayer, type LessonTotals } from '../components/LessonPlayer';
import { LessonResult } from '../components/LessonResult';

interface Ready {
  steps: Step[];
  words: Record<string, Word>;
  pool: Word[];
  lessonWords: Word[];
}

export function LearnScreen({ practice = false }: { practice?: boolean }) {
  const params = useParams();
  const id = params.id as LocationId;
  const level = Number(params.level);
  const part = Number(params.part ?? 0);
  const nav = useNavigate();
  const [ready, setReady] = useState<Ready | null>(null);
  const [result, setResult] = useState<{ s: SessionState; totals: LessonTotals; bonus: number; ach: Achievement[] } | null>(null);

  useEffect(() => {
    loadLocation(id).then((all) => {
      // Варианты ответа только из уже открытых уровней: незнакомое слово среди вариантов подсказывает ответ.
      const pool = all.filter((w) => w.level <= level);
      const lw = levelWords(pool, level);
      const lessonWords = practice ? lw : (lessonParts(lw)[part] ?? []);
      const rng = seeded(Date.now());
      const cards = useProgress.getState().cards;
      const steps = practice ? buildReviewSteps(lessonWords, cards, pool, rng) : buildLearnSteps(lessonWords, pool, rng);
      setReady({ steps, pool, lessonWords, words: Object.fromEntries(all.map((w) => [w.id, w])) });
    });
  }, [id, level, part, practice]);

  if (result && ready) {
    return (
      <LessonResult
        title={practice ? 'Тренировка завершена' : 'Урок пройден'}
        session={result.s}
        totals={result.totals}
        bonusCoins={result.bonus}
        achievements={result.ach}
        words={ready.words}
        onDone={() => nav(`/loc/${id}`, { replace: true })}
      />
    );
  }
  if (!ready) return null;
  if (!ready.steps.length) return <div className="p-6">В этом уроке нет слов.</div>;

  return (
    <LessonPlayer
      steps={ready.steps}
      words={ready.words}
      pool={ready.pool}
      onExit={() => {
        if (practice || confirm('Выйти из урока? Новые слова не сохранятся.')) nav(-1);
      }}
      onFinish={(s, totals) => {
        const progress = useProgress.getState();
        let bonus = 0;
        // Тренировка уже выученного уровня не трогает SRS, чтобы не сбивать интервалы.
        if (!practice) {
          const { newWords } = progress.applyGrades(s.grades);
          bonus = ECONOMY.lessonBonus;
          progress.bumpDay({ lessons: 1, newWords });
          useCity.getState().addCoins(bonus);
        }
        setResult({ s, totals, bonus, ach: useMotivation.getState().evaluate() });
      }}
    />
  );
}
