import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ECONOMY } from '../config';
import { NPC_BY_LOCATION } from '../content/npcs';
import { loadPhrases } from '../content/phrases';
import type { LocationId, Phrase } from '../content/schema';
import { seeded } from '../domain/generators';
import { startSession } from '../domain/lessonQueue';
import { lessonEvent, type MedalGain } from '../domain/medals';
import { learnPhraseSteps, type PhraseStep } from '../domain/phraseSteps';
import { EMPTY_PHRASES, PhraseRun, type PhraseResult } from '../components/PhraseRun';
import { LessonResult } from '../components/LessonResult';
import { useCity } from '../store/city';
import { syncAndEvaluate } from '../store/motivation';
import { useProgress } from '../store/progress';

/**
 * Урок фраз уровня места: житель учит, как здесь говорят. Новые фразы становятся карточками `ph:…`
 * и дальше повторяются в поручениях жителя. Повтор уже пройденного урока интервалы не трогает.
 */
export function PhraseLessonScreen() {
  const params = useParams();
  const id = params.id as LocationId;
  const level = Number(params.level);
  const nav = useNavigate();
  const npc = NPC_BY_LOCATION[id];
  const [ready, setReady] = useState<{ steps: PhraseStep[]; phrases: Record<string, Phrase>; pool: Phrase[] } | null>(null);
  const [result, setResult] = useState<{ r: PhraseResult; bonus: number; ach: MedalGain[] } | null>(null);

  useEffect(() => {
    loadPhrases(id).then((all) => {
      const pool = all.filter((p) => p.level <= level);
      const lesson = all.filter((p) => p.level === level);
      setReady({ steps: learnPhraseSteps(lesson, pool, seeded(Date.now())), phrases: Object.fromEntries(all.map((p) => [p.id, p])), pool });
    });
  }, [id, level]);

  if (result) {
    const { r } = result;
    return (
      <LessonResult
        title="Фразы выучены"
        session={{ ...startSession([]), correct: r.correct, almost: r.almost, wrong: r.wrong }}
        totals={{ xp: r.xp, coins: r.coins }}
        bonusCoins={result.bonus}
        medals={result.ach}
        words={{}}
        extra={
          npc && (
            <p className="mt-4 rounded-2xl bg-white px-4 py-3 shadow-sm" data-testid="phrases-done">
              {npc.name} будет просить вспомнить эти фразы в поручениях.
            </p>
          )
        }
        onDone={() => nav(`/loc/${id}`, { replace: true })}
      />
    );
  }
  if (!ready) return null;
  if (!ready.steps.length) return <div className="p-6">На этом уровне пока нет фраз.</div>;

  return (
    <PhraseRun
      steps={ready.steps}
      phrases={ready.phrases}
      pool={ready.pool}
      mode="learn"
      label={npc ? `${npc.name} учит фразам · уровень ${level}` : `Фразы · уровень ${level}`}
      onExit={() => {
        if (confirm('Выйти из урока? Новые фразы не сохранятся.')) nav(-1);
      }}
      onFinish={(r = EMPTY_PHRASES) => {
        const progress = useProgress.getState();
        // Уже знакомые фразы урок не трогает, как и уроки слов.
        const fresh = Object.fromEntries(Object.entries(r.grades).filter(([pid]) => !(pid in progress.cards)));
        let bonus = 0;
        if (Object.keys(fresh).length) {
          progress.applyGrades(fresh);
          progress.bumpDay({ lessons: 1 });
          bonus = ECONOMY.lessonBonus;
          useCity.getState().addCoins(bonus);
        }
        setResult({ r, bonus, ach: syncAndEvaluate(Date.now(), lessonEvent(r)) });
      }}
    />
  );
}
