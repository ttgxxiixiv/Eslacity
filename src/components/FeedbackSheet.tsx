import type { Verdict } from '../domain/answer';
import { Button, SpeakButton } from './ui';

export interface Feedback {
  verdict: Verdict;
  title: string;
  answer?: string;
  sub?: string;
  note?: string;
  speakText?: string;
}

// Цвет заголовка в тёмном диалоговом окне.
const TITLE: Record<Verdict, string> = {
  correct: 'text-[#9be27a]',
  almost: 'text-gold',
  wrong: 'text-[#ff8a7a]',
};

export function FeedbackSheet({ fb, onNext }: { fb: Feedback | null; onNext: () => void }) {
  const shown = !!fb;
  return (
    <div
      aria-live="polite"
      className={`sheet fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] ${
        shown ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-full opacity-0'
      }`}
    >
      {fb && (
        <div className="dialog-box rounded-xl px-5 pt-4 pb-4">
          <div className={`font-pixel text-xl font-bold ${TITLE[fb.verdict]}`}>{fb.title}</div>
          {fb.answer && (
            <div className="mt-1 flex items-center gap-3">
              <div className="flex-1">
                <div className="text-xl font-semibold">{fb.answer}</div>
                {fb.sub && <div className="text-[#cfc6b0]">{fb.sub}</div>}
              </div>
              {fb.speakText && <SpeakButton text={fb.speakText} />}
            </div>
          )}
          {fb.note && <div className="mt-1 text-sm text-[#e6dcc4]">{fb.note}</div>}
          <Button
            autoFocus
            className={`mt-3 w-full ${fb.verdict === 'wrong' ? '!bg-bad' : fb.verdict === 'almost' ? '!bg-almost' : '!bg-ok'}`}
            onClick={onNext}
          >
            Дальше <span aria-hidden className="blink inline-block">▼</span>
          </Button>
        </div>
      )}
    </div>
  );
}
