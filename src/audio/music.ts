import { parseNotes, THEMES, type NoteEvent, type ThemeId, type Wave } from '../domain/chiptune';
import { useSettings } from '../store/settings';
import { announceSound, audioContext } from './context';
import { onSpeaking } from './tts';

/** Громкость музыки при громкости настроек 1 и доля, до которой она затихает, пока говорит житель. */
const MUSIC_GAIN = 0.12;
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

function level(): number {
  const v = useSettings.getState().musicVolume;
  return v > 0 ? v * MUSIC_GAIN * (speaking ? DUCK : 1) : 0;
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
  if (theme === id && timer) return;
  stopMusic();
  if (!(useSettings.getState().musicVolume > 0)) return;
  const c = audioContext();
  theme = id;
  announceSound({ music: id });
  if (!c) return;
  const th = THEMES[id];
  secPerEighth = 30 / th.bpm;
  master = c.createGain();
  master.gain.value = 0;
  master.connect(c.destination);
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
    m.gain.setTargetAtTime(0, c.currentTime, 0.1);
    setTimeout(() => m.disconnect(), 600);
  }
  master = null;
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
