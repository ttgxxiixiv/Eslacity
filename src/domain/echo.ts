import type { GrammarExercise, Word } from '../content/schema';
import { normalize } from './answer';
import { isExpression, REGISTER_LABEL } from './expression';
import { type Rng, shuffle } from './generators';
import { phraseTokens } from './phraseSteps';
import type { SrsCard } from './srs';

/**
 * Поручение «Эхо» (глава V, задача 7.6): житель говорит выражение в одном регистре, герой повторяет ту же мысль
 * в другом. Задание — `register` из грамматики C1: пока выражение свежее, герой выбирает из трёх вариантов,
 * когда оно закрепилось (интервал от трёх дней) — собирает из плиток. Карточка задания — выражение, которое говорит герой.
 */

/** С этого интервала, в днях, выражение в «Эхе» собирается из плиток, раньше — выбирается. */
export const ECHO_BUILD_INTERVAL = 3;
/** Лишних плиток в сборке. */
const EXTRA_TILES = 2;

/** Задание «Эха» для выражения `target`: исходная фраза жителя — его пара `source`. */
export function echoExercise(target: Word, source: Word, pool: Word[], card: Pick<SrsCard, 'interval'> | undefined, rng: Rng): GrammarExercise {
  const to = target.register ?? 'neutral';
  const from = source.register ?? 'neutral';
  const base = {
    id: `echo:${target.id}`,
    explain: `«${source.es}» — ${REGISTER_LABEL[from]}, «${target.es}» — ${REGISTER_LABEL[to]}: ${target.ru}.`,
  };
  const others = pool.filter(
    (w) => isExpression(w) && w.id !== target.id && w.id !== source.id && normalize(w.es) !== normalize(target.es),
  );
  const tokens = phraseTokens(target.es);
  if ((card?.interval ?? 0) >= ECHO_BUILD_INTERVAL && tokens.length >= 2) {
    const own = new Set(tokens.map(normalize));
    const extra: string[] = [];
    for (const t of shuffle(others.flatMap((w) => phraseTokens(w.es)), rng)) {
      if (extra.length >= EXTRA_TILES) break;
      if (!own.has(normalize(t)) && !extra.some((x) => normalize(x) === normalize(t))) extra.push(t);
    }
    return { ...base, kind: 'register', source: source.es, to, answer: target.es, extra };
  }
  // Неверные варианты — сначала выражения того же регистра, чтобы подсказкой был смысл, а не тон.
  const same = shuffle(others.filter((w) => w.register === to), rng);
  const rest = shuffle(others.filter((w) => w.register !== to), rng);
  const options = [target.es];
  for (const w of [...same, ...rest]) {
    if (options.length >= 3) break;
    if (!options.some((o) => normalize(o) === normalize(w.es))) options.push(w.es);
  }
  return { ...base, kind: 'register', source: source.es, to, options, answer: 0 };
}

/** Задания поручения: только выражения, пара которых нашлась среди загруженных слов. */
export function echoExercises(
  ids: string[], words: Record<string, Word>, pool: Word[], cards: Record<string, SrsCard>, rng: Rng,
): { cardId: string; ex: GrammarExercise }[] {
  return ids.flatMap((id) => {
    const target = words[id];
    const source = target?.pair ? words[target.pair] : undefined;
    return target && source ? [{ cardId: id, ex: echoExercise(target, source, pool, cards[id], rng) }] : [];
  });
}
