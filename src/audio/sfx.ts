import { SFX, type SfxKind } from '../domain/chiptune';
import { useSettings } from '../store/settings';
import { announceSound, audioContext } from './context';

/** Громкость звуков при громкости настроек 1: синтез квадратной волной громкий сам по себе. */
const SFX_GAIN = 0.25;

/** Сыграть звук (задача 13.3): синтез из тонов `SFX`, без файлов. Громкость 0 в настройках — тишина. */
export function playSfx(kind: SfxKind): void {
  const volume = useSettings.getState().sfxVolume;
  if (!(volume > 0)) return;
  announceSound({ sfx: kind });
  const c = audioContext();
  if (!c || c.state !== 'running') return;
  const now = c.currentTime + 0.01;
  for (const tone of SFX[kind]) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = tone.wave;
    osc.frequency.setValueAtTime(tone.freq, now + tone.at);
    if (tone.to) osc.frequency.exponentialRampToValueAtTime(tone.to, now + tone.at + tone.dur);
    const peak = tone.vol * volume * SFX_GAIN;
    gain.gain.setValueAtTime(0, now + tone.at);
    gain.gain.linearRampToValueAtTime(peak, now + tone.at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.at + tone.dur);
    osc.connect(gain).connect(c.destination);
    osc.start(now + tone.at);
    osc.stop(now + tone.at + tone.dur + 0.02);
  }
}
