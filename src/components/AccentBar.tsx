/**
 * Кнопки над полем ввода: все буквы правильного ответа по одному разу, ниже пробел
 * (если слов несколько) и «стереть». preventDefault на pointerdown не даёт полю потерять фокус,
 * иначе на телефоне клавиатура пряталась бы после каждого нажатия.
 */
export function AccentBar({
  keys, space, onKey, onBackspace, disabled,
}: {
  keys: string[];
  space?: boolean;
  onKey: (ch: string) => void;
  onBackspace: () => void;
  disabled?: boolean;
}) {
  if (!keys.length) return null;
  const cls = 'press h-11 rounded-lg bg-white text-lg font-medium shadow-sm disabled:opacity-50';
  const keep = (e: React.PointerEvent) => e.preventDefault();
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-1.5">
        {keys.map((k) => (
          <button key={k} type="button" disabled={disabled} onPointerDown={keep} onClick={() => onKey(k)} className={`${cls} w-11`}>
            {k}
          </button>
        ))}
      </div>
      <div className="flex gap-1.5">
        {space && (
          <button
            type="button"
            aria-label="Пробел"
            disabled={disabled}
            onPointerDown={keep}
            onClick={() => onKey(' ')}
            className={`${cls} flex-1 text-sm text-stone-500`}
          >
            пробел
          </button>
        )}
        <button
          type="button"
          aria-label="Стереть"
          disabled={disabled}
          onPointerDown={keep}
          onClick={onBackspace}
          className={`${cls} w-16 ${space ? '' : 'ml-auto'}`}
        >
          ⌫
        </button>
      </div>
    </div>
  );
}
