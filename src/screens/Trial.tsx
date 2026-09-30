import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { XP } from '../config';
import { loadLocation } from '../content';
import { LOCATION_BY_ID } from '../content/locations';
import { npcFor } from '../content/npcs';
import { loadPhrases } from '../content/phrases';
import type { LocationId, Phrase, Word } from '../content/schema';
import { listeningEnabled } from '../audio/tts';
import { chapterById } from '../domain/chapters';
import { seeded } from '../domain/generators';
import {
  buildTrial, EXPRESSION_TRIAL_CHAPTER, isTrialPassed, parseTrialId, TRIAL_PASS, TRIAL_REWARD, TRIAL_SIZE, trialShare, trialStatus, waitLabel,
  type TrialItem,
} from '../domain/trial';
import { useNow } from '../lib/useNow';
import { Button, Screen, TopBar } from '../components/ui';
import { TrialPlayer, type TrialScore } from '../components/TrialPlayer';
import { useCity } from '../store/city';
import { syncAndEvaluate } from '../store/motivation';
import { useProgress } from '../store/progress';
import { useTrials } from '../store/trials';

type Score = TrialScore;

/**
 * Испытание места (задача 5.1): 15 заданий по словам и фразам главы, больше половины — ввод.
 * Ошибки не повторяются, карточки повторения не меняются: это проверка, а не урок.
 */
export function TrialScreen() {
  const id = decodeURIComponent(useParams().id ?? '');
  return <TrialById key={id} id={id} />;
}

function TrialById({ id }: { id: string }) {
  const nav = useNavigate();
  const parsed = parseTrialId(id);
  const chapter = parsed ? chapterById(parsed.chapter) : undefined;
  const place = parsed?.place as LocationId | undefined;
  const meta = place ? LOCATION_BY_ID[place] : undefined;
  const npc = place ? npcFor(place) : undefined;
  const [data, setData] = useState<{ words: Word[]; all: Word[]; phrases: Phrase[]; pool: Phrase[] } | null>(null);
  const [phase, setPhase] = useState<'intro' | 'run' | 'result'>('intro');
  const [items, setItems] = useState<TrialItem[]>([]);
  const [result, setResult] = useState<(Score & { total: number; first: boolean }) | null>(null);
  const cards = useProgress((s) => s.cards);
  const rec = useTrials((s) => s.records[id]);
  const now = useNow();

  useEffect(() => {
    if (!place || !chapter) return;
    (async () => {
      const all = await loadLocation(place);
      const pool = await loadPhrases(place);
      setData({
        all,
        words: all.filter((w) => chapter.levels.includes(w.level)),
        pool,
        phrases: pool.filter((p) => chapter.levels.includes(p.level)),
      });
    })();
  }, [place, chapter]);

  const title = meta ? `Испытание: ${meta.ru}` : 'Испытание';
  if (!parsed || !chapter || !meta) {
    return (
      <Screen>
        <TopBar title="Испытание" />
        <p className="px-5 py-6 text-stone-600">Такого испытания нет.</p>
      </Screen>
    );
  }
  if (!data) return null;

  if (phase === 'run') {
    const byId = Object.fromEntries(data.all.map((w) => [w.id, w]));
    const phrases = Object.fromEntries(data.pool.map((p) => [p.id, p]));
    return (
      <TrialPlayer
        items={items}
        words={byId}
        phrases={phrases}
        onExit={() => nav(-1)}
        onFinish={(sc) => {
          const total = sc.correct + sc.almost + sc.wrong;
          const passed = isTrialPassed(sc.correct, sc.almost, total);
          const first = useTrials.getState().finish(id, trialShare(sc.correct, sc.almost, total), passed);
          useProgress.getState().addXp(sc.correct * XP.correct + sc.almost * XP.almost);
          if (first) useCity.getState().addCoins(TRIAL_REWARD.coins);
          // Испытание — условие обрывка и счётчик «Испытателя»: путь и медали пересчитываются сразу.
          syncAndEvaluate(Date.now(), {});
          setResult({ ...sc, total, first });
          setPhase('result');
        }}
      />
    );
  }

  if (phase === 'result' && result) {
    const share = trialShare(result.correct, result.almost, result.total);
    const passed = isTrialPassed(result.correct, result.almost, result.total);
    return (
      <Screen>
        <TopBar title={title} back={false} />
        <div className="flex flex-1 flex-col gap-3 px-5 pb-6">
          <div className="rounded-2xl bg-white p-4 text-center shadow-sm" data-testid="trial-result">
            <div className="text-4xl">{passed ? '🏆' : '⏳'}</div>
            <div className="mt-1 text-lg font-bold">{passed ? 'Испытание пройдено' : 'Испытание не пройдено'}</div>
            <p className="text-stone-600 tabular-nums">
              Верно: {result.correct + result.almost} из {result.total} ({Math.round(share * 100)}%)
            </p>
            {!passed && (
              <p className="mt-1 text-sm text-stone-500">
                Нужно {Math.round(TRIAL_PASS * 100)}%. Следующая попытка через сутки: повторите слова и фразы места.
              </p>
            )}
            {result.first && (
              <p className="mt-2 font-semibold text-amber-700" data-testid="trial-reward">
                +{TRIAL_REWARD.coins} 🪙
              </p>
            )}
          </div>
          <div className="flex-1" />
          <Button className="w-full" onClick={() => nav(`/loc/${place}`, { replace: true })}>
            Готово
          </Button>
        </div>
      </Screen>
    );
  }

  const wordsLeft = data.words.filter((w) => !(w.id in cards)).length;
  const status = trialStatus(rec, wordsLeft, now);
  const learnedPhrases = data.phrases.filter((p) => p.id in cards);
  return (
    <Screen>
      <TopBar title={title} />
      <div className="flex flex-1 flex-col gap-3 px-5 pb-6">
        <div className="rounded-2xl bg-white p-4 shadow-sm" data-testid="trial-intro">
          <div className="font-pixel text-xs tracking-widest text-amber-700 uppercase">Глава {chapter.roman}</div>
          <p className="mt-2 leading-relaxed text-stone-700">
            {npc ? `${npc.name} проверяет` : 'Проверка'}: {TRIAL_SIZE} заданий по словам и фразам главы {chapter.roman} этого места.
            Больше половины нужно написать самому. Подсказок нет, ошибки не повторяются.
          </p>
          {parsed.chapter >= EXPRESSION_TRIAL_CHAPTER && (
            <p className="mt-2 leading-relaxed text-stone-700" data-testid="trial-echo">
              В Лабиринте Эха среди слов — устойчивые выражения места, и два из них нужно сказать другим тоном: житель говорит одно, вы
              отвечаете парой.
            </p>
          )}
          <p className="mt-2 text-sm text-stone-500">
            Нужно {Math.round(TRIAL_PASS * 100)}% верных. Не получилось — следующая попытка через сутки. Пройденное испытание открывает путь к обрывку карты.
          </p>
        </div>
        <div className="flex-1" />
        {status.kind === 'done' && (
          <p className="rounded-2xl bg-okbg px-4 py-3 text-center font-semibold text-ok" data-testid="trial-state">
            ✓ Испытание пройдено
          </p>
        )}
        {status.kind === 'locked' && (
          <p className="rounded-2xl bg-orange-50 px-4 py-3 text-center text-stone-600" data-testid="trial-state">
            Сначала выучите слова главы: осталось {status.wordsLeft}.
          </p>
        )}
        {status.kind === 'wait' && (
          <p className="rounded-2xl bg-orange-50 px-4 py-3 text-center text-stone-600" data-testid="trial-state">
            Следующая попытка {waitLabel(status.until, now)}.
          </p>
        )}
        {status.kind === 'open' && (
          <Button
            className="w-full"
            data-testid="trial-start"
            onClick={() => {
              const rng = seeded(Date.now());
              setItems(
                buildTrial(data.words, learnedPhrases, data.all, data.pool, rng, {
                  listening: listeningEnabled(),
                  expressions: parsed.chapter >= EXPRESSION_TRIAL_CHAPTER,
                }),
              );
              setPhase('run');
            }}
          >
            Начать испытание
          </Button>
        )}
      </div>
    </Screen>
  );
}
