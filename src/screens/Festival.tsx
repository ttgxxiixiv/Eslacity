import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { speakAs } from '../audio/tts';
import { loadFestival } from '../content/festivals';
import { npcFor } from '../content/npcs';
import type { FestivalFile } from '../content/schema';
import { FESTIVAL_CHAPTER, festivalMissionId, festivalPlace, festivalsDone, isFestivalOn, nextFestivalWeek } from '../domain/festival';
import { lessonParts, levelWords } from '../domain/levels';
import { plural } from '../domain/medals';
import { LANG } from '../lang';
import { useNow } from '../lib/useNow';
import { FESTIVALS } from '../domain/festival';
import { festivalDates } from '../components/FestivalBits';
import { NpcPortrait } from '../components/NpcPortrait';
import { Loading, Screen, TopBar } from '../components/ui';
import { useMissions } from '../store/missions';
import { useProgress } from '../store/progress';
import { heroText } from '../store/settings';

const DAY = 86_400_000;

/**
 * Праздник (задача 10.5): в его неделю хозяин зовёт героя — слова праздника, фразы и миссия. Слова становятся
 * обычными карточками и повторяются после праздника. Миссия, пройденная в эту неделю, даёт тайную медаль.
 * Вне недели страница рассказывает о празднике и говорит, когда он будет.
 */
export function FestivalScreen() {
  const id = useParams().id ?? '';
  const f = FESTIVALS.find((x) => x.id === id && x.lang === LANG);
  const [data, setData] = useState<FestivalFile | null | undefined>(undefined);
  const now = useNow();
  const cards = useProgress((s) => s.cards);
  const records = useMissions((s) => s.records);

  useEffect(() => {
    if (f) loadFestival(f.id).then((d) => setData(d ?? null));
    else setData(null);
  }, [f]);

  if (data === undefined) return <Loading />;
  if (!f || !data) {
    return (
      <Screen>
        <TopBar title="Праздник" />
        <p className="px-5 py-6 text-stone-600">Такого праздника в этом городе нет.</p>
      </Screen>
    );
  }

  const place = festivalPlace(f.id);
  const host = npcFor(place);
  const on = isFestivalOn(f.id, now);
  const week = nextFestivalWeek(f.id, now);
  const daysLeft = Math.max(1, Math.ceil((week.end.getTime() + DAY - now) / DAY));
  const parts = lessonParts(levelWords(data.words, 1));
  const phrasesLevel = Math.min(...data.phrases.map((p) => p.level));
  const phrasesDone = data.phrases.every((p) => cards[p.id]);
  const missionId = festivalMissionId(f.id);
  const mission = records[missionId];
  const medal = festivalsDone(records).includes(f.id);
  const intro = heroText(data.intro);

  return (
    <Screen>
      <TopBar title={f.title} />
      <div className="flex flex-col gap-3 px-5 pb-6">
        <section className="rounded-2xl bg-white p-4 shadow-sm" data-testid="festival-intro">
          <div className="flex items-center gap-3">
            <span className="text-5xl" aria-hidden>
              {f.icon}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-lg font-bold" lang={LANG}>
                {f.native}
              </div>
              <div className="text-sm text-stone-500">{f.town}</div>
            </div>
          </div>
          <p className="mt-3 leading-relaxed text-stone-700">{data.about}</p>
          <p className="mt-2 text-sm font-semibold text-amber-700" data-testid="festival-when">
            {on ? `Праздник идёт: ещё ${daysLeft} ${plural(daysLeft, ['день', 'дня', 'дней'])}` : `Неделя праздника: ${festivalDates(f, now)}`}
          </p>
        </section>

        {host && (
          <section className="flex items-end gap-3 rounded-2xl bg-white p-4 shadow-sm">
            <NpcPortrait look={host.look} size={72} label={host.name} />
            <div className="min-w-0 flex-1 rounded-xl bg-orange-50 px-3 py-2">
              <div className="font-semibold" lang={LANG}>
                {intro.es}
              </div>
              <div className="text-sm text-stone-600">{intro.ru}</div>
            </div>
            <button
              type="button"
              aria-label="Озвучить"
              onClick={() => speakAs(intro.es, host)}
              className="press inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100 text-lg text-brand shadow-sm"
            >
              🔊
            </button>
          </section>
        )}

        {on ? (
          <section className="rounded-2xl bg-white p-4 shadow-sm" data-testid="festival-steps">
            <h2 className="font-bold">Неделя праздника</h2>
            <ol className="mt-3 flex flex-col gap-2">
              {parts.map((words, i) => {
                const learned = words.every((w) => cards[w.id]);
                return (
                  <li key={i}>
                    <Link to={`/learn/${place}/1/${i}`} className="press flex items-center justify-between gap-2 rounded-xl border-2 border-stone-200 px-3 py-2.5" data-testid={`festival-words-${i}`}>
                      <span>
                        <span className="font-semibold">Слова праздника{parts.length > 1 ? `, часть ${i + 1}` : ''}</span>
                        <span className="block text-sm text-stone-500">
                          {words.length} {plural(words.length, ['слово', 'слова', 'слов'])}
                        </span>
                      </span>
                      <span className="text-sm font-semibold text-amber-700">{learned ? '✓' : 'учить'}</span>
                    </Link>
                  </li>
                );
              })}
              <li>
                <Link to={`/phrases/${place}/${phrasesLevel}`} className="press flex items-center justify-between gap-2 rounded-xl border-2 border-stone-200 px-3 py-2.5" data-testid="festival-phrases">
                  <span>
                    <span className="font-semibold">Как говорят на празднике</span>
                    <span className="block text-sm text-stone-500">
                      {data.phrases.length} {plural(data.phrases.length, ['фраза', 'фразы', 'фраз'])}
                    </span>
                  </span>
                  <span className="text-sm font-semibold text-amber-700">{phrasesDone ? '✓' : 'учить'}</span>
                </Link>
              </li>
              <li>
                <Link to={`/mission/${encodeURIComponent(missionId)}`} className="press flex items-center justify-between gap-2 rounded-xl border-2 border-gold bg-amber-50 px-3 py-2.5" data-testid="festival-mission">
                  <span>
                    <span className="font-semibold">Миссия: {host?.name ?? f.title}</span>
                    <span className="block text-sm text-stone-500">Сложность главы {['I', 'II', 'III', 'IV', 'V'][FESTIVAL_CHAPTER - 1]}</span>
                  </span>
                  <span className="text-sm font-semibold text-amber-700">{mission?.done ? '✓ выполнена' : 'новая'}</span>
                </Link>
              </li>
            </ol>
            <p className="mt-3 text-sm text-stone-500" data-testid="festival-medal">
              {medal ? `Тайная медаль «${f.medal.title}» получена.` : 'Миссия в неделю праздника принесёт тайную медаль.'}
            </p>
          </section>
        ) : (
          <p className="rounded-2xl bg-orange-50 px-4 py-3 text-stone-700" data-testid="festival-closed">
            {medal ? `Тайная медаль «${f.medal.title}» уже у вас. ` : ''}
            Слова, фразы и миссия откроются в неделю праздника. Выученные слова праздника повторяются вместе с остальными.
          </p>
        )}
      </div>
    </Screen>
  );
}
