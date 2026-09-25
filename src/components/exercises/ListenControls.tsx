import { useEffect } from 'react';
import { afterPaint } from '../../lib/afterPaint';
import { speak } from '../../audio/tts';
import { useSettings } from '../../store/settings';

/** Большая кнопка «прослушать» и «медленнее». Звук включается сам при появлении задания. */
export function ListenControls({ text }: { text: string }) {
  const rate = useSettings((s) => s.speechRate);
  useEffect(() => afterPaint(() => speak(text)), [text]);
  return (
    <div className="mt-6 flex items-center justify-center gap-4">
      <button
        type="button"
        aria-label="Прослушать ещё раз"
        onClick={() => speak(text)}
        className="press flex h-24 w-24 items-center justify-center rounded-full bg-brand text-4xl text-white shadow-md"
      >
        🔊
      </button>
      <button
        type="button"
        aria-label="Прослушать медленнее"
        onClick={() => speak(text, Math.min(rate, 0.6))}
        className="press flex h-14 w-14 items-center justify-center rounded-full bg-orange-100 text-2xl"
      >
        🐢
      </button>
    </div>
  );
}

export function CantListen({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="press mt-4 self-center py-2 text-sm text-stone-500 underline">
      Не могу сейчас слушать
    </button>
  );
}
