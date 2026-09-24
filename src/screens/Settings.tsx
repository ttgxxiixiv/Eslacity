import { useState } from 'react';
import { VARIANT, VARIANTS } from '../config';
import { currentVoice, speak, ttsSupported } from '../audio/tts';
import { resetProgress } from '../store/bootstrap';
import { downloadJson, exportBackup, importBackup, parseBackup } from '../db/backup';
import { useSettings, type Settings } from '../store/settings';
import { Button, Screen, TopBar } from '../components/ui';

const GOALS: Settings['dailyGoal'][] = [50, 100, 150, 250];

export function SettingsScreen() {
  const { speechRate, dailyGoal, update } = useSettings();
  const [voiceName, setVoiceName] = useState(() => currentVoice()?.name);

  return (
    <Screen>
      <TopBar title="Настройки" />
      <div className="flex flex-col gap-4 px-5 pb-6">
        <section className="rounded-3xl bg-white p-4 shadow-sm">
          <h2 className="font-bold">Дневная цель</h2>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {GOALS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => update({ dailyGoal: g })}
                className={`press rounded-xl border-2 py-2.5 font-semibold ${
                  dailyGoal === g ? 'border-brand bg-orange-50 text-brand' : 'border-stone-200'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
          <p className="mt-2 text-sm text-stone-500">XP в день</p>
        </section>

        <section className="rounded-3xl bg-white p-4 shadow-sm">
          <h2 className="font-bold">Озвучка</h2>
          {!ttsSupported() ? (
            <p className="mt-2 text-sm text-bad">Браузер не поддерживает синтез речи.</p>
          ) : (
            <>
              <label className="mt-3 block text-sm text-stone-600">
                Скорость: {speechRate.toFixed(1)}
                <input
                  type="range"
                  min={0.5}
                  max={1.2}
                  step={0.1}
                  value={speechRate}
                  onChange={(e) => update({ speechRate: Number(e.target.value) })}
                  className="mt-1 w-full accent-[var(--color-brand)]"
                />
              </label>
              <Button
                variant="secondary"
                className="mt-2 w-full"
                onClick={() => {
                  speak('¡Hola! ¿Qué tal? Un café con leche, por favor.');
                  setVoiceName(currentVoice()?.name);
                }}
              >
                🔊 Проверить голос
              </Button>
              <p className="mt-2 text-sm text-stone-500">
                Голос: {voiceName ?? 'системный по умолчанию'} · вариант: {VARIANTS[VARIANT].label}
              </p>
            </>
          )}
        </section>

        <section className="rounded-3xl bg-white p-4 shadow-sm">
          <h2 className="font-bold">Прогресс</h2>
          <p className="mt-1 text-sm text-stone-500">
            Хранится только на этом устройстве. Сохраните файл, чтобы перенести прогресс на другой телефон.
          </p>
          <Button
            variant="secondary"
            className="mt-3 w-full"
            onClick={async () => downloadJson(await exportBackup(), `eslacity-${new Date().toISOString().slice(0, 10)}.json`)}
          >
            Сохранить в файл
          </Button>
          <label className="press mt-2 block w-full cursor-pointer rounded-2xl border border-stone-300 bg-white px-5 py-3.5 text-center font-semibold">
            Загрузить из файла
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                try {
                  const b = parseBackup(await file.text());
                  if (!confirm(`Заменить текущий прогресс копией от ${b.exportedAt.slice(0, 10)}?`)) return;
                  await importBackup(b);
                  location.reload();
                } catch (err) {
                  alert((err as Error).message);
                }
              }}
            />
          </label>
          <Button
            variant="secondary"
            className="mt-3 w-full !text-bad"
            onClick={() => {
              if (confirm('Удалить весь прогресс? Это нельзя отменить.')) resetProgress();
            }}
          >
            Сбросить прогресс
          </Button>
        </section>
      </div>
    </Screen>
  );
}
