import { NavLink } from 'react-router-dom';
import { NavIcon, type NavIconName } from './NavIcons';
import { PixelArt } from './PixelArt';

const TABS: { to: string; label: string; icon: NavIconName; end?: boolean }[] = [
  { to: '/', label: 'Город', icon: 'map', end: true },
  { to: '/grammar', label: 'Грамматика', icon: 'book' },
  { to: '/review', label: 'Повтор', icon: 'hourglass' },
  { to: '/profile', label: 'Профиль', icon: 'hero' },
];

// Руны на каменной полосе: испанские буквы, которых нет в русском.
const RUNES = ['á, ñ', '¿ ¡', 'é, ó', 'ü, í'];

// Плющ, свисающий с каменной полосы.
const VINE = [
  '..LLL.....',
  '.LlLLL....',
  '..LLsLL...',
  '....s.LL..',
  '...LsLlL..',
  '..LlLs....',
  '...LLs....',
  '.....s.LL.',
  '....LsLlL.',
  '...LlLs...',
  '....LLs...',
  '......s...',
  '.....LsL..',
  '....LlLL..',
  '.....LL...',
];
const VINE_COLORS = { L: '#4f9a3a', l: '#7cc25a', s: '#2f6a28' };

/** Нижнее меню: каменная панель с рунами и четырьмя ячейками, активная светится синим. */
export function NavBar() {
  return (
    <nav className="stone-panel fixed inset-x-0 bottom-0 z-10 pb-[env(safe-area-inset-bottom)]">
      <div className="relative mx-auto max-w-md px-1.5 pt-1.5 pb-1.5">
        <div aria-hidden className="flex gap-1">
          {RUNES.map((r) => (
            <div key={r} className="stone-slab rune flex h-7 flex-1 items-center justify-center rounded-sm text-sm">
              {r}
            </div>
          ))}
        </div>
        <div aria-hidden className="pointer-events-none absolute top-0 left-0.5 z-10">
          <PixelArt rows={VINE} colors={VINE_COLORS} size={30} />
        </div>
        <div aria-hidden className="pointer-events-none absolute top-0 left-[24%] z-10">
          <PixelArt rows={VINE} colors={VINE_COLORS} size={26} />
        </div>
        <div className="mt-1.5 flex gap-1.5">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `press nav-slot flex flex-1 flex-col items-center justify-end gap-1 rounded-md pt-2 pb-1.5 ${isActive ? 'nav-slot-active' : ''}`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span aria-hidden className="nav-sparkles">
                      ✦ ✧
                    </span>
                  )}
                  <NavIcon name={t.icon} size={t.icon === 'hero' ? 36 : 48} />
                  <span className="nav-label font-pixel text-[11px] leading-none">{t.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}
