import type { ExpressionKind, Register, Usage, Word } from '../content/schema';

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

export const USAGES: Usage[] = ['regional', 'vulgar', 'dated', 'slang'];

export const USAGE_LABEL: Record<Usage, string> = {
  regional: 'региональное',
  vulgar: 'грубое',
  dated: 'устаревшее',
  slang: 'сленг',
};

/** Слово можно задавать на ввод и сборку: грубое игрок узнаёт, но не пишет (задача 15.2). */
export const typeable = (w: Pick<Word, 'usage'>) => w.usage !== 'vulgar';

export const isExpression = (w: Pick<Word, 'kind'>) => w.kind !== undefined;

/**
 * Метки записи для «Моих слов» и карточки нового слова: пометка употребления (15.2), вид выражения (только идиома
 * и ложный друг, сочетание и формула видны по самой фразе) и регистр, если он не нейтральный.
 */
export function wordTags(w: Pick<Word, 'kind' | 'register' | 'usage'>): string[] {
  const out: string[] = [];
  if (w.usage) out.push(USAGE_LABEL[w.usage]);
  if (w.kind === 'idiom' || w.kind === 'false-friend') out.push(KIND_LABEL[w.kind]);
  if (w.register && w.register !== 'neutral') out.push(REGISTER_LABEL[w.register]);
  return out;
}
