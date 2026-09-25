import { db, type BuildingRow } from '../db/db';
import { pruneAnswers } from '../db/answers';
import { isListening } from '../domain/answerLog';
import { dayKey } from '../domain/srs';
import type { Settings } from './settings';
import { useCity } from './city';
import { useProgress } from './progress';
import { useSettings } from './settings';
import { useMotivation, type MotivationData } from './motivation';
import { useJourney } from './journey';
import type { JourneyRecord } from '../domain/chapters';

export async function bootstrap(): Promise<void> {
  // Просим браузер не вычищать IndexedDB при нехватке места: иначе прогресс может пропасть.
  navigator.storage?.persist?.().catch(() => {});

  const since = dayKey(Date.now() - 14 * 86_400_000);
  const [cards, buildings, meta, days, grammar] = await Promise.all([
    db.cards.toArray(),
    db.buildings.toArray(),
    db.meta.toArray(),
    db.days.where('date').aboveOrEqual(since).toArray(),
    db.grammar.toArray(),
  ]);
  const m = Object.fromEntries(meta.map((r) => [r.key, r.value]));

  if (!buildings.some((b) => b.locationId === 'cafe')) {
    // Кафе открыто с самого начала.
    const cafe: BuildingRow = { locationId: 'cafe', level: 1, lastCollectedAt: Date.now() };
    buildings.push(cafe);
    await db.buildings.put(cafe);
  }

  useProgress.getState().hydrate({ cards, days, xpTotal: (m.xpTotal as number) ?? 0, grammar });
  useCity.getState().hydrate({ coins: (m.coins as number) ?? 0, buildings });
  useSettings.getState().hydrate(m.settings as Partial<Settings> | undefined);
  useMotivation.getState().hydrate(m.motivation as Partial<MotivationData> | undefined);
  useMotivation.getState().settle();
  useJourney.getState().hydrate(m.journey as Partial<JourneyRecord> | undefined);
  // Перенос: при первом запуске обрывки и печати выдаются по уже пройденному.
  useJourney.getState().sync();
  if (useMotivation.getState().listenCorrect === null) {
    // Перенос: счётчик «Слушателя» появился в 2.3.0, до этого верные ответы на слух есть только в журнале.
    const heard = await db.answers.filter((r) => isListening(r.kind) && r.verdict === 'correct').count();
    useMotivation.getState().initListening(heard);
  }
  // Первая проверка после обновления переносит старые достижения в ступени медалей и выдаёт награды один раз.
  useMotivation.getState().evaluate(Date.now(), {}, false);
  // Старые записи журнала убираются в фоне: запуску они не нужны.
  pruneAnswers().catch((e) => console.error('Не удалось почистить журнал ответов', e));
}

export async function resetProgress(): Promise<void> {
  await db.delete();
  location.reload();
}
