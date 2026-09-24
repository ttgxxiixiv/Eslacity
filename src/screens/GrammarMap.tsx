import { Link } from 'react-router-dom';
import { DISTRICTS, lessonsOf } from '../content/grammar';
import { useProgress } from '../store/progress';
import { Screen, TopBar } from '../components/ui';

export function GrammarMap() {
  const done = useProgress((s) => s.grammar);

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
          const passed = lessons.filter((l) => done[l.id]).length;
          const nextId = lessons.find((l) => !done[l.id])?.id;
          return (
            <section key={d.id} className="rounded-3xl bg-white p-4 shadow-sm">
              <div className="flex items-baseline justify-between">
                <h2 className="text-lg font-bold">Район {d.title}</h2>
                <span className="text-sm text-stone-500">
                  {passed}/{lessons.length}
                </span>
              </div>
              <p className="text-sm text-stone-500">{d.subtitle}</p>
              <ol className="mt-3 flex flex-col gap-1.5">
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
            </section>
          );
        })}
      </div>
    </Screen>
  );
}
