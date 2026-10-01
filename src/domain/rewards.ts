import { hintsFor, LEVEL_REWARDS, type BlitzMode, type CloakId, type LevelReward } from '../config';

/** Награды уровней героя (задача 9.2): что открыто и сколько жетонов подсказки на руках. */
export interface RewardsRecord {
  /** До какого уровня награды уже выданы. */
  level: number;
  /** Жетоны подсказки на руках. */
  hints: number;
  blitz: BlitzMode[];
  cloaks: CloakId[];
  /** Выбранный плащ путника. */
  cloak: CloakId;
  /** Рекорды режимов блица, кроме обычного (его рекорд — в настройках, по нему медали). */
  blitzBest: Partial<Record<BlitzMode, number>>;
}

export const EMPTY_REWARDS: RewardsRecord = { level: 1, hints: 0, blitz: ['classic'], cloaks: ['sackcloth'], cloak: 'sackcloth', blitzBest: {} };

/** Награда уровня: из таблицы, а уровень без неё даёт жетоны подсказки. */
export function rewardFor(level: number): LevelReward {
  const hints = hintsFor(level);
  return LEVEL_REWARDS[level] ?? (hints ? { hints } : {});
}

/** Накидки по порядку: от мешковины до парчи. */
export const CLOAK_ORDER: CloakId[] = ['sackcloth', 'homespun', 'linen', 'broadcloth', 'leather', 'velvet', 'silk', 'brocade'];

/**
 * Запись наград из базы: до 2.109.0 плащи были цветами (мох, багрянец…). Накидки по материалам выдаются
 * заново по уже набранному уровню; выбранная неизвестная накидка заменяется самой благородной из полученных.
 */
export function normalizeRewards(d: Partial<RewardsRecord> | undefined): RewardsRecord {
  const rec: RewardsRecord = { ...EMPTY_REWARDS, ...d, blitzBest: { ...d?.blitzBest } };
  const cloaks = CLOAK_ORDER.filter((c) => unlockLevel({ cloak: c }) <= rec.level);
  const cloak = cloaks.includes(rec.cloak) ? rec.cloak : cloaks[cloaks.length - 1];
  return { ...rec, cloaks, cloak };
}

/** Выдать награды всех уровней до `level`, которых ещё нет. Возвращает запись и награды по уровням. */
export function grantUpTo(r: RewardsRecord, level: number): { rec: RewardsRecord; gained: { level: number; reward: LevelReward }[] } {
  if (level <= r.level) return { rec: r, gained: [] };
  const gained: { level: number; reward: LevelReward }[] = [];
  let { hints } = r;
  const blitz = [...r.blitz];
  const cloaks = [...r.cloaks];
  for (let l = r.level + 1; l <= level; l++) {
    const reward = rewardFor(l);
    if (!reward.hints && !reward.blitz && !reward.cloak) continue;
    gained.push({ level: l, reward });
    hints += reward.hints ?? 0;
    if (reward.blitz && !blitz.includes(reward.blitz)) blitz.push(reward.blitz);
    if (reward.cloak && !cloaks.includes(reward.cloak)) cloaks.push(reward.cloak);
  }
  return { rec: { ...r, level, hints, blitz, cloaks }, gained };
}

/** Потратить жетон подсказки; без жетонов запись та же. */
export const spendHint = (r: RewardsRecord): RewardsRecord => (r.hints > 0 ? { ...r, hints: r.hints - 1 } : r);

/**
 * Что открывает подсказка: первую букву ответа. У существительного с артиклем — артикль и первую букву слова
 * («la m»), иначе подсказка ничего не даёт.
 */
export function hintPrefix(answer: string, articles: string[]): string {
  // Артикль с апострофом пишется слитно: «l'acqua» → «l'a».
  const elided = articles.find((a) => a.endsWith("'") && answer.startsWith(a));
  if (elided) return answer.slice(0, elided.length + 1);
  const [first, ...rest] = answer.split(' ');
  if (rest.length && articles.includes(first)) return `${first} ${rest.join(' ').charAt(0)}`;
  return answer.charAt(0);
}

export const BLITZ_LABEL: Record<BlitzMode, { title: string; text: string }> = {
  classic: { title: 'Обычный', text: '60 секунд, выбор из четырёх вариантов.' },
  listen: { title: 'На слух', text: '60 секунд: слово звучит, текста нет, выберите перевод.' },
  survival: { title: 'Без права на ошибку', text: 'Времени нет, но три ошибки — и блиц окончен.' },
};

export const CLOAK_LABEL: Record<CloakId, string> = {
  sackcloth: 'Мешковина',
  homespun: 'Сермяга',
  linen: 'Лён',
  broadcloth: 'Сукно',
  leather: 'Кожа',
  velvet: 'Бархат',
  silk: 'Шёлк',
  brocade: 'Парча',
};

/** Подпись награды: «3 жетона подсказки», «режим блица «На слух»», «плащ «Багрянец»». */
export function rewardLines(r: LevelReward): string[] {
  const out: string[] = [];
  if (r.hints) out.push(`${r.hints} ${r.hints === 1 ? 'жетон' : r.hints < 5 ? 'жетона' : 'жетонов'} подсказки`);
  if (r.blitz) out.push(`режим блица «${BLITZ_LABEL[r.blitz].title}»`);
  if (r.cloak) out.push(`накидка: ${CLOAK_LABEL[r.cloak].toLowerCase()}`);
  return out;
}

/** С какого уровня героя открывается режим блица или плащ (обычный режим и зелёный плащ — сразу). */
export function unlockLevel(what: { blitz?: BlitzMode; cloak?: CloakId }): number {
  for (const [l, r] of Object.entries(LEVEL_REWARDS)) {
    if ((what.blitz && r.blitz === what.blitz) || (what.cloak && r.cloak === what.cloak)) return Number(l);
  }
  return 1;
}

/** Ошибок до конца блица «Без права на ошибку». */
export const SURVIVAL_LIVES = 3;
