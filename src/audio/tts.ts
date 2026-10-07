import { VARIANT, VARIANTS } from '../config';
import { L, LANG } from '../lang';
import { useSettings } from '../store/settings';
import { QueueStrategy, TextToSpeech } from '@capacitor-community/text-to-speech';
import { NATIVE } from '../lib/native';
import { pickGendered, shiftedPitch, voiceGender, type VoiceGender } from './voiceGender';

/** Голос: в браузере — SpeechSynthesisVoice, в приложении для Android — запись из списка движка TTS. */
type Voice = { name: string; lang: string };

let voice: Voice | null = null;
/** Голоса языка по полу: для героя и жителей. `null` — такого голоса в системе нет, говорит основной. */
let gendered: Record<VoiceGender, Voice | null> = { m: null, f: null };
/** Список голосов уже загружен (на Android он приходит с задержкой). */
let voicesLoaded = false;
/**
 * В приложении для Android (WebView) Web Speech нет: говорит системный движок через плагин
 * `@capacitor-community/text-to-speech`, голос выбирается по номеру в его списке (`nativeVoices`).
 */
let nativeVoices: Voice[] = [];
const supported = NATIVE || (typeof window !== 'undefined' && 'speechSynthesis' in window);

function norm(lang: string) {
  return lang.replace('_', '-').toLowerCase();
}

function preferredVoices(): string[] {
  return LANG === 'es' ? VARIANTS[VARIANT].voices : L.voices;
}

function pickVoice(voices: Voice[] = speechSynthesis.getVoices()) {
  if (voices.length) voicesLoaded = true;
  const prefs = preferredVoices().map(norm);
  voice =
    prefs.map((p) => voices.find((v) => norm(v.lang) === p)).find(Boolean) ??
    voices.find((v) => norm(v.lang).startsWith(L.voicePrefix)) ??
    null;
  const pick = (g: VoiceGender) => pickGendered(voices, voice, preferredVoices(), L.voicePrefix, g);
  gendered = { m: pick('m'), f: pick('f') };
  langVoices = voices.filter((v) => norm(v.lang).startsWith(L.voicePrefix));
  for (const cb of voiceListeners) cb();
}

/** Подписка на список голосов: на Android он приходит после запуска. Возвращает отписку. */
const voiceListeners = new Set<() => void>();
export function onVoicesChanged(cb: () => void): () => void {
  voiceListeners.add(cb);
  return () => voiceListeners.delete(cb);
}

/** Голоса изучаемого языка в системе: из них игрок выбирает мужской и женский голос в настройках. */
let langVoices: Voice[] = [];
export function languageVoices(): Voice[] {
  return langVoices;
}

/**
 * Голос этого пола: выбранный игроком в настройках («Мужской голос», «Женский голос»), иначе угаданный по имени
 * (`pickGendered`). Угадать удаётся не везде: у голосов Google на Android имена — коды.
 */
function genderVoice(g: VoiceGender): Voice | null {
  const chosen = useSettings.getState()[g === 'm' ? 'voiceM' : 'voiceF'];
  return (chosen && langVoices.find((v) => v.name === chosen)) || gendered[g];
}

if (NATIVE) {
  TextToSpeech.getSupportedVoices()
    .then(({ voices }) => {
      nativeVoices = voices;
      pickVoice(voices);
    })
    .catch(() => {});
} else if (supported) {
  pickVoice();
  speechSynthesis.addEventListener?.('voiceschanged', () => pickVoice());
}

export function ttsSupported(): boolean {
  return supported;
}

export function currentVoice(): Voice | null {
  return voice;
}

// Ссылка на текущую фразу: иначе Chrome может собрать её сборщиком мусора и оборвать звук.
let current: SpeechSynthesisUtterance | null = null;

/** Голос, которым говорит герой или житель этого пола: свой голос системы или основной. */
export function voiceFor(gender: VoiceGender): Voice | null {
  return genderVoice(gender) ?? voice;
}

/**
 * Сказать текст голосом языка. pitch — высота голоса (у жителей своя). `gender` — пол говорящего: берётся голос
 * этого пола, а если такого в системе нет, основной голос опускается или поднимается (`shiftedPitch`).
 */
export function speak(text: string, rate = useSettings.getState().speechRate, pitch = 1, gender?: VoiceGender): void {
  if (!supported || !text) return;
  const finish = startSpoken(text, rate);
  const own = gender ? genderVoice(gender) : null;
  const v = own ?? voice;
  const tone = gender && !own ? shiftedPitch(pitch, gender, voiceGender(voice)) : pitch;
  if (NATIVE) {
    // Новая фраза обрывает прежнюю (Flush). Голос — номер в списке движка; без списка движок берёт голос по lang.
    const index = v ? nativeVoices.indexOf(v) : -1;
    TextToSpeech.speak({
      text,
      lang: v?.lang ?? preferredVoices()[0],
      rate,
      pitch: tone,
      voice: index >= 0 ? index : undefined,
      queueStrategy: QueueStrategy.Flush,
    })
      .catch(() => {})
      .finally(finish);
    return;
  }
  const u = new SpeechSynthesisUtterance(text);
  // Если голоса ещё не загрузились, Android всё равно выберет голос по lang.
  u.lang = v?.lang ?? preferredVoices()[0];
  if (v) u.voice = v as SpeechSynthesisVoice;
  u.rate = rate;
  u.pitch = tone;
  u.onend = () => {
    if (current === u) current = null;
    finish();
  };
  u.onerror = finish;
  current = u;
  if (speechSynthesis.speaking || speechSynthesis.pending) {
    // В Chrome speak() сразу после cancel() иногда молча теряется.
    speechSynthesis.cancel();
    setTimeout(() => current === u && speechSynthesis.speak(u), 60);
  } else {
    speechSynthesis.speak(u);
  }
}

/**
 * Конец текущей реплики: «Повторить за жителем» сначала договаривает реплику жителя, потом включает запись игрока.
 * Обещание выполняется по концу речи, а если движок о нём не сообщил (оборвали, нет голоса), — по запасному
 * времени из длины текста.
 */
let spoken: Promise<void> = Promise.resolve();

function startSpoken(text: string, rate: number): () => void {
  let done!: () => void;
  const mine = (spoken = new Promise<void>((resolve) => {
    done = resolve;
    setTimeout(resolve, Math.min(15_000, 800 + (text.length * 80) / Math.max(rate, 0.3)));
  }));
  setSpeaking(true);
  // Речь кончилась, если не началась новая реплика.
  void mine.then(() => spoken === mine && setSpeaking(false));
  return () => done();
}

/** Говорит ли сейчас кто-то: музыка на это время затихает (задача 13.3). */
let speakingNow = false;
const speakingListeners = new Set<(on: boolean) => void>();
function setSpeaking(on: boolean) {
  if (speakingNow === on) return;
  speakingNow = on;
  for (const cb of speakingListeners) cb(on);
}
export function onSpeaking(cb: (on: boolean) => void): () => void {
  speakingListeners.add(cb);
  return () => speakingListeners.delete(cb);
}

/** Дождаться, пока договорится последняя реплика. */
export function untilSpoken(): Promise<void> {
  return spoken;
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
