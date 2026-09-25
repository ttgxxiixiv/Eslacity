import { useUpdate } from '../lib/update';

/** Плашка над нижним меню, когда на сайте есть новая версия. */
export function UpdateBanner() {
  const status = useUpdate((s) => s.status);
  const remote = useUpdate((s) => s.remote);
  const apply = useUpdate((s) => s.apply);
  if (status !== 'available' && status !== 'updating') return null;
  return (
    <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 mx-auto max-w-md px-3 pb-2">
      <div className="flex items-center gap-3 rounded-2xl bg-stone-900 px-4 py-3 text-white shadow-lg">
        <div className="flex-1 text-sm">
          {status === 'updating' ? 'Обновляю…' : `Доступно обновление${remote ? ` ${remote.version}` : ''}`}
        </div>
        <button
          type="button"
          disabled={status === 'updating'}
          onClick={() => apply()}
          className="press rounded-xl bg-brand px-3 py-1.5 text-sm font-semibold disabled:opacity-60"
        >
          Обновить
        </button>
      </div>
    </div>
  );
}
