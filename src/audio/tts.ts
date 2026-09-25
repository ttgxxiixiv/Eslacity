import { VARIANT, VARIANTS } from '../config';
import { L, LANG } from '../lang';
import { useSettings } from '../store/settings';

let voice: SpeechSynthesisVoice | null = null;
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

export function speak(text: string, rate = useSettings.getState().speechRate): void {
  if (!supported || !text) return;
  const u = new SpeechSynthesisUtterance(text);
  // Если голоса ещё не загрузились, Android всё равно выберет голос по lang.
  u.lang = voice?.lang ?? preferredVoices()[0];
  if (voice) u.voice = voice;
  u.rate = rate;
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
