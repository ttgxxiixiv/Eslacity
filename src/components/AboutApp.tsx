import { CHANGELOG } from '../content/changelog';
import { CURRENT, useUpdate } from '../lib/update';
import { Button } from './ui';

export function formatBuildDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const STATUS_TEXT = {
  idle: '',
  checking: 'Проверяю…',
  latest: 'У вас последняя версия.',
  offline: 'Нет сети, проверить не получилось.',
  error: 'Не удалось проверить, попробуйте позже.',
  failed: 'Не удалось скачать обновление. Проверьте сеть и попробуйте ещё раз.',
  available: '',
  updating: 'Обновляю…',
} as const;

export function AboutApp() {
  const { status, remote, check, apply } = useUpdate();
  const latest = CHANGELOG[0];

  return (
    <section className="rounded-3xl bg-white p-4 shadow-sm">
      <h2 className="font-bold">О приложении</h2>
      <div className="mt-2 text-sm">
        Версия <span className="font-semibold">{CURRENT.version}</span>
        <span className="text-stone-500">
          {' '}· сборка {CURRENT.commit} от {formatBuildDate(CURRENT.builtAt)}
        </span>
      </div>

      {latest?.version === CURRENT.version && (
        <div className="mt-3 rounded-2xl bg-stone-50 px-3 py-2 text-sm">
          <div className="font-semibold">Что нового в {latest.version}</div>
          <ul className="mt-1 list-disc pl-5 text-stone-600">
            {latest.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      )}

      {status === 'available' ? (
        <div className="mt-3 rounded-2xl bg-orange-50 px-3 py-2 text-sm">
          Доступна версия <span className="font-semibold">{remote?.version ?? 'новее'}</span>
          {remote && <span className="text-stone-500"> от {formatBuildDate(remote.builtAt)}</span>}
          <Button className="mt-2 w-full" onClick={() => apply()}>
            Обновить
          </Button>
        </div>
      ) : (
        <>
          <Button
            variant="secondary"
            className="mt-3 w-full"
            disabled={status === 'checking' || status === 'updating'}
            onClick={() => check()}
          >
            Проверить обновления
          </Button>
          {STATUS_TEXT[status] && <p className="mt-2 text-sm text-stone-500">{STATUS_TEXT[status]}</p>}
        </>
      )}

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-stone-500">История изменений</summary>
        <ul className="mt-2 flex flex-col gap-2">
          {CHANGELOG.map((r) => (
            <li key={r.version}>
              <div className="font-semibold">
                {r.version} <span className="font-normal text-stone-400">· {r.date.split('-').reverse().join('.')}</span>
              </div>
              <ul className="list-disc pl-5 text-stone-600">
                {r.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
