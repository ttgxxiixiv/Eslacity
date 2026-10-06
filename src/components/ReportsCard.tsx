import { useEffect, useState } from 'react';
import { clearReports, reportsCount, reportsText } from '../db/reports';
import { plural } from '../domain/medals';

/**
 * Отчёты об ошибках в настройках (задача 11.1): сколько сохранено, «Скопировать отчёты» одним текстом, чтобы
 * прислать, и «Очистить» после отправки. Если буфер обмена недоступен, текст виден целиком для ручного копирования.
 */
export function ReportsCard() {
  const [count, setCount] = useState<number | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    reportsCount().then(setCount);
  }, []);

  const copy = async () => {
    const t = await reportsText();
    setText(t);
    try {
      await navigator.clipboard.writeText(t);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="rounded-3xl bg-white p-4 shadow-sm" data-testid="reports">
      <h2 className="font-bold">Отчёты об ошибках</h2>
      <p className="mt-1 text-sm text-stone-500">
        Кнопка «⚑ Ошибка в задании?» есть после ответа, в разговорах и миссиях. Отчёты хранятся здесь: скопируйте их и пришлите автору.
      </p>
      <p className="mt-2 font-semibold tabular-nums" data-testid="reports-count">
        {count === null ? '…' : count ? `Сохранено: ${count} ${plural(count, ['отчёт', 'отчёта', 'отчётов'])}` : 'Отчётов пока нет'}
      </p>
      {!!count && (
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={copy} className="press flex-1 rounded-xl border-2 border-stone-300 bg-white py-2.5 font-semibold" data-testid="reports-copy">
            {copied ? 'Скопировано' : 'Скопировать отчёты'}
          </button>
          <button
            type="button"
            onClick={async () => {
              if (!confirm('Удалить все отчёты? Сначала скопируйте их, если ещё не отправили.')) return;
              await clearReports();
              setCount(0);
              setText(null);
              setCopied(false);
            }}
            className="press rounded-xl border-2 border-stone-300 bg-white px-4 py-2.5 font-semibold text-stone-600"
            data-testid="reports-clear"
          >
            Очистить
          </button>
        </div>
      )}
      {text && !copied && (
        <textarea readOnly value={text} rows={6} className="mt-3 w-full rounded-xl border-2 border-stone-200 bg-stone-50 p-2 text-xs" data-testid="reports-text" onFocus={(e) => e.target.select()} />
      )}
    </section>
  );
}
