import { useEffect, useRef, useState } from 'react';
import { listenAnswer, voiceInputSupported, type Listening } from '../audio/speechInput';

/**
 * Кнопка «Голосом» у поля ответа в миссиях и испытаниях (задача 10.3). Варианты услышанного уходят в `onText`,
 * экран кладёт лучший в поле. Без сети, без распознавания в браузере и после запрета микрофона кнопки нет.
 */
export function VoiceAnswer({ onText, disabled }: { onText(alts: string[]): void; disabled?: boolean }) {
  const [, setOnline] = useState(0);
  const [state, setState] = useState<'idle' | 'listening' | 'missed'>('idle');
  const cur = useRef<Listening | null>(null);

  useEffect(() => {
    const bump = () => setOnline((n) => n + 1);
    window.addEventListener('online', bump);
    window.addEventListener('offline', bump);
    return () => {
      window.removeEventListener('online', bump);
      window.removeEventListener('offline', bump);
      cur.current?.stop();
    };
  }, []);

  if (!voiceInputSupported() && state !== 'listening') return null;

  const start = () => {
    if (state === 'listening') {
      cur.current?.stop();
      return;
    }
    const l = listenAnswer();
    cur.current = l;
    setState('listening');
    l.result
      .then((alts) => {
        if (cur.current !== l) return;
        setState(alts.length ? 'idle' : 'missed');
        if (alts.length) onText(alts);
      })
      .catch(() => setState('idle'))
      .finally(() => {
        if (cur.current === l) cur.current = null;
      });
  };

  return (
    <div className="flex flex-col items-stretch">
      <button
        type="button"
        onClick={start}
        disabled={disabled}
        aria-label={state === 'listening' ? 'Закончить ответ голосом' : 'Ответить голосом'}
        aria-pressed={state === 'listening'}
        className={`press flex h-12 items-center justify-center gap-2 rounded-xl border-2 px-3 font-semibold disabled:opacity-50 ${
          state === 'listening' ? 'border-bad bg-badbg text-bad' : 'border-stone-300 bg-white'
        }`}
        data-testid="voice-answer"
      >
        {state === 'listening' ? (
          <>
            <span className="h-3 w-3 animate-pulse rounded-full bg-bad" /> Слушаю…
          </>
        ) : (
          '🎤 Голосом'
        )}
      </button>
      {state === 'missed' && (
        <p className="mt-1 text-center text-sm text-stone-500" data-testid="voice-missed">
          Не удалось разобрать. Скажите ещё раз или впишите ответ.
        </p>
      )}
    </div>
  );
}
