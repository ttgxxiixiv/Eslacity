import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { speak } from '../audio/tts';

type Variant = 'primary' | 'secondary' | 'ghost';

const VARIANT_CLASS: Record<Variant, string> = {
  // Синяя кнопка в золотой рамке с «ступенькой» снизу, как в старых RPG-меню.
  primary: 'bg-brand text-white shadow-md disabled:bg-stone-300 disabled:text-stone-500 disabled:shadow-sm',
  secondary: 'bg-white text-stone-800 shadow-sm disabled:text-stone-500',
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

/** Экран: колонка по ширине телефона, при открытии мягко проявляется (`screen-in`, без движения при `prefers-reduced-motion`). */
export function Screen({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`screen-in mx-auto flex min-h-dvh w-full max-w-md flex-col ${className}`}>{children}</div>;
}

/**
 * Ожидание, пока грузится контент (задача 14.6): свиток с пером на пергаменте вместо пустого экрана. Показывается
 * с задержкой (`loading-in`), поэтому быстрая загрузка из кэша не мигает. `inline` — внутри уже открытого экрана.
 */
export function Loading({ text = 'Летописец листает свиток', inline = false }: { text?: string; inline?: boolean }) {
  const body = (
    <div role="status" aria-live="polite" className="loading-in flex flex-col items-center gap-3 py-16 text-stone-600" data-testid="loading">
      <span aria-hidden className="loading-quill text-4xl">
        📜
      </span>
      <span className="px-4 text-center font-pixel text-lg">{text}</span>
      <span aria-hidden className="loading-dots flex gap-1.5">
        <span />
        <span />
        <span />
      </span>
    </div>
  );
  return inline ? body : <Screen>{body}</Screen>;
}
