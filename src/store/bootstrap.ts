import { watchReminder } from '../lib/reminder';
import { watchSoundCues } from '../audio/cues';
import { watchMusic } from '../audio/music';
import { unlockAudio } from '../audio/context';
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
import { useErrands, type ErrandsData } from './errands';
import { useMissions, type MissionsData } from './missions';
import { useTrials } from './trials';
import { useLetters, type LettersData } from './letters';
import { useSphinx } from './sphinx';
import type { SphinxRecord } from '../domain/sphinx';
import { useKeeper } from './keeper';
import { usePlacement } from './placement';
import { useRewards, watchLevelRewards } from './rewards';
import type { RewardsRecord } from '../domain/rewards';
import type { PlacementRecord } from '../domain/placement';
import type { KeeperRecord } from '../domain/keeper';
import type { TrialsData } from '../domain/trial';
import { usePrologue } from './prologue';
import { useThread } from './thread';
import { useBooks } from './books';
import { useStory } from './story';
import { useRumors } from './rumors';
import { useDiary, type DiaryRecord } from './diary';
import type { RumorsRecord } from '../domain/rumor';
import type { StoryRecord } from '../domain/story';
import type { BooksRecord } from '../domain/books';
import type { ThreadRecord } from '../domain/thread';
import type { PrologueRecord } from '../domain/prologue';
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
  useMissions.getState().hydrate(m.missions as MissionsData | undefined);
  useTrials.getState().hydrate(m.trials as TrialsData | undefined);
  useJourney.getState().hydrate(m.journey as Partial<JourneyRecord> | undefined);
  useErrands.getState().hydrate(m.errands as Partial<ErrandsData> | undefined);
  useLetters.getState().hydrate(m.letters as Partial<LettersData> | undefined);
  useSphinx.getState().hydrate(m.sphinx as Partial<SphinxRecord> | undefined);
  useKeeper.getState().hydrate(m.keeper as Partial<KeeperRecord> | undefined);
  usePlacement.getState().hydrate(m.placement as Partial<PlacementRecord> | undefined);
  usePrologue.getState().hydrate(m.prologue as PrologueRecord | undefined, cards.length > 0);
  useThread.getState().hydrate(m.thread as ThreadRecord | undefined);
  useBooks.getState().hydrate(m.books as BooksRecord | undefined);
  useStory.getState().hydrate(m.story as Partial<StoryRecord> | undefined);
  useRumors.getState().hydrate(m.rumors as Partial<RumorsRecord> | undefined);
  useDiary.getState().hydrate(m.diary as Partial<DiaryRecord> | undefined);
  useRewards.getState().hydrate(m.rewards as Partial<RewardsRecord> | undefined);
  // Награды уровней героя: задним числом за уже набранный уровень и дальше при каждом новом.
  useRewards.getState().sync();
  watchLevelRewards();
  useKeeper.getState().measure();
  useErrands.getState().refresh();
  // Перенос: при первом запуске обрывки и печати выдаются по уже пройденному.
  useJourney.getState().sync();
  if (useMotivation.getState().listenCorrect === null) {
    // Перенос: счётчик «Слушателя» появился в 2.3.0, до этого верные ответы на слух есть только в журнале.
    const heard = await db.answers.filter((r) => isListening(r.kind) && r.verdict === 'correct').count();
    useMotivation.getState().initListening(heard);
  }
  // Первая проверка после обновления переносит старые достижения в ступени медалей и выдаёт награды один раз.
  useMotivation.getState().evaluate(Date.now(), {}, false);
  // Напоминание о дневной цели: расписание пересчитывается при запуске и дальше по изменениям.
  watchReminder();
  // Звуки и музыка (задача 13.3): после загрузки, чтобы начальные значения не звучали.
  watchSoundCues();
  watchMusic();
  unlockAudio();
  // Старые записи журнала убираются в фоне: запуску они не нужны.
  pruneAnswers().catch((e) => console.error('Не удалось почистить журнал ответов', e));
}

export async function resetProgress(): Promise<void> {
  await db.delete();
  location.reload();
}
