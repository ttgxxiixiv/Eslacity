import { ES } from './es';
import { IT } from './it';
import type { Lang, LangProfile } from './types';

/** Профили всех языков курса (задача 16.6). Новый язык — строка здесь. */
export const PROFILES: Record<Lang, LangProfile> = { es: ES, it: IT };

export type * from './types';
