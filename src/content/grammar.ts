import { VARIANT, VARIANTS } from '../config';
import { forVariant } from '../domain/grammar';
import type { District, GrammarLesson } from './schema';

// Уроки маленькие, грузим сразу: список нужен для карты района.
const modules = import.meta.glob<GrammarLesson>('./grammar/*/*.json', { eager: true, import: 'default' });

export const GRAMMAR: GrammarLesson[] = Object.values(modules)
  .map((l) => forVariant(l, VARIANTS[VARIANT].vosotros))
  .sort((a, b) => a.order - b.order);

export const GRAMMAR_BY_ID = Object.fromEntries(GRAMMAR.map((l) => [l.id, l]));

export const DISTRICTS: { id: District; title: string; subtitle: string }[] = [
  { id: 'A1', title: 'A1', subtitle: 'Первые шаги' },
  { id: 'A2', title: 'A2', subtitle: 'Прошедшие времена, местоимения, сравнения' },
  { id: 'B1.1', title: 'B1.1', subtitle: 'Будущее, условное наклонение, subjuntivo' },
  { id: 'B1.2', title: 'B1.2', subtitle: 'Условные предложения, косвенная речь, se' },
  { id: 'B2', title: 'B2', subtitle: 'Сложные времена subjuntivo, согласование времён' },
];

export function lessonsOf(d: District): GrammarLesson[] {
  return GRAMMAR.filter((l) => l.district === d);
}
