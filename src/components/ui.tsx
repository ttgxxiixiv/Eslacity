import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { speak } from '../audio/tts';

type Variant = 'primary' | 'secondary' | 'ghost';

const VARIANT_CLASS: Record<Variant, string> = {
  primary: 'bg-brand text-white shadow-sm disabled:bg-stone-300 disabled:text-stone-500',
  secondary: 'bg-white text-stone-800 border border-stone-300 disabled:text-stone-400',
  ghost: 'text-stone-600',
};

export function Button({
  variant = 'primary', className = '', ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      className={`press rounded-2xl px-5 py-3.5 text-base font-semibold ${VARIANT_CLASS[variant]} ${className}`}
      {...rest}
    />
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
      className={`press inline-flex shrink-0 items-center justify-center rounded-full bg-orange-100 text-brand ${s} ${className}`}
    >
      🔊
    </button>
  );
}

export function TopBar({ title, back = true, right }: { title?: ReactNode; back?: boolean; right?: ReactNode }) {
  const nav = useNavigate();
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-2 bg-stone-50/95 px-2">
      {back && (
        <button type="button" aria-label="Назад" onClick={() => nav(-1)} className="press h-10 w-10 rounded-full text-xl">
          ←
        </button>
      )}
      <h1 className="flex-1 truncate px-2 text-lg font-bold">{title}</h1>
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
