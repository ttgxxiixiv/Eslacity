import { parseNotes, THEMES, type NoteEvent, type ThemeId, type Wave } from '../domain/chiptune';
import { useSettings } from '../store/settings';
import { announceSound, audioContext } from './context';
import TRACKS from './tracks.json';
import { onSpeaking } from './tts';

/** Громкость синтеза и записанного трека при громкости настроек 1 и доля, до которой музыка затихает, пока говорит житель. */
const MUSIC_GAIN = 0.12;
const TRACK_GAIN = 0.5;
const DUCK = 0.15;
/** Планировщик смотрит вперёд на столько секунд и просыпается так часто. */
const AHEAD = 0.4;
const TICK_MS = 120;

interface Voice {
  events: NoteEvent[];
  wave: Wave;
  /** Громкость голоса в теме. */
  vol: number;
  index: number;
  next: number;
}

let theme: ThemeId | null = null;
let voices: Voice[] = [];
let secPerEighth = 0.25;
let master: GainNode | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let speaking = false;
let source: AudioBufferSourceNode | null = null;
let gain = MUSIC_GAIN;

type Loop = { loopStart: number; loopEnd: number };
const tracks = TRACKS as Partial<Record<ThemeId, Loop>>;
/** Расшифрованные записи тем: файл качается и кэшируется service worker-ом при первом запросе. */
const buffers = new Map<ThemeId, Promise<AudioBuffer | null>>();

export const trackUrl = (id: ThemeId) => `${import.meta.env.BASE_URL}music/${id}.ogg`;

function loadTrack(c: AudioContext, id: ThemeId): Promise<AudioBuffer | null> {
  let p = buffers.get(id);
  if (!p) {
    p = fetch(trackUrl(id))
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((b) => c.decodeAudioData(b))
      .catch(() => {
        // Без сети или без поддержки Opus — синтез; в следующий раз попробуем снова.
        buffers.delete(id);
        return null;
      });
    buffers.set(id, p);
  }
  return p;
}

function level(): number {
  const v = useSettings.getState().musicVolume;
  return v > 0 ? v * gain * (speaking ? DUCK : 1) : 0;
}

/** Громкость по настройкам и речи: плавно, чтобы не щёлкало. */
function applyLevel() {
  const c = audioContext();
  if (c && master) master.gain.setTargetAtTime(level(), c.currentTime, 0.15);
}

function schedule() {
  const c = audioContext();
  if (!c || !master || c.state !== 'running') return;
  for (const v of voices) {
    if (v.next < c.currentTime) v.next = c.currentTime + 0.05;
    while (v.next < c.currentTime + AHEAD) {
      const e = v.events[v.index];
      const dur = e.len * secPerEighth;
      if (e.freq > 0) {
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = v.wave;
        osc.frequency.value = e.freq;
        g.gain.setValueAtTime(0, v.next);
        g.gain.linearRampToValueAtTime(v.vol, v.next + 0.01);
        g.gain.setTargetAtTime(v.vol * 0.6, v.next + 0.05, 0.08);
        g.gain.linearRampToValueAtTime(0, v.next + dur * 0.92);
        osc.connect(g).connect(master);
        osc.start(v.next);
        osc.stop(v.next + dur);
      }
      v.next += dur;
      v.index = (v.index + 1) % v.events.length;
    }
  }
}

/** Играть тему по кругу; та же тема не перезапускается. Громкость 0 — тишина. */
export function playTheme(id: ThemeId): void {
  if (theme === id && master) return;
  stopMusic();
  if (!(useSettings.getState().musicVolume > 0)) return;
  const c = audioContext();
  theme = id;
  announceSound({ music: id });
  if (!c) return;
  master = c.createGain();
  master.gain.value = 0;
  master.connect(c.destination);
  const loop = tracks[id];
  if (!loop) {
    playSynth(id);
    return;
  }
  const out = master;
  void loadTrack(c, id).then((buffer) => {
    if (master !== out) return;
    if (!buffer) {
      playSynth(id);
      return;
    }
    // Вступление звучит один раз, дальше кольцо; переход в начало кольца вклеен в запись (scripts/build-music.py).
    const src = c.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.loopStart = loop.loopStart;
    src.loopEnd = Math.min(loop.loopEnd, buffer.duration);
    src.connect(out);
    gain = TRACK_GAIN;
    applyLevel();
    src.start();
    source = src;
    announceSound({ track: id });
  });
}

/** Тема нотами из `THEMES`: у темы нет записи, нет сети при первом запуске или браузер не читает Opus. */
function playSynth(id: ThemeId) {
  const th = THEMES[id];
  secPerEighth = 30 / th.bpm;
  gain = MUSIC_GAIN;
  applyLevel();
  voices = [
    { events: parseNotes(th.lead), wave: th.leadWave, vol: 0.5, index: 0, next: 0 },
    { events: parseNotes(th.bass), wave: th.bassWave, vol: 0.8, index: 0, next: 0 },
  ];
  timer = setInterval(schedule, TICK_MS);
  schedule();
}

export function stopMusic(): void {
  if (timer) clearInterval(timer);
  timer = null;
  const c = audioContext();
  if (master && c) {
    const m = master;
    const src = source;
    m.gain.setTargetAtTime(0, c.currentTime, 0.1);
    setTimeout(() => {
      src?.stop();
      m.disconnect();
    }, 600);
  }
  master = null;
  source = null;
  voices = [];
  if (theme) announceSound({ music: null });
  theme = null;
}

/** Сейчас играет. */
export const currentTheme = () => theme;

/**
 * Следить за речью, громкостью и видимостью: житель говорит — музыка затихает, громкость 0 — останавливается,
 * приложение свернули — пауза. Возвращает отписку.
 */
export function watchMusic(): () => void {
  const offSpeak = onSpeaking((on) => {
    speaking = on;
    applyLevel();
  });
  const offSettings = useSettings.subscribe((s, prev) => {
    if (s.musicVolume === prev.musicVolume) return;
    if (!(s.musicVolume > 0)) stopMusic();
    else applyLevel();
  });
  const onVisible = () => {
    const c = audioContext();
    if (!c) return;
    if (document.hidden) void c.suspend().catch(() => {});
    else void c.resume().catch(() => {});
  };
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    offSpeak();
    offSettings();
    document.removeEventListener('visibilitychange', onVisible);
  };
}
