/**
 * Пол голоса системы по его имени. Браузер пол голоса не сообщает, поэтому смотрим на имя: у Apple и Microsoft
 * голоса названы людьми (Jorge, Mónica, Luca, Elsa), у Google TTS на Android — кодами (es-es-x-eed-local).
 * Неизвестный голос — `null`: такой обычно женский (Google español, Google italiano), но наверняка не скажешь.
 */
export type VoiceGender = 'm' | 'f';

interface VoiceLike {
  name: string;
  lang: string;
}

const FEMALE = [
  'female', 'mujer', 'donna', 'femenina', 'femminile',
  'monica', 'paulina', 'marisol', 'helena', 'laura', 'elvira', 'sabina', 'dalia', 'lucia', 'elena', 'ximena',
  'isabel', 'francisca', 'conchita', 'penelope', 'lupe', 'mia', 'alice', 'federica', 'elsa', 'isabella',
  'paola', 'carla', 'emma', 'silvia', 'giulia', 'elisa', 'alessandra', 'chiara', 'angelica', 'soledad', 'catalina',
  'google español', 'google italiano',
];
const MALE = [
  'male', 'hombre', 'uomo', 'masculino', 'maschile',
  'jorge', 'diego', 'juan', 'pablo', 'enrique', 'alvaro', 'carlos', 'miguel', 'raul', 'gerardo', 'jaime',
  'luca', 'cosimo', 'giorgio', 'giuseppe', 'benigno', 'andres', 'alonso', 'tomas', 'rocco', 'gianni',
  // Google TTS на Android: мужские голоса испанского и итальянского.
  'x-eed', 'x-eef', 'x-itc', 'x-itd',
];

/** Имя без ударений и в нижнем регистре: «Mónica» и «Monica» — одно имя. */
function plain(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function has(name: string, hint: string) {
  // Слово целиком: «female» не должно сработать как «male», «Emmanuel» — как «Emma».
  return new RegExp(`(^|[^a-z])${plain(hint).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-z])`).test(name);
}

export function voiceGender(voice: VoiceLike | null | undefined): VoiceGender | null {
  if (!voice) return null;
  const name = plain(voice.name);
  if (FEMALE.some((h) => has(name, h))) return 'f';
  if (MALE.some((h) => has(name, h))) return 'm';
  return null;
}

function norm(lang: string) {
  return lang.replace('_', '-').toLowerCase();
}

/**
 * Голос нужного пола среди голосов языка: сначала того же варианта, что основной голос (es-ES не меняем на es-MX),
 * потом по списку предпочтений, потом любой голос языка. Нет такого — `null`.
 */
export function pickGendered(voices: VoiceLike[], main: VoiceLike | null, prefs: string[], prefix: string, gender: VoiceGender) {
  if (main && voiceGender(main) === gender) return main;
  const ofGender = voices.filter((v) => voiceGender(v) === gender);
  const langs = [...(main ? [norm(main.lang)] : []), ...prefs.map(norm)];
  for (const l of langs) {
    const v = ofGender.find((x) => norm(x.lang) === l);
    if (v) return v;
  }
  return ofGender.find((v) => norm(v.lang).startsWith(prefix)) ?? null;
}

/** Насколько опустить или поднять высоту основного голоса, если голоса нужного пола в системе нет. */
export const MALE_SHIFT = 0.7;
export const FEMALE_SHIFT = 1.3;

/**
 * Высота голоса, когда говорит основной голос вместо голоса нужного пола. Неизвестный основной голос считается
 * женским: так звучат голоса по умолчанию в Chrome и на Android.
 */
export function shiftedPitch(pitch: number, wanted: VoiceGender, main: VoiceGender | null): number {
  const have = main ?? 'f';
  if (have === wanted) return pitch;
  const p = pitch * (wanted === 'm' ? MALE_SHIFT : FEMALE_SHIFT);
  return Math.round(Math.min(2, Math.max(0.1, p)) * 100) / 100;
}
