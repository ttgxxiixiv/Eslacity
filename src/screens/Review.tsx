import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LESSON } from '../config';
import { loadLocations, locationOfWord, wordsByIds } from '../content';
import { loadLesson } from '../content/grammar';
import type { GrammarExercise, Phrase, Word } from '../content/schema';
import { loadPhrases, phrasesByIds } from '../content/phrases';
import { reviewPhraseSteps, type PhraseStep } from '../domain/phraseSteps';
import { EMPTY_PHRASES, PhraseRun, type PhraseResult } from '../components/PhraseRun';
import { seeded } from '../domain/generators';
import { echoExercises } from '../domain/echo';
import { exerciseOf, lessonOfExercise, placeOfPhrase, splitCards } from '../domain/itemId';
import { buildReviewSteps, startSession, type SessionState, type Step, type StepKind } from '../domain/lessonQueue';
import { dueCards, type SrsCard } from '../domain/srs';
import { useProgress } from '../store/progress';
import { useMotivation } from '../store/motivation';
import { useErrands } from '../store/errands';
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
  phrases: { steps: PhraseStep[]; byId: Record<string, Phrase>; pool: Phrase[] };
  /** Задания «Эха»: выражение надо сказать в другом регистре. */
  echo: { cardId: string; ex: GrammarExercise }[];
}

/** Правил за одно повторение не больше этого: основное в повторении — слова. */
const RULES_PER_REVIEW = 8;
/** Фраз за одно повторение не больше этого. */
const PHRASES_PER_REVIEW = 8;

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

/** Что повторять: id карточек слов, правил и фраз; `echo` — выражения для поручения «Эхо». */
export type PickCards = (cards: Record<string, SrsCard>) => {
  words: string[];
  rules: string[];
  phrases?: string[];
  echo?: string[];
  /** Вид задания для слова («Разбор ошибок», задача 12.2). */
  kinds?: Record<string, StepKind>;
};

/** Общее повторение: карточки, которые пора повторить. */
const dueToday: PickCards = (cards) => {
  const { words, rules, phrases } = splitCards(dueCards(Object.values(cards), Date.now()));
  return {
    words: words.slice(0, LESSON.reviewBatch).map((c) => c.wordId),
    rules: rules.slice(0, RULES_PER_REVIEW).map((c) => c.wordId),
    phrases: phrases.slice(0, PHRASES_PER_REVIEW).map((c) => c.wordId),
  };
};

export function ReviewScreen() {
  return <ReviewRun pick={dueToday} />;
}

/**
 * Прохождение повторения: сначала слова, потом фразы мест, потом «Эхо», потом правила, общий итог. Им же проходятся
 * поручения жителей: `pick` выбирает карточки, `onComplete` вызывается один раз, когда всё пройдено до конца, и может
 * вернуть блок для итога (благодарность жителя). `typeExpressions` — выражения C1, которые уже не новые, вводом.
 */
export function ReviewRun({ pick, title = 'Повторение завершено', onComplete, typeExpressions = false }: {
  pick: PickCards;
  title?: string;
  onComplete?: () => ReactNode;
  typeExpressions?: boolean;
}) {
  const nav = useNavigate();
  const [ready, setReady] = useState<Ready | null>(null);
  const [completeExtra, setCompleteExtra] = useState<ReactNode>(null);
  const [phase, setPhase] = useState<'words' | 'phrases' | 'echo' | 'rules' | 'done'>('words');
  const [wordsResult, setWordsResult] = useState<{ s: SessionState; totals: LessonTotals } | null>(null);
  const [rulesResult, setRulesResult] = useState<RuleResult>(EMPTY_RULES);
  const [phraseResult, setPhraseResult] = useState<PhraseResult>(EMPTY_PHRASES);
  const [echoResult, setEchoResult] = useState<RuleResult>(EMPTY_RULES);
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
      const phraseIds = picked.phrases ?? [];
      const phrases = await phrasesByIds(phraseIds);
      const foundPhrases = new Set(phrases.map((p) => p.id));
      useProgress.getState().dropCards([
        ...ids.filter((wid) => !found.has(wid)),
        ...rules.missing,
        ...phraseIds.filter((pid) => !foundPhrases.has(pid)),
      ]);
      // Варианты и лишние плитки — из всех фраз тех же мест.
      const phrasePool = (await Promise.all([...new Set(phraseIds.map(placeOfPhrase))].map(loadPhrases))).flat();
      const loaded = await loadLocations(ids.map(locationOfWord));
      // Варианты ответа из выученных слов, если их хватает на четыре варианта.
      const known = loaded.filter((w) => w.id in cards);
      const pool = known.length >= 8 ? known : loaded;
      const steps = buildReviewSteps(words, cards, pool, seeded(Date.now()), { listening: listeningEnabled(), typeExpressions, kinds: picked.kinds });
      const phraseSteps = reviewPhraseSteps(phrases, cards, phrasePool, seeded(Date.now() + 1));
      // «Эхо»: выражения и их пары; неверные варианты — из выражений тех же мест.
      const echoIds = picked.echo ?? [];
      const echoPlaces = await loadLocations(echoIds.map(locationOfWord));
      const echoById = Object.fromEntries(echoPlaces.map((w) => [w.id, w]));
      const echo = echoExercises(echoIds, echoById, echoPlaces, cards, seeded(Date.now() + 2));
      setReady({
        steps,
        pool,
        words: Object.fromEntries(loaded.map((w) => [w.id, w])),
        rules: rules.found,
        phrases: { steps: phraseSteps, byId: Object.fromEntries(phrasePool.map((p) => [p.id, p])), pool: phrasePool },
        echo,
      });
      if (!steps.length) setPhase(phraseSteps.length ? 'phrases' : echo.length ? 'echo' : 'rules');
    })();
  }, []);

  const saveWords = (s: SessionState) => {
    const graded = Object.keys(s.grades).length;
    if (!graded) return;
    const p = useProgress.getState();
    p.applyGrades(s.grades);
    p.bumpDay({ reviews: graded });
  };
  const savePhrases = (r: PhraseResult) => {
    const graded = Object.keys(r.grades).length;
    if (!graded) return;
    const p = useProgress.getState();
    p.applyGrades(r.grades);
    p.bumpDay({ reviews: graded });
  };
  /** После слов и фраз — «Эхо», потом правила, потом итог. */
  const afterPhrases = (words: { s: SessionState; totals: LessonTotals } | null, phrases: PhraseResult) => {
    if (ready!.echo.length) setPhase('echo');
    else if (ready!.rules.length) setPhase('rules');
    else finish(words, EMPTY_RULES, phrases);
  };
  const saveRules = (r: RuleResult) => {
    const graded = Object.keys(r.grades).length;
    if (!graded) return;
    const p = useProgress.getState();
    p.applyGrades(r.grades);
    p.bumpDay({ reviews: graded });
  };
  const finish = (
    words: { s: SessionState; totals: LessonTotals } | null, rules: RuleResult, phrases: PhraseResult = phraseResult, echo: RuleResult = echoResult,
  ) => {
    const s = words?.s ?? startSession([]);
    const all = {
      correct: s.correct + rules.correct + phrases.correct + echo.correct,
      almost: s.almost + phrases.almost,
      wrong: s.wrong + rules.wrong + phrases.wrong + echo.wrong,
    };
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
    const echoTotal = echoResult.correct + echoResult.wrong;
    const phrasesTotal = phraseResult.correct + phraseResult.almost + phraseResult.wrong;
    return (
      <LessonResult
        title={title}
        // Итог по словам и правилам вместе; слова с ошибками — только слова.
        session={{
          ...s,
          correct: s.correct + rulesResult.correct + phraseResult.correct + echoResult.correct,
          almost: s.almost + phraseResult.almost,
          wrong: s.wrong + rulesResult.wrong + phraseResult.wrong + echoResult.wrong,
        }}
        totals={{
          xp: totals.xp + rulesResult.xp + phraseResult.xp + echoResult.xp,
          coins: totals.coins + rulesResult.coins + phraseResult.coins + echoResult.coins,
        }}
        medals={ach}
        words={ready.words}
        extra={
          <>
            {completeExtra}
            {phrasesTotal > 0 && (
              <p className="mt-4 rounded-2xl bg-white px-4 py-3 shadow-sm" data-testid="phrases-summary">
                💬 Фразы: {phraseResult.correct + phraseResult.almost} из {phrasesTotal} верно
              </p>
            )}
            {echoTotal > 0 && (
              <p className="mt-4 rounded-2xl bg-white px-4 py-3 shadow-sm" data-testid="echo-summary">
                🔁 Эхо: {echoResult.correct} из {echoTotal} верно
              </p>
            )}
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

  if (!ready.steps.length && !ready.rules.length && !ready.phrases.steps.length && !ready.echo.length) {
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

  if (phase === 'phrases') {
    return (
      <PhraseRun
        steps={ready.phrases.steps}
        phrases={ready.phrases.byId}
        pool={ready.phrases.pool}
        mode="review"
        label="Фразы"
        onExit={(r) => {
          savePhrases(r);
          nav(-1);
        }}
        onFinish={(r) => {
          savePhrases(r);
          setPhraseResult(r);
          afterPhrases(wordsResult, r);
        }}
      />
    );
  }

  if (phase === 'echo') {
    return (
      <RuleReview
        rules={ready.echo}
        label="Эхо"
        logKind="echo"
        onExit={(r) => {
          saveRules(r);
          useErrands.getState().addEcho(r.correct);
          nav(-1);
        }}
        onFinish={(r) => {
          saveRules(r);
          // Засчитывается до медалей: линия «Эхо» считает верно сказанные выражения.
          useErrands.getState().addEcho(r.correct);
          setEchoResult(r);
          if (ready.rules.length) setPhase('rules');
          else finish(wordsResult, EMPTY_RULES, phraseResult, r);
        }}
      />
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
        // После слов — фразы, «Эхо» и правила, если они есть.
        if (ready.phrases.steps.length) setPhase('phrases');
        else afterPhrases({ s, totals }, EMPTY_PHRASES);
      }}
    />
  );
}
