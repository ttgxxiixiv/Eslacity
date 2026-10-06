/**
 * Запись своего голоса для «Повторить за жителем» (задача 10.1). MediaRecorder работает без сети, запись живёт
 * только в памяти: blob-адрес, который отзывается, когда запись больше не нужна. На диск и в базу ничего не пишется.
 */

/** Предел длины записи: реплика жителя короче. */
export const RECORD_MAX_MS = 10_000;

/** Игрок не дал доступа к микрофону: кнопки больше не показываются до перезапуска. */
let denied = false;

export function recordingSupported(): boolean {
  return (
    !denied &&
    typeof window !== 'undefined' &&
    typeof window.MediaRecorder !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

/** Доступ к микрофону уже запрещён в браузере: тогда кнопки нет сразу, не дожидаясь отказа. */
export async function microphoneBlocked(): Promise<boolean> {
  try {
    const st = await navigator.permissions?.query({ name: 'microphone' as PermissionName });
    return st?.state === 'denied';
  } catch {
    return false;
  }
}

export interface Recording {
  /** Остановить запись; обещание отдаёт blob-адрес записи. */
  stop(): Promise<string>;
  /** Запись закончилась: кнопкой или по пределу длины. */
  done: Promise<string>;
}

/** Начать запись с микрофона. Отказ в доступе запоминается: кнопки записи исчезают. */
export async function startRecording(): Promise<Recording> {
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) {
    if (e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'NotFoundError' || e.name === 'SecurityError')) denied = true;
    throw e;
  }
  const rec = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  const stopped = new Promise<string>((resolve) => {
    rec.onstop = () => {
      // Микрофон отпускается сразу: значок записи в системе гаснет.
      for (const t of stream.getTracks()) t.stop();
      resolve(URL.createObjectURL(new Blob(chunks, { type: rec.mimeType || 'audio/webm' })));
    };
  });
  rec.start();
  const limit = setTimeout(() => rec.state !== 'inactive' && rec.stop(), RECORD_MAX_MS);
  return {
    done: stopped,
    stop() {
      clearTimeout(limit);
      if (rec.state !== 'inactive') rec.stop();
      return stopped;
    },
  };
}
