import { useEffect, useState } from 'react';
import { enableReminder, reminderStatus, reminderSupport, syncReminder, type ReminderStatus } from '../lib/reminder';
import { useSettings } from '../store/settings';

/** Что сказать игроку о напоминании: работает ли оно здесь и почему нет. */
const STATUS_TEXT: Record<ReminderStatus, string> = {
  on: '',
  off: '',
  'not-installed':
    'Напоминание сохранено, но этот браузер не проверяет его в фоне. Установите Eslacity на главный экран из Chrome на Android или поставьте приложение для Android: тогда оно придёт.',
  denied: 'Уведомления запрещены. Разрешите их для Eslacity в настройках браузера или телефона и включите напоминание снова.',
  unsupported:
    'В этом браузере напоминания не придут: в нём нет фоновой проверки (Periodic Background Sync). Она есть в Chrome на Android у установленного приложения, напоминания работают и в приложении для Android.',
};

/** Напоминание о дневной цели (задача 10.4): включить, выбрать время, узнать, работает ли оно здесь. */
export function ReminderCard() {
  const on = useSettings((s) => s.reminderOn);
  const time = useSettings((s) => s.reminderTime);
  const update = useSettings((s) => s.update);
  const [status, setStatus] = useState<ReminderStatus>('off');
  const support = reminderSupport();

  useEffect(() => {
    let alive = true;
    reminderStatus().then((s) => {
      if (alive) setStatus(s);
    });
    return () => {
      alive = false;
    };
  }, [on]);

  const toggle = async () => {
    if (on) {
      update({ reminderOn: false });
      setStatus('off');
      return;
    }
    update({ reminderOn: true });
    const s = await enableReminder();
    setStatus(s);
    void syncReminder();
  };

  const note = on ? STATUS_TEXT[status] : support === 'none' ? STATUS_TEXT.unsupported : '';
  return (
    <section className="rounded-3xl bg-white p-4 shadow-sm" data-testid="reminder">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-bold">Напоминание</h2>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Напоминание о дневной цели"
          onClick={toggle}
          className={`press relative h-8 w-14 shrink-0 rounded-full transition-colors ${on ? 'bg-brand' : 'bg-stone-300'}`}
          data-testid="reminder-toggle"
        >
          <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? 'left-7' : 'left-1'}`} />
        </button>
      </div>
      <p className="mt-1 text-sm text-stone-500">Если к этому времени цель дня не выполнена, Летописец напомнит о дневном переходе.</p>
      <label className="mt-3 flex items-center gap-3">
        <span className="text-sm text-stone-600">Время</span>
        <input
          type="time"
          value={time}
          disabled={!on}
          onChange={(e) => e.target.value && update({ reminderTime: e.target.value })}
          className="h-11 rounded-xl border-2 border-stone-300 bg-white px-3 text-lg tabular-nums disabled:opacity-50"
          data-testid="reminder-time"
        />
      </label>
      {on && status === 'on' && support === 'periodic' && (
        <p className="mt-2 text-sm text-stone-500" data-testid="reminder-note">
          Когда проверить, решает Chrome: напоминание может прийти немного позже выбранного времени.
        </p>
      )}
      {note && (
        <p className="mt-2 rounded-xl bg-orange-50 px-3 py-2 text-sm text-stone-700" data-testid="reminder-note">
          {note}
        </p>
      )}
    </section>
  );
}
