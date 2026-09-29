import type { ExpressionKind, Register, Word } from '../content/schema';

/** Уровень места, на котором появляются устойчивые выражения (глава V). */
export const EXPRESSION_LEVEL = 7;

export const KINDS: ExpressionKind[] = ['collocation', 'idiom', 'formula', 'false-friend'];
export const REGISTERS: Register[] = ['formal', 'neutral', 'informal'];

export const REGISTER_LABEL: Record<Register, string> = {
  formal: 'официально',
  neutral: 'нейтрально',
  informal: 'разговорно',
};

export const KIND_LABEL: Record<ExpressionKind, string> = {
  collocation: 'сочетание',
  idiom: 'идиома',
  formula: 'формула',
  'false-friend': 'ложный друг',
};

export const isExpression = (w: Pick<Word, 'kind'>) => w.kind !== undefined;

/**
 * Метки записи для «Моих слов» и карточки нового слова: вид выражения (только идиома и ложный друг,
 * сочетание и формула видны по самой фразе) и регистр, если он не нейтральный.
 */
export function wordTags(w: Pick<Word, 'kind' | 'register'>): string[] {
  const out: string[] = [];
  if (w.kind === 'idiom' || w.kind === 'false-friend') out.push(KIND_LABEL[w.kind]);
  if (w.register && w.register !== 'neutral') out.push(REGISTER_LABEL[w.register]);
  return out;
}
