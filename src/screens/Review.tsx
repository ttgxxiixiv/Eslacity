import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LESSON } from '../config';
import { loadLocations, locationOfWord, wordsByIds } from '../content';
import { loadLesson } from '../content/grammar';
import type { GrammarExercise, Word } from '../content/schema';
import { seeded } from '../domain/generators';
import { exerciseOf, lessonOfExercise, splitCards } from '../domain/itemId';
import { buildReviewSteps, startSession, type SessionState, type Step } from '../domain/lessonQueue';
import { dueCards, type SrsCard } from '../domain/srs';
import { useProgress } from '../store/progress';
import { useMotivation } from '../store/motivation';
import { listeningEnabled } from '../audio/tts';
import { lessonEvent, type MedalGain } from '../domain/medals';
import { LessonPlayer, type LessonTotals } from '../components/LessonPlayer';
import { LessonResult } from '../components/LessonResult';
import { EMPTY_RULES, RuleReview, type RuleResult } from '../components/RuleReview';
import { Screen, TopBar } from '../components/ui';

interface Ready {
  steps: Step[];
  words: Record<string, Word>;
  pool: Word[];
  rules: { cardId: string; ex: GrammarExercise }[];
}

/** Правил за одно повторение не больше этого: основное в повторении — слова. */
const RULES_PER_REVIEW = 8;

/** Упражнения для карточек правил. Упражнения, которых больше нет в уроках (или скрытые вариантом), не найдутся. */
async function loadRules(cardIds: string[]): Promise<{ found: Ready['rules']; missing: string[] }> {
  const lessons = new Map<string, Awaited<ReturnType<typeof loadLesson>>>();
  for (const id of new Set(cardIds.map((c) => lessonOfExercise(exerciseOf(c))))) lessons.set(id, await loadLesson(id));
  const found: Ready['rules'] = [];
  const missing: string[] = [];
  for (const cardId of cardIds) {
    const exId = exerciseOf(cardId);
    const ex = lessons.get(lessonOfExercise(exId))?.exercises.find((e) => e.id === exId);
    if (ex) found.push({ cardId, ex });
    else missing.push(cardId);
  }
  return { found, missing };
}

/** Что повторять: id карточек слов и правил. */
export type PickCards = (cards: Record<string, SrsCard>) => { words: string[]; rules: string[] };

/** Общее повторение: карточки, которые пора повторить. */
const dueToday: PickCards = (cards) => {
  const { words, rules } = splitCards(dueCards(Object.values(cards), Date.now()));
  return { words: words.slice(0, LESSON.reviewBatch).map((c) => c.wordId), rules: rules.slice(0, RULES_PER_REVIEW).map((c) => c.wordId) };
};

export function ReviewScreen() {
  return <ReviewRun pick={dueToday} />;
}

/**
 * Прохождение повторения: сначала слова, потом правила, общий итог. Им же проходятся поручения жителей:
 * `pick` выбирает карточки, `onComplete` вызывается один раз, когда всё пройдено до конца, и может вернуть
 * блок для итога (благодарность жителя).
 */
export function ReviewRun({ pick, title = 'Повторение завершено', onComplete }: {
  pick: PickCards;
  title?: string;
  onComplete?: () => ReactNode;
}) {
  const nav = useNavigate();
  const [ready, setReady] = useState<Ready | null>(null);
  const [completeExtra, setCompleteExtra] = useState<ReactNode>(null);
  const [phase, setPhase] = useState<'words' | 'rules' | 'done'>('words');
  const [wordsResult, setWordsResult] = useState<{ s: SessionState; totals: LessonTotals } | null>(null);
  const [rulesResult, setRulesResult] = useState<RuleResult>(EMPTY_RULES);
  const [ach, setAch] = useState<MedalGain[]>([]);

  useEffect(() => {
    const cards = useProgress.getState().cards;
    // Слова и правила ищутся по-разному: карточку правила нельзя удалить как «слово, которого нет».
    const picked = pick(cards);
    const ids = picked.words;
    (async () => {
      const words = await wordsByIds(ids);
      const found = new Set(words.map((w) => w.id));
      const rules = await loadRules(picked.rules);
      useProgress.getState().dropCards([...ids.filter((wid) => !found.has(wid)), ...rules.missing]);
      const loaded = await loadLocations(ids.map(locationOfWord));
      // Варианты ответа из выученных слов, если их хватает на четыре варианта.
      const known = loaded.filter((w) => w.id in cards);
      const pool = known.length >= 8 ? known : loaded;
      const steps = buildReviewSteps(words, cards, pool, seeded(Date.now()), { listening: listeningEnabled() });
      setReady({ steps, pool, words: Object.fromEntries(loaded.map((w) => [w.id, w])), rules: rules.found });
      if (!steps.length) setPhase('rules');
    })();
  }, []);

  const saveWords = (s: SessionState) => {
    const graded = Object.keys(s.grades).length;
    if (!graded) return;
    const p = useProgress.getState();
    p.applyGrades(s.grades);
    p.bumpDay({ reviews: graded });
  };
  const saveRules = (r: RuleResult) => {
    const graded = Object.keys(r.grades).length;
    if (!graded) return;
    const p = useProgress.getState();
    p.applyGrades(r.grades);
    p.bumpDay({ reviews: graded });
  };
  const finish = (words: { s: SessionState; totals: LessonTotals } | null, rules: RuleResult) => {
    const s = words?.s ?? startSession([]);
    const all = { correct: s.correct + rules.correct, almost: s.almost, wrong: s.wrong + rules.wrong };
    // Поручение засчитывается до медалей: «Посыльный» считает выполненные поручения.
    if (onComplete) setCompleteExtra(onComplete());
    setAch(useMotivation.getState().evaluate(Date.now(), lessonEvent(all)));
    setPhase('done');
  };

  if (!ready) return null;

  if (phase === 'done') {
    const s = wordsResult?.s ?? startSession([]);
    const totals = wordsResult?.totals ?? { xp: 0, coins: 0 };
    const rulesTotal = rulesResult.correct + rulesResult.wrong;
    return (
      <LessonResult
        title={title}
        // Итог по словам и правилам вместе; слова с ошибками — только слова.
        session={{ ...s, correct: s.correct + rulesResult.correct, wrong: s.wrong + rulesResult.wrong }}
        totals={{ xp: totals.xp + rulesResult.xp, coins: totals.coins + rulesResult.coins }}
        medals={ach}
        words={ready.words}
        extra={
          <>
            {completeExtra}
            {rulesTotal > 0 && (
              <p className="mt-4 rounded-2xl bg-white px-4 py-3 shadow-sm" data-testid="rules-summary">
                📜 Правила: {rulesResult.correct} из {rulesTotal} верно
              </p>
            )}
          </>
        }
        onDone={() => nav('/', { replace: true })}
      />
    );
  }

  if (!ready.steps.length && !ready.rules.length) {
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

  if (phase === 'rules') {
    return (
      <RuleReview
        rules={ready.rules}
        onExit={(r) => {
          saveRules(r);
          nav(-1);
        }}
        onFinish={(r) => {
          saveRules(r);
          setRulesResult(r);
          finish(wordsResult, r);
        }}
      />
    );
  }

  return (
    <LessonPlayer
      steps={ready.steps}
      words={ready.words}
      pool={ready.pool}
      mode="review"
      onExit={(s) => {
        // Ответы уже данные сохраняем, остальные слова останутся на сегодня.
        saveWords(s);
        nav(-1);
      }}
      onFinish={(s, totals) => {
        saveWords(s);
        setWordsResult({ s, totals });
        // После слов — правила, если они есть.
        if (ready.rules.length) setPhase('rules');
        else finish({ s, totals }, EMPTY_RULES);
      }}
    />
  );
}
