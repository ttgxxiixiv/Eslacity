import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { XP } from '../config';
import { wordsByIds } from '../content';
import { lessonsOf, loadLesson } from '../content/grammar';
import { guardianOf } from '../content/npcs';
import type { District, GrammarExercise, Word } from '../content/schema';
import { SCROLL_WORDS, WORD_LEVELS } from '../content/wordIndex';
import { listeningEnabled, speakAs } from '../audio/tts';
import { chapterById } from '../domain/chapters';
import { seeded } from '../domain/generators';
import { buildGuardian, GUARDIAN_KIND_MIN, GUARDIAN_KINDS, GUARDIAN_LISTEN, GUARDIAN_PASS, GUARDIAN_REWARD, GUARDIAN_SIZE, guardianId, isGuardianPassed } from '../domain/guardian';
import { plural } from '../domain/medals';
import { trialShare, trialStatus, waitLabel, type TrialItem } from '../domain/trial';
import { useNow } from '../lib/useNow';
import { NpcPortrait } from '../components/NpcPortrait';
import { heroText } from '../store/settings';
import { TrialPlayer } from '../components/TrialPlayer';
import { DuelBanner } from '../components/DuelBanner';
import { duelShape, duelState, midAnswer } from '../domain/duel';
import type { Verdict } from '../domain/answer';
import { playSfx } from '../audio/sfx';
import { Button, Loading, Screen, SpeakButton, TopBar } from '../components/ui';
import { useCity } from '../store/city';
import { useJourney } from '../store/journey';
import { syncAndEvaluate } from '../store/motivation';
import { useProgress } from '../store/progress';
import { useTrials } from '../store/trials';

/**
 * Страж земли (задача 5.4): охраняет печать главы. Испытание — 20 заданий по грамматике района, словам главы
 * и свитку земли, порог 75%, после неудачи — через сутки. Пускает, когда свиток земли выучен.
 */
export function GuardianScreen() {
  const chapter = Number(useParams().chapter);
  return <GuardianByChapter key={chapter} chapter={chapter} />;
}

function GuardianByChapter({ chapter }: { chapter: number }) {
  const nav = useNavigate();
  const ch = chapterById(chapter);
  const guardian = guardianOf(chapter);
  const id = guardianId(chapter);
  const opened = useJourney((s) => s.opened);
  const cards = useProgress((s) => s.cards);
  const grammar = useProgress((s) => s.grammar);
  const rec = useTrials((s) => s.records[id]);
  const now = useNow();
  const [data, setData] = useState<{ exercises: GrammarExercise[]; words: Word[]; scroll: Word[]; lessons: string[] } | null>(null);
  const [phase, setPhase] = useState<'intro' | 'run' | 'result'>('intro');
  const [items, setItems] = useState<TrialItem[]>([]);
  // Ответы схватки по порядку (задача 13.5): по ним полоска силы стража и щиты героя.
  const [verdicts, setVerdicts] = useState<Verdict[]>([]);
  const [result, setResult] = useState<{ correct: number; almost: number; total: number; first: boolean } | null>(null);
  const say = (es: string) => guardian && speakAs(es, guardian);

  useEffect(() => {
    if (!ch) return;
    (async () => {
      const lessons = ch.districts.flatMap((d) => lessonsOf(d as District).map((l) => l.id));
      const loaded = await Promise.all(lessons.map(loadLesson));
      const wordIds = Object.values(WORD_LEVELS).flatMap((levels) => ch.levels.flatMap((l) => levels[l] ?? []));
      setData({
        lessons,
        exercises: loaded.flatMap((l) => l?.exercises ?? []),
        words: await wordsByIds(wordIds),
        scroll: await wordsByIds(SCROLL_WORDS[chapter] ?? []),
      });
    })();
  }, [ch, chapter]);

  if (!ch || !guardian) {
    return (
      <Screen>
        <TopBar title="Страж" />
        <p className="px-5 py-6 text-stone-600">У этой главы ещё нет стража.</p>
      </Screen>
    );
  }
  if (!data) return <Loading />;
  const title = `Страж: ${guardian.name}`;

  if (phase === 'run') {
    const duel = duelState(verdicts, items.length, GUARDIAN_PASS);
    // Реплика середины висит три ответа, потом уступает место заданиям.
    const sinceMid = verdicts.length - midAnswer(items.length);
    const mid = sinceMid >= 0 && sinceMid < 3 ? heroText(guardian.mid) : null;
    return (
      <TrialPlayer
        items={items}
        banner={<DuelBanner guardian={guardian} state={duel} turn={verdicts.length} mid={mid} />}
        onAnswer={(_, v) => {
          const next = [...verdicts, v];
          setVerdicts(next);
          if (duelState(next, items.length, GUARDIAN_PASS).last === 'combo') playSfx('combo');
          if (next.length === midAnswer(items.length)) say(heroText(guardian.mid).es);
        }}
        words={Object.fromEntries([...data.words, ...data.scroll].map((w) => [w.id, w]))}
        label={`Страж главы ${ch.roman}`}
        onExit={() => nav(-1)}
        onFinish={(sc) => {
          const total = sc.correct + sc.almost + sc.wrong;
          const passed = isGuardianPassed(sc.correct, sc.almost, total);
          const first = useTrials.getState().finish(id, trialShare(sc.correct, sc.almost, total), passed);
          useProgress.getState().addXp(sc.correct * XP.correct + sc.almost * XP.almost);
          if (first) useCity.getState().addCoins(GUARDIAN_REWARD.coins);
          // Победа над стражем — условие печати: путь и медали пересчитываются сразу.
          syncAndEvaluate(Date.now(), {});
          setResult({ ...sc, total, first });
          setPhase('result');
          say(heroText(passed ? guardian.win : guardian.lose).es);
        }}
      />
    );
  }

  if (phase === 'result' && result) {
    const share = trialShare(result.correct, result.almost, result.total);
    const passed = isGuardianPassed(result.correct, result.almost, result.total);
    const line = heroText(passed ? guardian.win : guardian.lose);
    return (
      <Screen>
        <TopBar title={title} back={false} />
        <div className="flex flex-1 flex-col gap-3 px-5 pb-6">
          <div className="flex flex-col items-center rounded-2xl bg-white p-4 text-center shadow-sm" data-testid="guardian-result">
            <NpcPortrait look={guardian.look} size={90} label={guardian.name} />
            <div className="mt-2 text-lg font-bold">{passed ? `Печать главы ${ch.roman} получена` : 'Страж не пропустил'}</div>
            <p className="text-stone-600 tabular-nums">
              Верно: {result.correct + result.almost} из {result.total} ({Math.round(share * 100)}%)
            </p>
            <div className="mt-2 flex items-start gap-2 rounded-xl bg-orange-50 px-3 py-2 text-left">
              <div className="flex-1">
                <div className="font-semibold">{line.es}</div>
                <div className="text-sm text-stone-600">{line.ru}</div>
              </div>
              <SpeakButton text={line.es} />
            </div>
            {!passed && <p className="mt-2 text-sm text-stone-500">Нужно {Math.round(GUARDIAN_PASS * 100)}%. Следующая попытка через сутки.</p>}
            {result.first && (
              <p className="mt-2 font-semibold text-amber-700" data-testid="guardian-reward">
                +{GUARDIAN_REWARD.coins} 🪙
              </p>
            )}
          </div>
          <div className="flex-1" />
          <Button className="w-full" onClick={() => nav('/journey-map', { replace: true })}>
            На карту странствий
          </Button>
        </div>
      </Screen>
    );
  }

  const scrollLeft = (SCROLL_WORDS[chapter] ?? []).filter((w) => !(w in cards)).length;
  const lessonsDone = data.lessons.filter((l) => grammar[l]).length;
  const status = chapter > opened ? null : trialStatus(rec, scrollLeft, now);
  return (
    <Screen>
      <TopBar title={title} />
      <div className="flex flex-1 flex-col gap-3 px-5 pb-6">
        <div className="rounded-2xl bg-white p-4 shadow-sm" data-testid="guardian-intro">
          <div className="flex items-end gap-3">
            <NpcPortrait look={guardian.look} size={90} label={guardian.name} />
            <div className="min-w-0 flex-1">
              <div className="font-pixel text-xs tracking-widest text-amber-700 uppercase">Глава {ch.roman} · {ch.land}</div>
              <div className="text-lg font-bold">{guardian.name}</div>
              <div className="text-sm text-stone-500">{guardian.role}</div>
            </div>
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-orange-50 px-3 py-2">
            <div className="flex-1">
              <div className="font-semibold" data-testid="guardian-greeting">
                {heroText(guardian.greeting).es}
              </div>
              <div className="text-sm text-stone-600">{heroText(guardian.greeting).ru}</div>
            </div>
            <SpeakButton text={heroText(guardian.greeting).es} />
          </div>
          <p className="mt-3 leading-relaxed text-stone-700">
            {GUARDIAN_SIZE} заданий: грамматика района {ch.districts.join(' и ')}, слова главы и свитка земли. Подсказок нет, ошибки не
            повторяются.
          </p>
          <p className="mt-1 text-sm text-stone-500">
            Нужно {Math.round(GUARDIAN_PASS * 100)}% верных. Не получилось — следующая попытка через сутки. Победа даёт печать главы.
          </p>
          <p className="mt-2 rounded-xl bg-wood/10 px-3 py-2 text-stone-700" data-testid="guardian-duel">
            Это схватка: верный ответ — удар по силе стража, три подряд — приём вдвое сильнее, ошибку страж отражает и разбивает
            щит. Щитов {duelShape(GUARDIAN_SIZE, GUARDIAN_PASS).shields} — столько ошибок можно себе позволить.
          </p>
          {guardian.listen && (
            <p className="mt-2 rounded-xl bg-wood/10 px-3 py-2 text-stone-700" data-testid="guardian-listen">
              {listeningEnabled()
                ? `${guardian.name} слушает шёпоты: ${GUARDIAN_LISTEN} заданий из ${GUARDIAN_SIZE} — слова на слух, только голосом.`
                : `${guardian.name} слушает шёпоты, но звук сейчас недоступен: слова будут текстом.`}
            </p>
          )}
          {GUARDIAN_KINDS[chapter] && (
            <p className="mt-2 rounded-xl bg-wood/10 px-3 py-2 text-stone-700" data-testid="guardian-kinds">
              {guardian.name} повторит вашу фразу с ошибкой, попросит сказать то же другим тоном и другими словами: таких заданий не
              меньше {GUARDIAN_KIND_MIN * GUARDIAN_KINDS[chapter].length}.
            </p>
          )}
          <p className="mt-1 text-sm text-stone-500" data-testid="guardian-lessons">
            Уроки района пройдены: {lessonsDone} из {data.lessons.length}.
          </p>
        </div>
        <div className="flex-1" />
        {status === null && (
          <p className="rounded-2xl bg-orange-50 px-4 py-3 text-center text-stone-600" data-testid="guardian-state">
            Глава {ch.roman} ещё закрыта.
          </p>
        )}
        {status?.kind === 'done' && (
          <p className="rounded-2xl bg-okbg px-4 py-3 text-center font-semibold text-ok" data-testid="guardian-state">
            ✓ Страж побеждён, печать получена
          </p>
        )}
        {status?.kind === 'locked' && (
          <p className="rounded-2xl bg-orange-50 px-4 py-3 text-center text-stone-600" data-testid="guardian-state">
            Страж пустит, когда выучен свиток земли: осталось {status.wordsLeft} {plural(status.wordsLeft, ['слово', 'слова', 'слов'])}.
          </p>
        )}
        {status?.kind === 'wait' && (
          <p className="rounded-2xl bg-orange-50 px-4 py-3 text-center text-stone-600" data-testid="guardian-state">
            Следующая попытка {waitLabel(status.until, now)}.
          </p>
        )}
        {status?.kind === 'open' && (
          <Button
            className="w-full"
            data-testid="guardian-start"
            onClick={() => {
              const rng = seeded(Date.now());
              const known = (w: Word) => w.id in cards;
              // Слова главы — из выученных: страж проверяет то, что герой прошёл.
              const words = data.words.filter(known);
              const listen = guardian.listen === true && listeningEnabled();
              setVerdicts([]);
              setItems(buildGuardian(data.exercises, words.length >= 5 ? words : data.words, data.scroll, data.words, rng, { listen, kinds: GUARDIAN_KINDS[chapter] }));
              setPhase('run');
              say(heroText(guardian.greeting).es);
            }}
          >
            Бросить вызов стражу
          </Button>
        )}
      </div>
    </Screen>
  );
}
