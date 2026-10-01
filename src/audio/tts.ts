import { VARIANT, VARIANTS } from '../config';
import { L, LANG } from '../lang';
import { useSettings } from '../store/settings';
import { pickGendered, shiftedPitch, voiceGender, type VoiceGender } from './voiceGender';

let voice: SpeechSynthesisVoice | null = null;
/** Голоса языка по полу: для героя и жителей. `null` — такого голоса в системе нет, говорит основной. */
let gendered: Record<VoiceGender, SpeechSynthesisVoice | null> = { m: null, f: null };
/** Список голосов уже загружен (на Android он приходит с задержкой). */
let voicesLoaded = false;
const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

function norm(lang: string) {
  return lang.replace('_', '-').toLowerCase();
}

function preferredVoices(): string[] {
  return LANG === 'es' ? VARIANTS[VARIANT].voices : L.voices;
}

function pickVoice() {
  const voices = speechSynthesis.getVoices();
  if (voices.length) voicesLoaded = true;
  const prefs = preferredVoices().map(norm);
  voice =
    prefs.map((p) => voices.find((v) => norm(v.lang) === p)).find(Boolean) ??
    voices.find((v) => norm(v.lang).startsWith(L.voicePrefix)) ??
    null;
  const pick = (g: VoiceGender) => pickGendered(voices, voice, preferredVoices(), L.voicePrefix, g) as SpeechSynthesisVoice | null;
  gendered = { m: pick('m'), f: pick('f') };
}

if (supported) {
  pickVoice();
  speechSynthesis.addEventListener?.('voiceschanged', pickVoice);
}

export function ttsSupported(): boolean {
  return supported;
}

export function currentVoice(): SpeechSynthesisVoice | null {
  return voice;
}

// Ссылка на текущую фразу: иначе Chrome может собрать её сборщиком мусора и оборвать звук.
let current: SpeechSynthesisUtterance | null = null;

/** Голос, которым говорит герой или житель этого пола: свой голос системы или основной. */
export function voiceFor(gender: VoiceGender): SpeechSynthesisVoice | null {
  return gendered[gender] ?? voice;
}

/**
 * Сказать текст голосом языка. pitch — высота голоса (у жителей своя). `gender` — пол говорящего: берётся голос
 * этого пола, а если такого в системе нет, основной голос опускается или поднимается (`shiftedPitch`).
 */
export function speak(text: string, rate = useSettings.getState().speechRate, pitch = 1, gender?: VoiceGender): void {
  if (!supported || !text) return;
  const u = new SpeechSynthesisUtterance(text);
  const own = gender ? gendered[gender] : null;
  const v = own ?? voice;
  // Если голоса ещё не загрузились, Android всё равно выберет голос по lang.
  u.lang = v?.lang ?? preferredVoices()[0];
  if (v) u.voice = v;
  u.rate = rate;
  u.pitch = gender && !own ? shiftedPitch(pitch, gender, voiceGender(voice)) : pitch;
  u.onend = () => {
    if (current === u) current = null;
  };
  current = u;
  if (speechSynthesis.speaking || speechSynthesis.pending) {
    // В Chrome speak() сразу после cancel() иногда молча теряется.
    speechSynthesis.cancel();
    setTimeout(() => current === u && speechSynthesis.speak(u), 60);
  } else {
    speechSynthesis.speak(u);
  }
}

/** Говорящий со своим голосом: житель, страж, кузнец, Летописец. Без пола (Сфинкс) — основной голос. */
export interface Speaker {
  voice: { pitch: number; rate: number };
  gender?: VoiceGender;
}

/** Реплика говорящего его голосом: скорость из настроек с его поправкой, голос его пола. */
export function speakAs(text: string, who: Speaker): void {
  speak(text, useSettings.getState().speechRate * who.voice.rate, who.voice.pitch, who.gender);
}

/** Реплика путника: голос пола, выбранного в настройках («Путник»). */
export function speakHero(text: string): void {
  speak(text, useSettings.getState().speechRate, 1, useSettings.getState().heroGender);
}

/** Можно ли сейчас давать задания на слух. */
export function listeningEnabled(now = Date.now()): boolean {
  // Если голоса загрузились, а голоса изучаемого языка среди них нет, звук будет молчать: заданий на слух не даём.
  return supported && now >= useSettings.getState().listenOffUntil && (!voicesLoaded || voice !== null);
}

/** «Не могу слушать»: задания на слух заменяются обычными на час. */
export function pauseListening(hours = 1): void {
  useSettings.getState().update({ listenOffUntil: Date.now() + hours * 3_600_000 });
}

/** true/false, когда список голосов загружен; null, пока неизвестно. */
export function hasLangVoice(): boolean | null {
  return voicesLoaded ? voice !== null : null;
}
