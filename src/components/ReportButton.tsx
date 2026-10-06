import { useState } from "react";
import { createPortal } from "react-dom";
import { addReport } from "../db/reports";
import { REPORT_REASONS, type ReportReason } from "../domain/report";

/**
 * «Сообщить об ошибке» (задача 11.1): маленькая кнопка у задания и окно с причиной и комментарием. Отчёт ложится
 * в таблицу `reports` на устройстве; отправлять его некуда, игрок копирует отчёты в настройках.
 * `tone` — на тёмном окне итога ответа или на светлом экране.
 */
export function ReportButton({
  itemId,
  context,
  tone = "dark",
}: {
  itemId: string;
  context: string;
  tone?: "dark" | "light";
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("translation");
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <span
        className={`text-xs ${tone === "dark" ? "text-[#cfc6b0]" : "text-stone-500"}`}
        data-testid="report-sent"
      >
        Спасибо! Отчёт сохранён в настройках.
      </span>
    );
  }

  const send = async () => {
    await addReport({ itemId, context, reason, note: note.trim() });
    setOpen(false);
    setSent(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`press text-xs underline underline-offset-2 ${tone === "dark" ? "text-[#cfc6b0]" : "text-stone-500"}`}
        data-testid="report-open"
      >
        ⚑ Ошибка в задании?
      </button>
      {/* Окно — в портале: лист итога ответа сдвигается transform-ом, и fixed внутри него прижимался бы к листу. */}
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-3 pb-3"
            role="dialog"
            aria-label="Сообщить об ошибке"
            data-testid="report-dialog"
          >
            <div className="w-full max-w-md rounded-2xl bg-[#fbf3df] p-4 text-stone-800 shadow-xl">
              <div className="font-bold">Что не так?</div>
              <div className="mt-1 truncate text-sm text-stone-500">
                {context}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(Object.keys(REPORT_REASONS) as ReportReason[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={reason === r}
                    onClick={() => setReason(r)}
                    className={`press rounded-full border-2 px-3 py-1 text-sm ${reason === r ? "border-brand bg-orange-50 text-brand" : "border-stone-300 bg-white"}`}
                    data-testid={`report-reason-${r}`}
                  >
                    {REPORT_REASONS[r]}
                  </button>
                ))}
              </div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Как правильно, по-вашему? (необязательно)"
                className="mt-3 w-full rounded-xl border-2 border-stone-300 bg-white p-2 text-base outline-none focus:border-brand"
                data-testid="report-note"
              />
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="press flex-1 rounded-xl border-2 border-stone-300 bg-white py-2.5 font-semibold"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={send}
                  className="press flex-1 rounded-xl bg-brand py-2.5 font-semibold text-white"
                  data-testid="report-send"
                >
                  Сохранить отчёт
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
