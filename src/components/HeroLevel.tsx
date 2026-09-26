import { useEffect } from 'react';
import { heroLevel } from '../domain/heroLevel';
import { useProgress } from '../store/progress';
import { useHeroTitle } from '../store/journey';

/** Уровень в верхней панели: щиток с номером перед дневным опытом. */
export function LevelBadge() {
  const xpTotal = useProgress((s) => s.xpTotal);
  const { level } = heroLevel(xpTotal);
  const title = useHeroTitle();
  return (
    <div
      data-testid="level-badge"
      className="flex h-10 min-w-10 flex-col items-center justify-center rounded-md border-2 border-gold bg-wood-light px-1.5 leading-none shadow-inner"
      title={`${title}, уровень ${level}`}
      aria-label={`${title}, уровень ${level}`}
    >
      <span className="font-pixel text-[9px] tracking-wider text-gold uppercase">ур.</span>
      <span className="text-base font-bold tabular-nums text-stone-50">{level}</span>
    </div>
  );
}

/** Карточка в профиле: текущий уровень и прогресс до следующего. */
export function LevelCard() {
  const xpTotal = useProgress((s) => s.xpTotal);
  const { level, into, need } = heroLevel(xpTotal);
  const ratio = need ? into / need : 0;
  const title = useHeroTitle();
  return (
    <section className="rounded-3xl bg-white p-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-bold">
          Уровень <span className="font-sans text-lg">{level}</span>
        </h2>
        <span className="text-sm text-stone-500 tabular-nums">всего {xpTotal} XP</span>
      </div>
      <div className="text-sm font-semibold text-amber-700" data-testid="hero-title">
        {title}
      </div>
      <div
        className="mt-3 h-4 overflow-hidden rounded bg-wood p-[2px]"
        role="progressbar"
        aria-label={`До уровня ${level + 1}`}
        aria-valuemin={0}
        aria-valuemax={need}
        aria-valuenow={into}
      >
        <div
          className="h-full w-full origin-left rounded-sm bg-gold"
          style={{ transform: `scaleX(${ratio})`, transition: 'transform 300ms ease-out' }}
        />
      </div>
      <p className="mt-2 text-sm text-stone-500 tabular-nums">
        {into} / {need} XP до уровня {level + 1}, осталось {need - into}
      </p>
    </section>
  );
}

/** Поздравление с новым уровнем: всплывает сверху на несколько секунд, на любом экране. */
export function LevelUpToast() {
  const levelUp = useProgress((s) => s.levelUp);
  useEffect(() => {
    if (levelUp === null) return;
    const t = setTimeout(() => useProgress.getState().clearLevelUp(), 3500);
    return () => clearTimeout(t);
  }, [levelUp]);
  if (levelUp === null) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-30 flex justify-center px-4" role="status" aria-live="polite">
      <div className="level-up rounded-xl border-2 border-gold bg-wood px-5 py-3 text-center text-stone-50 shadow-xl">
        <div className="font-pixel text-xs tracking-widest text-gold uppercase">Новый уровень</div>
        <div className="text-2xl font-bold">⭐ {levelUp}</div>
      </div>
    </div>
  );
}
