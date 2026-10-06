import { useEffect, useRef, useState } from 'react';
import { microphoneBlocked, recordingSupported, startRecording, type Recording } from '../audio/recorder';
import { untilSpoken } from '../audio/tts';

/**
 * «Повторить за жителем» (задача 10.1): игрок записывает себя, потом слушает себя или жителя и себя подряд.
 * `say` — сказать реплику голосом жителя (или путника). Запись только в памяти и пропадает с репликой.
 * Без MediaRecorder или без доступа к микрофону кнопки нет.
 */
export function RepeatAfter({ say }: { say(): void }) {
  const [state, setState] = useState<'idle' | 'recording' | 'ready'>('idle');
  const [hidden, setHidden] = useState(() => !recordingSupported());
  const [url, setUrl] = useState<string | null>(null);
  const rec = useRef<Recording | null>(null);
  const audio = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    let alive = true;
    microphoneBlocked().then((b) => {
      if (alive && b) setHidden(true);
    });
    return () => {
      alive = false;
    };
  }, []);
  // Запись не переживает реплику: адрес отзывается, микрофон отпускается.
  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);
  useEffect(() => {
    return () => {
      rec.current?.stop().then((u) => URL.revokeObjectURL(u));
    };
  }, []);

  if (hidden) return null;

  const record = async () => {
    try {
      const r = await startRecording();
      rec.current = r;
      setState('recording');
      r.done.then((u) => {
        if (rec.current !== r) return URL.revokeObjectURL(u);
        rec.current = null;
        setUrl(u);
        setState('ready');
      });
    } catch {
      // Нет доступа к микрофону: кнопка исчезает, прохождение не страдает.
      setHidden(!recordingSupported());
      setState('idle');
    }
  };

  const playMine = () => {
    const a = audio.current;
    if (!a) return;
    a.currentTime = 0;
    a.play().catch(() => {});
  };

  const both = async () => {
    say();
    await untilSpoken();
    playMine();
  };

  return (
    <div className="flex flex-col gap-2 rounded-2xl border-2 border-dashed border-stone-300 bg-white/60 p-2" data-testid="repeat">
      {url && <audio ref={audio} src={url} preload="auto" data-testid="repeat-audio" className="hidden" />}
      {state === 'recording' ? (
        <button
          type="button"
          onClick={() => rec.current?.stop()}
          className="press flex min-h-11 items-center justify-center gap-2 rounded-xl bg-bad px-3 font-semibold text-white"
          data-testid="repeat-stop"
        >
          <span className="h-3 w-3 animate-pulse rounded-full bg-white" /> Запись… Стоп
        </button>
      ) : (
        <div className={`grid gap-2 ${state === 'ready' ? 'grid-cols-3' : 'grid-cols-1'}`}>
          <button
            type="button"
            onClick={record}
            className="press min-h-11 rounded-xl border-2 border-stone-300 bg-white px-2 text-sm font-semibold"
            data-testid="repeat-record"
          >
            🎙 {state === 'ready' ? 'Заново' : 'Повторить'}
          </button>
          {state === 'ready' && (
            <>
              <button type="button" onClick={playMine} className="press min-h-11 rounded-xl border-2 border-stone-300 bg-white px-2 text-sm font-semibold" data-testid="repeat-mine">
                ▶ Себя
              </button>
              <button type="button" onClick={both} className="press min-h-11 rounded-xl border-2 border-brand bg-orange-50 px-2 text-sm font-semibold" data-testid="repeat-both">
                ⇄ Оба
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
