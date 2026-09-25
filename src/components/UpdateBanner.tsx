import { useUpdate } from '../lib/update';

/** Плашка над нижним меню, когда на сайте есть новая версия. */
export function UpdateBanner() {
  const status = useUpdate((s) => s.status);
  const remote = useUpdate((s) => s.remote);
  const apply = useUpdate((s) => s.apply);
  if (status !== 'available' && status !== 'updating' && status !== 'failed') return null;
  return (
    <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 mx-auto max-w-md px-3 pb-2">
      <div className="dialog-box flex items-center gap-3 rounded-xl px-4 py-3">
        <div className="flex-1 text-sm">
          {status === 'updating'
            ? 'Скачиваю обновление…'
            : status === 'failed'
              ? 'Не удалось скачать обновление'
              : `Доступно обновление${remote ? ` ${remote.version}` : ''}`}
        </div>
        <button
          type="button"
          disabled={status === 'updating'}
          onClick={() => apply()}
          className="press rounded-lg bg-gold px-3 py-1.5 font-pixel text-sm text-wood disabled:opacity-60"
        >
          {status === 'failed' ? 'Ещё раз' : 'Обновить'}
        </button>
      </div>
    </div>
  );
}
