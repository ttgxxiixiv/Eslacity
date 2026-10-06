import { plural } from './medals';

/**
 * Напоминания (задача 10.4). Игрок выбирает время; если к этому времени цель дня не выполнена, приходит
 * уведомление от Летописца. Расписание считается здесь: ближайшие дни в выбранное время, сегодня — только если
 * время ещё впереди и цель не выполнена. В приложении для Android эти моменты ставит плагин уведомлений,
 * на сайте их читает service worker (`public/reminder-sw.js`) по фоновой проверке.
 */

/** На сколько дней вперёд ставятся напоминания: пока игрок не открыл приложение, они всё равно придут. */
export const REMINDER_DAYS = 7;

export const DEFAULT_REMINDER_TIME = '19:00';

/** «19:30» → минуты от полуночи; неверная строка — время по умолчанию. */
export function parseTime(s: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  const ok = m && +m[1] < 24 && +m[2] < 60;
  return ok ? +m[1] * 60 + +m[2] : parseTime(DEFAULT_REMINDER_TIME);
}

/** Моменты напоминаний по местному времени, по возрастанию. `doneToday` — цель дня уже выполнена. */
export function reminderSlots(now: number, time: string, doneToday: boolean, days = REMINDER_DAYS): number[] {
  const min = parseTime(time);
  const out: number[] = [];
  const base = new Date(now);
  for (let d = 0; d < days + 1 && out.length < days; d++) {
    const t = new Date(base.getFullYear(), base.getMonth(), base.getDate() + d, Math.floor(min / 60), min % 60).getTime();
    if (t <= now) continue;
    if (d === 0 && doneToday) continue;
    out.push(t);
  }
  return out;
}

/** Текст напоминания от Летописца: огонёк стрика и карточки, которые пора повторить. Без рода героя. */
export function reminderText(who: string, streak: number, due: number): { title: string; body: string } {
  const fire = streak > 0 ? `Огонёк горит ${streak} ${plural(streak, ['день', 'дня', 'дней'])}, не дай ему погаснуть.` : 'Путь к Хранилищу ждёт.';
  const cards = due > 0 ? ` Пора повторить: ${due} ${plural(due, ['карточка', 'карточки', 'карточек'])}.` : '';
  return { title: `${who}: дневной переход`, body: fire + cards };
}
