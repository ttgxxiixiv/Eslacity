import { Component, type ErrorInfo, type ReactNode } from 'react';
import { CURRENT } from '../lib/update';

interface State {
  error: Error | null;
  /** Где упало: верх стека вызовов и компонентов. По нему ошибку из сборки находят в исходниках (карта исходников). */
  details: string;
}

/** Первые строки стека без пустых и без адреса сайта: короче на экране телефона. */
export function errorDetails(error: Error, componentStack?: string | null, lines = 6): string {
  const clean = (s: string | undefined | null) =>
    (s ?? '')
      .split('\n')
      .map((l) => l.trim().replace(/https?:\/\/[^\s)]*\/assets\//g, ''))
      .filter(Boolean);
  const stack = clean(error.stack).filter((l) => l !== `${error.name}: ${error.message}` && l !== error.message);
  return [...stack.slice(0, lines), '—', ...clean(componentStack).slice(0, 4)].join('\n');
}

/** Ошибка в одном экране не должна оставлять белый экран: показываем выход в город. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, details: '' };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error);
    this.setState({ details: errorDetails(error, info.componentStack) });
  }

  render() {
    const { error, details } = this.state;
    if (!error) return this.props.children;
    const report = `Eslacity ${CURRENT.version} · ${location.hash || '#/'}\n${error.message}\n${details}`;
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-8 text-center">
        <div className="text-5xl">🚧</div>
        <p className="text-lg font-semibold">Что-то пошло не так</p>
        <p className="text-sm text-stone-500">Прогресс сохранён. Вернитесь в город и попробуйте ещё раз.</p>
        <p className="text-xs break-all text-stone-500" data-testid="error-message">{error.message}</p>
        {/* Подробности для разработчика: где именно упало. Их можно скопировать и прислать. */}
        <pre className="max-h-40 w-full overflow-auto rounded-lg bg-stone-100 p-2 text-left text-xs leading-tight whitespace-pre-wrap break-all text-stone-500" data-testid="error-details">
          {report}
        </pre>
        <button
          type="button"
          className="press rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-semibold"
          onClick={() => navigator.clipboard?.writeText(report).catch(() => {})}
        >
          Скопировать подробности
        </button>
        <button
          type="button"
          className="press rounded-2xl bg-brand px-6 py-3 font-semibold text-white"
          onClick={() => {
            location.hash = '#/';
            location.reload();
          }}
        >
          В город
        </button>
      </div>
    );
  }
}
