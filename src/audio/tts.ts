import { VARIANT, VARIANTS } from '../config';
import { useSettings } from '../store/settings';

let voice: SpeechSynthesisVoice | null = null;
const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

function norm(lang: string) {
  return lang.replace('_', '-').toLowerCase();
}

function pickVoice() {
  const voices = speechSynthesis.getVoices();
  const prefs = VARIANTS[VARIANT].voices.map(norm);
  voice =
    prefs.map((p) => voices.find((v) => norm(v.lang) === p)).find(Boolean) ??
    voices.find((v) => norm(v.lang).startsWith('es')) ??
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

export function speak(text: string, rate = useSettings.getState().speechRate): void {
  if (!supported || !text) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  // Если голоса ещё не загрузились, Android всё равно выберет испанский по lang.
  u.lang = voice?.lang ?? VARIANTS[VARIANT].voices[0];
  if (voice) u.voice = voice;
  u.rate = rate;
  speechSynthesis.speak(u);
}
