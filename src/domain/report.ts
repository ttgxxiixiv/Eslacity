/**
 * «Сообщить об ошибке» (задача 11.1). Игрок отмечает задание, где что-то не так: неверный перевод, ответ, опечатка.
 * Отчёт хранится на устройстве (таблица `reports`), попадает в резервную копию; в настройках его можно скопировать
 * и прислать. По `itemId` ошибка находится в контенте: слово `cafe.te`, правило `g:a1.02-ser.3`, фраза `ph:…`,
 * форма глагола `v:…`, пара Звонницы `mp:…`, реплика сцены `sc:cafe.1#3`, узел миссии `ms:cafe.1#order`.
 */
export interface ReportRecord {
  id?: number;
  ts: number;
  itemId: string;
  /** Что было на экране: ответ и перевод, реплика. */
  context: string;
  reason: ReportReason;
  /** Комментарий игрока, может быть пустым. */
  note: string;
  /** Версия приложения: правка могла уже выйти. */
  version: string;
}

export type ReportReason = 'translation' | 'answer' | 'typo' | 'audio' | 'other';

export const REPORT_REASONS: Record<ReportReason, string> = {
  translation: 'Неверный перевод',
  answer: 'Верный ответ не засчитан',
  typo: 'Опечатка',
  audio: 'Озвучка',
  other: 'Другое',
};

const pad = (n: number) => String(n).padStart(2, '0');
const stamp = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Текст для «Скопировать отчёты»: шапка с языком и версией, по строке на отчёт, старые сверху. */
export function formatReports(list: ReportRecord[], lang: string, version: string): string {
  const head = `Eslacity ${version} · ${lang} · отчётов: ${list.length}`;
  const rows = [...list]
    .sort((a, b) => a.ts - b.ts)
    .map((r) => {
      const note = r.note.trim().replace(/\s+/g, ' ');
      return `${stamp(r.ts)} · ${r.itemId} · «${r.context}» · ${REPORT_REASONS[r.reason] ?? r.reason}${note ? `: ${note}` : ''}${r.version !== version ? ` (версия ${r.version})` : ''}`;
    });
  return [head, ...rows].join('\n');
}
