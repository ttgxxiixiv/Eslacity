import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { speak } from '../audio/tts';

type Variant = 'primary' | 'secondary' | 'ghost';

const VARIANT_CLASS: Record<Variant, string> = {
  // Синяя кнопка в золотой рамке с «ступенькой» снизу, как в старых RPG-меню.
  primary: 'bg-brand text-white shadow-md disabled:bg-stone-300 disabled:text-stone-500 disabled:shadow-sm',
  secondary: 'bg-white text-stone-800 shadow-sm disabled:text-stone-400',
  ghost: 'text-stone-600',
};

/** Есть ли в подписи цифры: в пиксельном шрифте они читаются плохо (6 похожа на б). */
function hasDigits(node: ReactNode): boolean {
  if (typeof node === 'string' || typeof node === 'number') return /\d/.test(String(node));
  if (Array.isArray(node)) return node.some(hasDigits);
  return false;
}

export function Button({
  variant = 'primary', className = '', children, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const font = hasDigits(children) ? 'text-base font-bold' : 'font-pixel text-lg';
  return (
    <button
      type="button"
      className={`press rounded-xl px-5 py-3.5 ${font} ${VARIANT_CLASS[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function SpeakButton({ text, className = '', size = 'md' }: { text: string; className?: string; size?: 'md' | 'lg' }) {
  const s = size === 'lg' ? 'h-14 w-14 text-2xl' : 'h-10 w-10 text-lg';
  return (
    <button
      type="button"
      aria-label="Озвучить"
      onClick={(e) => {
        e.stopPropagation();
        speak(text);
      }}
      className={`press inline-flex shrink-0 items-center justify-center rounded-full bg-orange-100 text-brand shadow-sm ${s} ${className}`}
    >
      🔊
    </button>
  );
}

export function TopBar({ title, back = true, right }: { title?: ReactNode; back?: boolean; right?: ReactNode }) {
  const nav = useNavigate();
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b-2 border-stone-300 bg-stone-50/95 px-2">
      {back && (
        <button type="button" aria-label="Назад" onClick={() => nav(-1)} className="press h-10 w-10 rounded-full text-xl">
          ←
        </button>
      )}
      <h1 className="flex-1 truncate px-2 text-xl font-bold">{title}</h1>
      {right}
    </header>
  );
}

export function genderLabel(g?: 'm' | 'f') {
  return g === 'm' ? 'м. р.' : g === 'f' ? 'ж. р.' : '';
}

export function Screen({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto flex min-h-dvh w-full max-w-md flex-col ${className}`}>{children}</div>;
}
