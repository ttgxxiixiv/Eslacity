import { describe, expect, it } from 'vitest';
import { parseTime, reminderSlots, reminderText, REMINDER_DAYS } from './reminder';

const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).getTime();

describe('напоминания', () => {
  it('время разбирается, неверное — по умолчанию', () => {
    expect(parseTime('7:05')).toBe(425);
    expect(parseTime('23:59')).toBe(1439);
    expect(parseTime('25:00')).toBe(19 * 60);
    expect(parseTime('abc')).toBe(19 * 60);
  });

  it('сегодня — если время впереди и цель не выполнена, дальше по дню', () => {
    const s = reminderSlots(at(6, 10), '19:30', false);
    expect(s).toHaveLength(REMINDER_DAYS);
    expect(s[0]).toBe(at(6, 19, 30));
    expect(s[1]).toBe(at(7, 19, 30));
    expect(s.at(-1)).toBe(at(12, 19, 30));
  });

  it('цель выполнена или время прошло — начиная с завтра', () => {
    expect(reminderSlots(at(6, 10), '19:30', true)[0]).toBe(at(7, 19, 30));
    const late = reminderSlots(at(6, 20), '19:30', false);
    expect(late[0]).toBe(at(7, 19, 30));
    expect(late).toHaveLength(REMINDER_DAYS);
  });

  it('текст: огонёк и карточки, склонения', () => {
    expect(reminderText('Летописец', 5, 12)).toEqual({ title: 'Летописец: дневной переход', body: 'Огонёк горит 5 дней, не дай ему погаснуть. Пора повторить: 12 карточек.' });
    expect(reminderText('Летописец', 0, 1).body).toBe('Путь к Хранилищу ждёт. Пора повторить: 1 карточка.');
    expect(reminderText('Летописец', 2, 0).body).toBe('Огонёк горит 2 дня, не дай ему погаснуть.');
  });
});
