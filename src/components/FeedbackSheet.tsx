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

const STYLE: Record<Verdict, string> = {
  correct: 'bg-okbg text-ok',
  almost: 'bg-almostbg text-almost',
  wrong: 'bg-badbg text-bad',
};

export function FeedbackSheet({ fb, onNext }: { fb: Feedback | null; onNext: () => void }) {
  const shown = !!fb;
  return (
    <div
      aria-live="polite"
      className={`sheet fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md rounded-t-3xl px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] ${
        fb ? STYLE[fb.verdict] : 'bg-white'
      } ${shown ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-full opacity-0'}`}
    >
      {fb && (
        <>
          <div className="text-lg font-bold">{fb.title}</div>
          {fb.answer && (
            <div className="mt-1 flex items-center gap-3 text-stone-900">
              <div className="flex-1">
                <div className="text-xl font-semibold">{fb.answer}</div>
                {fb.sub && <div className="text-stone-600">{fb.sub}</div>}
              </div>
              {fb.speakText && <SpeakButton text={fb.speakText} />}
            </div>
          )}
          {fb.note && <div className="mt-1 text-sm text-stone-700">{fb.note}</div>}
          <Button
            autoFocus
            className={`mt-3 w-full ${fb.verdict === 'wrong' ? '!bg-bad' : fb.verdict === 'almost' ? '!bg-almost' : '!bg-ok'}`}
            onClick={onNext}
          >
            Дальше
          </Button>
        </>
      )}
    </div>
  );
}
