import { ES } from './es';
import { IT } from './it';
import { EN } from './en';
import { TR } from './tr';
import { PT } from './pt';
import type { Lang, LangProfile } from './types';

/** Профили всех языков курса (задача 16.6). Новый язык — строка здесь. */
export const PROFILES: Record<Lang, LangProfile> = { es: ES, it: IT, en: EN, tr: TR, pt: PT };

export type * from './types';
