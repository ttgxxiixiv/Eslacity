import type { GrammarItem } from '../../domain/grammar';

/** Предложение с пропуском, заполненное словом. */
export function fillGap(sentence: string, word: string) {
  return sentence.replace('___', word);
}

/** Упражнение грамматики: выбор формы, пропуск или верно/неверно. Общее для урока и повторения. */
export function GrammarItemView({ item, picked, onPick }: { item: GrammarItem; picked: number | null; onPick: (i: number) => void }) {
  const { ex } = item;
  const shownWord = picked === null ? null : item.options[picked];
  return (
    <div className="flex flex-1 flex-col">
      <div className="text-sm font-medium text-stone-500">
        {ex.kind === 'choose' ? 'Выберите форму' : ex.kind === 'gap' ? 'Заполните пропуск' : 'Верно или неверно?'}
      </div>
      <div className="mt-5 text-2xl leading-snug font-bold">
        {ex.kind === 'choose' && ex.prompt}
        {ex.kind === 'truefalse' && ex.statement}
        {ex.kind === 'gap' &&
          ex.sentence.split('___').map((part, i) => (
            <span key={i}>
              {i > 0 && (
                <span
                  className={`mx-1 inline-block min-w-16 border-b-4 text-center ${
                    shownWord === null ? 'border-stone-300' : picked === item.answer ? 'border-ok text-ok' : 'border-bad text-bad'
                  }`}
                >
                  {shownWord ?? ' '}
                </span>
              )}
              {part}
            </span>
          ))}
      </div>
      {'ru' in ex && ex.ru && <div className="mt-2 text-stone-500">{ex.ru}</div>}
      <div className={`mt-8 grid gap-3 ${ex.kind === 'truefalse' ? 'grid-cols-2' : ''}`}>
        {item.options.map((o, i) => {
          let cls = 'bg-white border-stone-300';
          if (picked !== null) {
            if (i === item.answer) cls = 'bg-okbg border-ok text-ok';
            else if (i === picked) cls = 'bg-badbg border-bad text-bad';
            else cls = 'bg-white border-stone-200 opacity-60';
          }
          return (
            <button
              key={i}
              type="button"
              onClick={() => onPick(i)}
              className={`press min-h-14 rounded-2xl border-2 px-4 py-3 text-lg font-medium ${ex.kind === 'truefalse' ? 'text-center' : 'text-left'} ${cls}`}
            >
              {o}
            </button>
          );
        })}
      </div>
    </div>
  );
}
