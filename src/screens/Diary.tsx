import { useMemo, useState } from 'react';
import { speak } from '../audio/tts';
import { DIARY } from '../content/diary';
import { LOCATION_BY_ID } from '../content/locations';
import type { DiaryEntry, LocationId } from '../content/schema';
import { CHAPTERS } from '../domain/chapters';
import { DIARY_TOPIC_ORDER, DIARY_TOPICS, diaryProgress, entryOpen, percent, sourceKind, type DiarySources } from '../domain/diary';
import { Screen, TopBar } from '../components/ui';
import { useDiary } from '../store/diary';
import { useJourney } from '../store/journey';
import { useMissions } from '../store/missions';
import { useRumors } from '../store/rumors';
import { useThread } from '../store/thread';

/** Источники записей дневника, с подпиской на все четыре хранилища. */
export function useDiarySources(): DiarySources {
  const scenes = useDiary((s) => s.rec.scenes);
  const missions = useMissions((s) => s.records);
  const seen = useThread((s) => s.rec.seen);
  const got = useRumors((s) => s.rec.got);
  return useMemo(
    () => ({
      scenes: new Set(scenes),
      missions: new Set(Object.entries(missions).flatMap(([id, r]) => (r.done !== undefined ? [id] : []))),
      thread: new Set(Object.keys(seen)),
      rumors: new Set(got),
    }),
    [scenes, missions, seen, got],
  );
}

/** Записи открытых глав: сколько собрано из скольких. */
export function useDiaryTotal(): { open: number; total: number } {
  const sources = useDiarySources();
  const opened = useJourney((s) => s.opened);
  return useMemo(() => {
    const rows = diaryProgress(DIARY, sources).filter((c) => c.chapter <= opened);
    return { open: rows.reduce((n, c) => n + c.open, 0), total: rows.reduce((n, c) => n + c.total, 0) };
  }, [sources, opened]);
}

/** Где искать закрытую запись: разговор места, Летопись или слухи. */
function whereToFind(e: DiaryEntry): string {
  const kind = sourceKind(e.from);
  if (kind === 'thread') return 'Летопись: сцена Летописца этой главы';
  if (kind === 'rumor') return 'Слухи города: событие дня';
  const place = LOCATION_BY_ID[e.from.replace(/^sc:/, '').split('.')[0] as LocationId];
  return place ? `Разговор: ${place.emoji} ${place.ru}` : 'Разговор с жителем';
}

/**
 * Дневник путника (задача 13.8): факты истории по главам и темам, у каждого — цитата на изучаемом языке. Закрытые
 * записи подсказывают, где их найти. Полный дневник главы — тайная медаль «Страница летописи».
 */
export function DiaryScreen() {
  const opened = useJourney((s) => s.opened);
  const sources = useDiarySources();
  const [chapter, setChapter] = useState(opened);
  const progress = useMemo(() => diaryProgress(DIARY, sources), [sources]);
  const page = progress.find((c) => c.chapter === chapter);
  const info = CHAPTERS.find((c) => c.id === chapter);
  const entries = DIARY.filter((e) => e.chapter === chapter);

  return (
    <Screen>
      <TopBar title="Дневник путника" />
      <div className="flex flex-col gap-3 px-4 pb-8">
        <div className="flex gap-1.5" role="tablist">
          {CHAPTERS.map((c) => {
            const shut = c.id > opened;
            return (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={c.id === chapter}
                disabled={shut}
                onClick={() => setChapter(c.id)}
                className={`press min-h-10 flex-1 rounded-xl border-2 font-pixel ${c.id === chapter ? 'border-wood bg-wood text-white' : 'border-stone-300 bg-white'} ${shut ? 'opacity-40' : ''}`}
                data-testid="diary-tab"
              >
                {shut ? '🔒' : c.roman}
              </button>
            );
          })}
        </div>

        {info && page && (
          <div className="rounded-2xl bg-white p-3 shadow-sm" data-testid="diary-progress">
            <div className="font-bold">
              Глава {info.roman}. {info.land}
            </div>
            <div className="text-sm text-stone-500 tabular-nums">
              Записано {page.open} из {page.total} · {percent(page.open, page.total)}%
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded bg-stone-200">
              <div className="h-full bg-gold" style={{ width: `${percent(page.open, page.total)}%` }} />
            </div>
            {page.open === page.total && <p className="mt-2 text-sm font-semibold text-amber-700">Страница главы заполнена.</p>}
          </div>
        )}

        {DIARY_TOPIC_ORDER.map((topic) => {
          const own = entries.filter((e) => e.topic === topic);
          if (!own.length) return null;
          return (
            <section key={topic} className="flex flex-col gap-2">
              <h2 className="mt-1 font-bold">{DIARY_TOPICS[topic]}</h2>
              {own.map((e) => (
                <DiaryNote key={e.id} entry={e} open={entryOpen(e, sources)} />
              ))}
            </section>
          );
        })}

        <p className="text-sm text-stone-500">
          Записи появляются сами: когда вы дослушиваете разговор жителя, читаете сцену Летописца или узнаёте слух. Полный дневник главы — тайная
          медаль.
        </p>
      </div>
    </Screen>
  );
}

function DiaryNote({ entry, open }: { entry: DiaryEntry; open: boolean }) {
  if (!open) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-stone-300 p-3 text-stone-500" data-testid="diary-entry" data-id={entry.id} data-open="false">
        <div className="font-semibold">Ещё не записано</div>
        <div className="text-sm">{whereToFind(entry)}</div>
      </div>
    );
  }
  return (
    <div className="rounded-2xl bg-[#fbf3df] p-3 shadow-sm" data-testid="diary-entry" data-id={entry.id} data-open="true">
      <p className="leading-snug">{entry.ru}</p>
      <div className="mt-2 flex items-start gap-2 border-l-4 border-gold pl-2">
        <p className="flex-1 text-stone-700 italic" data-testid="diary-quote">
          {entry.es}
        </p>
        <button type="button" aria-label="Озвучить цитату" className="press h-8 w-8 shrink-0 rounded-full bg-orange-100" onClick={() => speak(entry.es)}>
          🔊
        </button>
      </div>
    </div>
  );
}
