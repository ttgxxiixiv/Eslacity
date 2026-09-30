import { CHAPTERS } from './chapters';
export { SAGE_TITLE } from './chapters';
import { isWordId } from './itemId';
import type { MedalsState } from './medals';
import type { SphinxRecord } from './sphinx';

/**
 * Эликсир и финал (задача 8.3): когда три загадки Сфинкса разгаданы, открывается Хранилище. Герой пьёт Эликсир,
 * медальон меню становится золотым, титул — «Мудрец», тайная медаль «Хранитель пути». Это конец основного пути.
 */

const DAY = 86_400_000;

/** Хранилище открыто: Сфинкс пропустил героя. */
export const isVaultOpen = (r: SphinxRecord) => r.done !== undefined;

/** Выпить Эликсир: только в открытом Хранилище и один раз. */
export function drinkElixir(r: SphinxRecord, now: number): SphinxRecord {
  if (!isVaultOpen(r) || r.elixir !== undefined) return r;
  return { ...r, elixir: now };
}

export interface JourneySummary {
  /** Дней от первого выученного слова до Эликсира. */
  days: number;
  /** Дней, когда герой занимался (по таблице дней). */
  activeDays: number;
  words: number;
  expressions: number;
  /** Ступени линий и тайные медали. */
  medals: number;
  missions: number;
  /** Печати глав с датой получения, по порядку глав. */
  seals: { chapter: number; roman: string; at?: number }[];
}

/** Итоги пути для экрана финала. Фразы мест, правила и глаголы кузницы в слова не входят. */
export function journeySummary(input: {
  cards: Record<string, { learnedAt?: number }>;
  isPhrase: (id: string) => boolean;
  isExpression: (id: string) => boolean;
  activeDays: number;
  medals: MedalsState;
  missions: Record<string, { done?: number }>;
  seals: Record<string, number>;
  end: number;
}): JourneySummary {
  let words = 0;
  let expressions = 0;
  let start = input.end;
  for (const [id, c] of Object.entries(input.cards)) {
    if (!isWordId(id)) continue;
    // У выражений часть речи phrase, поэтому они проверяются раньше фраз.
    if (input.isExpression(id)) expressions++;
    else if (input.isPhrase(id)) continue;
    else words++;
    if (c.learnedAt && c.learnedAt < start) start = c.learnedAt;
  }
  return {
    days: Math.floor((input.end - start) / DAY) + 1,
    activeDays: input.activeDays,
    words,
    expressions,
    medals: Object.values(input.medals.lines).reduce((n, rec) => n + Object.keys(rec ?? {}).length, 0) + Object.keys(input.medals.secrets).length,
    missions: Object.values(input.missions).filter((m) => m.done !== undefined).length,
    seals: CHAPTERS.map((c) => ({ chapter: c.id, roman: c.roman, at: input.seals[String(c.id)] })),
  };
}
