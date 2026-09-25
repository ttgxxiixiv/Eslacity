/**
 * Кнопки над полем ввода: только особые буквы, которые есть в правильном ответе.
 * preventDefault на pointerdown не даёт полю потерять фокус,
 * иначе на телефоне клавиатура пряталась бы после каждого нажатия.
 */
export function AccentBar({ keys, onKey, disabled }: { keys: string[]; onKey: (ch: string) => void; disabled?: boolean }) {
  if (!keys.length) return null;
  return (
    <div className="flex gap-1">
      {keys.map((k) => (
        <button
          key={k}
          type="button"
          disabled={disabled}
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => onKey(k)}
          className="press h-11 w-11 rounded-lg border border-stone-300 bg-white text-lg font-medium disabled:opacity-50"
        >
          {k}
        </button>
      ))}
    </div>
  );
}
