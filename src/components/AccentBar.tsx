const KEYS = ['á', 'é', 'í', 'ó', 'ú', 'ñ', 'ü', '¿', '¡'];

/**
 * Кнопки над полем ввода. preventDefault на pointerdown не даёт полю потерять фокус,
 * иначе на телефоне клавиатура пряталась бы после каждого нажатия.
 */
export function AccentBar({ onKey, disabled }: { onKey: (ch: string) => void; disabled?: boolean }) {
  return (
    <div className="flex justify-between gap-1">
      {KEYS.map((k) => (
        <button
          key={k}
          type="button"
          disabled={disabled}
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => onKey(k)}
          className="press h-11 flex-1 rounded-lg border border-stone-300 bg-white text-lg font-medium disabled:opacity-50"
        >
          {k}
        </button>
      ))}
    </div>
  );
}
