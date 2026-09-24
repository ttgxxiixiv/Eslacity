/** Минимальная разметка для теории: только **жирный**. */
export function Md({ text, className = '' }: { text: string; className?: string }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <p className={className}>
      {parts.map((p, i) => (i % 2 ? <strong key={i}>{p}</strong> : p))}
    </p>
  );
}
