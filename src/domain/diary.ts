import type { DiaryEntry, DiaryTopic } from '../content/schema';

/**
 * Дневник путника (задача 13.8): факты истории, собранные из разговоров, сцен Летописца и слухов. Запись открывается,
 * когда герой дослушал её разговор (или прошёл миссию места этой главы — вступлением к ней служит тот же разговор),
 * прочитал сцену Летописца или узнал слух. Полный дневник главы — тайная медаль «Страница летописи».
 */

export const DIARY_TOPICS: Record<DiaryTopic, string> = {
  map: 'Карта и земли',
  vault: 'Хранилище и Эликсир',
  guardians: 'Стражи',
  merchant: 'Купец',
  crier: 'Глашатай',
  residents: 'Жители',
};

/** Порядок тем на странице главы. */
export const DIARY_TOPIC_ORDER: DiaryTopic[] = ['map', 'vault', 'guardians', 'merchant', 'crier', 'residents'];

/** Записей на главу не меньше. */
export const DIARY_PER_CHAPTER = 6;

export interface DiarySources {
  /** Дослушанные разговоры `sc:`. */
  scenes: ReadonlySet<string>;
  /** Засчитанные миссии `ms:`. */
  missions: ReadonlySet<string>;
  /** Прочитанные сцены Летописца `th:`. */
  thread: ReadonlySet<string>;
  /** Полученные слухи `rm:`. */
  rumors: ReadonlySet<string>;
}

export type DiarySourceKind = 'scene' | 'thread' | 'rumor';

export const sourceKind = (from: string): DiarySourceKind => (from.startsWith('th:') ? 'thread' : from.startsWith('rm:') ? 'rumor' : 'scene');

/** Запись открыта. */
export function entryOpen(e: Pick<DiaryEntry, 'from'>, s: DiarySources): boolean {
  const kind = sourceKind(e.from);
  if (kind === 'thread') return s.thread.has(e.from);
  if (kind === 'rumor') return s.rumors.has(e.from);
  return s.scenes.has(e.from) || s.missions.has(e.from.replace(/^sc:/, 'ms:'));
}

export interface ChapterDiary {
  chapter: number;
  open: number;
  total: number;
}

/** Сколько записей открыто по главам. */
export function diaryProgress(entries: DiaryEntry[], s: DiarySources): ChapterDiary[] {
  const chapters = [...new Set(entries.map((e) => e.chapter))].sort((a, b) => a - b);
  return chapters.map((chapter) => {
    const own = entries.filter((e) => e.chapter === chapter);
    return { chapter, open: own.filter((e) => entryOpen(e, s)).length, total: own.length };
  });
}

/** Главы, где открыты все записи (для тайной медали). */
export const fullChapters = (entries: DiaryEntry[], s: DiarySources) => diaryProgress(entries, s).filter((c) => c.total > 0 && c.open === c.total).length;

/** Процент собранного. */
export const percent = (open: number, total: number) => (total ? Math.round((open / total) * 100) : 0);
