import { Link } from 'react-router-dom';
import { npcFor } from '../content/npcs';
import { activeFestival, festivalPlace, festivalsDone, festivalsOf, isFestivalOn, nextFestivalWeek, type Festival } from '../domain/festival';
import { LANG } from '../lang';
import { useNow } from '../lib/useNow';
import { useMissions } from '../store/missions';

const fmt = (d: Date) => d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });

/** Даты недели праздника: «6–14 июля» или «11 — 17 февраля». */
export function festivalDates(f: Festival, now: number): string {
  const { start, end } = nextFestivalWeek(f.id, now);
  return `${fmt(start)} — ${fmt(end)}`;
}

/** Праздник, который идёт сейчас в городе (обновляется вместе с часами приложения). */
export function useActiveFestival(): Festival | undefined {
  const now = useNow();
  return activeFestival(LANG, now);
}

/** Приглашение на главной в неделю праздника. */
/** Приглашение на праздник для ряда кнопок главной (задача 14.1): знак, подпись, полный текст — для диктора. */
export function useFestivalInvite(): { to: string; icon: string; text: string } | null {
  const f = useActiveFestival();
  if (!f) return null;
  const host = npcFor(festivalPlace(f.id));
  return { to: `/festival/${f.id}`, icon: f.icon, text: `В городе праздник: ${f.title}. ${host ? `${host.name} зовёт на праздник` : 'Загляните на праздник'}` };
}

/** Флажки праздника над картой города: треугольники его цветов на верёвке. */
export function FestivalBunting({ f }: { f: Festival }) {
  const n = 18;
  return (
    <svg viewBox={`0 0 ${n * 10} 12`} preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 top-0 z-20 h-[3.5%] w-full" aria-hidden data-testid="festival-bunting">
      <path d={`M0 1 Q ${n * 5} 4 ${n * 10} 1`} stroke="#3b2a1a" strokeWidth="0.6" fill="none" />
      {Array.from({ length: n }, (_, i) => (
        <path key={i} d={`M${i * 10 + 1} 1.6 L${i * 10 + 9} 1.6 L${i * 10 + 5} 11 Z`} fill={f.colors[i % f.colors.length]} stroke="#3b2a1a" strokeWidth="0.4" />
      ))}
    </svg>
  );
}

/** Праздники года в профиле: даты, идёт ли сейчас, получена ли медаль. */
export function FestivalCalendar() {
  const now = useNow();
  const records = useMissions((s) => s.records);
  const done = festivalsDone(records);
  return (
    <section className="rounded-3xl bg-white p-4 shadow-sm" data-testid="festival-calendar">
      <h2 className="font-bold">Праздники</h2>
      <p className="mt-1 text-sm text-stone-500">Неделя праздника: слова, фразы и миссия хозяина. Миссия в эту неделю даёт тайную медаль.</p>
      <ul className="mt-3 flex flex-col gap-2">
        {festivalsOf(LANG).map((f) => {
          const on = isFestivalOn(f.id, now);
          return (
            <li key={f.id}>
              <Link to={`/festival/${f.id}`} className="press flex items-center gap-3 rounded-xl border-2 border-stone-200 px-3 py-2" data-testid={`festival-${f.id}`}>
                <span className="text-2xl" aria-hidden>
                  {f.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{f.title}</span>
                  <span className="block text-sm text-stone-500">{on ? 'идёт сейчас' : festivalDates(f, now)}</span>
                </span>
                {done.includes(f.id) && (
                  <span className="text-sm font-semibold text-amber-700" title="Тайная медаль получена">
                    ✓ медаль
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
