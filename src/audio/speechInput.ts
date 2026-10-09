import { L } from '../lang';
import { NATIVE } from '../lib/native';

/**
 * Распознавание речи браузера для ответа голосом (задача 10.3). Chrome отправляет звук на сервер, поэтому кнопка
 * есть только при сети. В приложении для Android (WebView) Web Speech нет, там кнопки тоже нет. Ответ голосом
 * дополнительный: всё проходится и вводом.
 */

interface RecognitionResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}
interface Recognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

function ctor(): RecognitionCtor | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

/** Игрок запретил микрофон: до перезапуска кнопки нет. */
let denied = false;

export function voiceInputSupported(): boolean {
  return !NATIVE && !denied && !!ctor() && (typeof navigator === 'undefined' || navigator.onLine);
}

/** Тег языка распознавания: вариант испанского из настроек или итальянский. */
export const recognitionLang = (): string => L.voices[0];

export interface Listening {
  /** Варианты услышанного, самый уверенный первым; пусто — ничего не расслышано. */
  result: Promise<string[]>;
  /** Закончить слушать раньше: распознается то, что уже сказано. */
  stop(): void;
}

export function listenAnswer(): Listening {
  const Ctor = ctor();
  if (!Ctor) return { result: Promise.resolve([]), stop() {} };
  const rec = new Ctor();
  rec.lang = recognitionLang();
  rec.interimResults = false;
  rec.maxAlternatives = 5;
  rec.continuous = false;
  let alts: string[] = [];
  const result = new Promise<string[]>((resolve, reject) => {
    rec.onresult = (e) => {
      const first = e.results[0];
      alts = first ? Array.from({ length: first.length }, (_, i) => first[i].transcript) : [];
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        denied = true;
        reject(new Error(e.error));
      }
      // «no-speech», «network» и прочее: просто ничего не услышано.
    };
    rec.onend = () => resolve(alts);
  });
  try {
    rec.start();
  } catch {
    return { result: Promise.resolve([]), stop() {} };
  }
  return { result, stop: () => rec.stop() };
}
