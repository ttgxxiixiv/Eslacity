import type { Word } from '../content/schema';
import type { SessionState } from '../domain/lessonQueue';
import type { LessonTotals } from './LessonPlayer';
import { Button, SpeakButton } from './ui';

interface Props {
  title: string;
  session: SessionState;
  totals: LessonTotals;
  bonusCoins?: number;
  words: Record<string, Word>;
  onDone(): void;
  extra?: React.ReactNode;
}

export function LessonResult({ title, session, totals, bonusCoins = 0, words, onDone, extra }: Props) {
  const answered = session.correct + session.almost + session.wrong;
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-8">
      <h1 className="text-2xl font-bold">{title}</h1>
      <div className="mt-6 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-2xl bg-white p-3 shadow-sm">
          <div className="text-2xl font-bold">+{totals.xp}</div>
          <div className="text-sm text-stone-500">XP</div>
        </div>
        <div className="rounded-2xl bg-white p-3 shadow-sm">
          <div className="text-2xl font-bold">+{totals.coins + bonusCoins}</div>
          <div className="text-sm text-stone-500">монет</div>
        </div>
        <div className="rounded-2xl bg-white p-3 shadow-sm">
          <div className="text-2xl font-bold">
            {answered ? Math.round(((session.correct + session.almost) / answered) * 100) : 100}%
          </div>
          <div className="text-sm text-stone-500">точность</div>
        </div>
      </div>
      {extra}
      {session.mistakes.length > 0 && (
        <>
          <h2 className="mt-8 font-semibold text-stone-600">Слова с ошибками</h2>
          <ul className="mt-2 divide-y divide-stone-200 rounded-2xl bg-white shadow-sm">
            {session.mistakes.map((id) => (
              <li key={id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1">
                  <div className="font-semibold">{words[id]?.es}</div>
                  <div className="text-sm text-stone-500">{words[id]?.ru}</div>
                </div>
                <SpeakButton text={words[id]?.es ?? ''} />
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="flex-1" />
      <Button className="mt-8 w-full" onClick={onDone}>
        Готово
      </Button>
    </div>
  );
}
