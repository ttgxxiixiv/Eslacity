import { playSfx } from '../audio/sfx';
import { useSettings } from '../store/settings';

/** Звуки и музыка в настройках (задача 13.3): громкость отдельно, ноль — выключено. */
export function SoundCard() {
  const sfx = useSettings((s) => s.sfxVolume);
  const music = useSettings((s) => s.musicVolume);
  const update = useSettings((s) => s.update);
  const row = (label: string, value: number, testId: string, set: (v: number) => void) => (
    <label className="mt-3 block text-sm text-stone-600">
      {label}: <span className="tabular-nums">{value > 0 ? `${Math.round(value * 100)}%` : 'выключено'}</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.1}
        value={value}
        onChange={(e) => set(Number(e.target.value))}
        className="mt-1 w-full accent-[var(--color-brand)]"
        data-testid={testId}
        aria-label={label}
      />
    </label>
  );
  return (
    <section className="rounded-3xl bg-white p-4 shadow-sm" data-testid="sound-card">
      <h2 className="font-bold">Звуки и музыка</h2>
      {row('Звуки', sfx, 'sfx-volume', (v) => {
        update({ sfxVolume: v });
        playSfx('correct');
      })}
      {row('Музыка', music, 'music-volume', (v) => update({ musicVolume: v }))}
      <p className="mt-2 text-sm text-stone-500">
        Звуки — за ответы, монеты, обрывки карты и новый уровень. У города и каждой земли своя мелодия; пока говорит житель, она затихает. Всё играет без сети.
      </p>
    </section>
  );
}
