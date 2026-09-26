import { useState } from 'react';
import { Link } from 'react-router-dom';
import { DISTRICTS, lessonsOf } from '../content/grammar';
import type { District } from '../content/schema';
import { useProgress } from '../store/progress';
import { useJourney } from '../store/journey';
import { chapterById, chapterOfDistrict, isDistrictOpen } from '../domain/chapters';
import { Screen, TopBar } from '../components/ui';

export function GrammarMap() {
  const done = useProgress((s) => s.grammar);
  const opened = useJourney((s) => s.opened);
  // По умолчанию раскрыт первый открытый район, где есть непройденные уроки.
  const current =
    DISTRICTS.find((d) => isDistrictOpen(d.id, opened) && lessonsOf(d.id).some((l) => !done[l.id]))?.id ?? 'A1';
  const [open, setOpen] = useState<Set<District>>(() => new Set([current]));

  const toggle = (id: District) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <Screen>
      <TopBar title="Грамматика" back={false} />
      <div className="flex flex-col gap-4 px-5 pb-6">
        {DISTRICTS.map((d) => {
          const lessons = lessonsOf(d.id);
          if (!lessons.length) {
            return (
              <section key={d.id} className="rounded-3xl border-2 border-dashed border-stone-300 p-4 text-stone-400">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-lg font-bold">Район {d.title}</h2>
                  <span className="text-sm">скоро</span>
                </div>
                <p className="text-sm">{d.subtitle}</p>
              </section>
            );
          }
          if (!isDistrictOpen(d.id, opened)) {
            const ch = chapterOfDistrict(d.id);
            return (
              <section key={d.id} className="rounded-3xl border-2 border-dashed border-stone-300 p-4 text-stone-500" data-testid="district-lock">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-lg font-bold">Район {d.title}</h2>
                  <span className="text-sm">🔒 глава {ch?.roman}</span>
                </div>
                <p className="text-sm">{d.subtitle}</p>
                <p className="mt-1 text-sm">
                  Откроется в главе {ch?.roman}, когда будет собрана карта главы {ch && chapterById(ch.id - 1)?.roman}.
                </p>
              </section>
            );
          }
          const passed = lessons.filter((l) => done[l.id]).length;
          const nextId = lessons.find((l) => !done[l.id])?.id;
          const isOpen = open.has(d.id);
          return (
            <section key={d.id} className="rounded-3xl bg-white shadow-sm">
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => toggle(d.id)}
                className="press flex w-full items-center gap-3 p-4 text-left"
              >
                <div className="flex-1">
                  <div className="flex items-baseline justify-between">
                    <h2 className="text-lg font-bold">Район {d.title}</h2>
                    <span className={`text-sm ${passed === lessons.length ? 'text-ok' : 'text-stone-500'}`}>
                      {passed}/{lessons.length}
                    </span>
                  </div>
                  <p className="text-sm text-stone-500">{d.subtitle}</p>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-sm bg-wood p-[2px]">
                    <div
                      className="h-full w-full origin-left rounded-sm bg-gold"
                      style={{ transform: `scaleX(${passed / lessons.length})` }}
                    />
                  </div>
                </div>
                <span className={`text-stone-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}>▾</span>
              </button>
              {isOpen && (
                <ol className="flex flex-col gap-1.5 px-4 pb-4">
                  {lessons.map((l) => {
                    const row = done[l.id];
                    const isNext = l.id === nextId;
                    return (
                      <li key={l.id}>
                        <Link
                          to={`/grammar/${l.id}`}
                          className={`press flex items-center gap-3 rounded-2xl px-3 py-2.5 ${
                            isNext ? 'bg-brand text-white' : row ? 'bg-okbg' : 'bg-stone-50'
                          }`}
                        >
                          <span className={`w-6 text-right text-sm tabular-nums ${isNext ? '' : 'text-stone-400'}`}>{l.order}</span>
                          <span className="flex-1 font-medium">{l.title}</span>
                          {row && <span className="text-sm text-ok">✓ {row.bestScore}%</span>}
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>
          );
        })}
      </div>
    </Screen>
  );
}
