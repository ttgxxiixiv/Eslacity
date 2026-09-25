import { Component, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

/** Ошибка в одном экране не должна оставлять белый экран: показываем выход в город. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-8 text-center">
        <div className="text-5xl">🚧</div>
        <p className="text-lg font-semibold">Что-то пошло не так</p>
        <p className="text-sm text-stone-500">Прогресс сохранён. Вернитесь в город и попробуйте ещё раз.</p>
        <p className="text-xs break-all text-stone-400">{this.state.error.message}</p>
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
