import { Link, useLocation } from 'react-router-dom';
import navEs from '../assets/nav/nav-es.webp';
import navIt from '../assets/nav/nav-it.webp';
import { LANG } from '../lang';

// Меню — картинка по макету (768×288, сверху купол медальона). Ячейки всегда каменные,
// выбранный раздел не подсвечивается. Картинки отличаются только глазом: у каждого языка свой флаг.
const W = 768;
const H = 288;
/** Верх ячеек на картинке; выше — полоса с рунами и медальоном. */
const TILE_TOP = 106;
const TABS = [
  { to: '/', label: 'Город', x0: 0, x1: 189 },
  { to: '/grammar', label: 'Грамматика', x0: 191, x1: 383 },
  { to: '/errands', label: 'Повтор', x0: 385, x1: 577 },
  { to: '/profile', label: 'Профиль', x0: 580, x1: 768 },
];
const IMAGE = LANG === 'it' ? navIt : navEs;

function activeTab(pathname: string): number {
  if (pathname.startsWith('/grammar')) return 1;
  if (pathname.startsWith('/review') || pathname.startsWith('/errand')) return 2;
  if (pathname.startsWith('/profile')) return 3;
  return 0;
}

export function NavBar() {
  const { pathname } = useLocation();
  const active = activeTab(pathname);
  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-10">
      <div className="nav-art relative mx-auto max-w-md" style={{ aspectRatio: `${W} / ${H}` }}>
        <img src={IMAGE} alt="" draggable={false} className="absolute inset-0 h-full w-full select-none" />
        {TABS.map((t, i) => (
          <Link
            key={t.to}
            to={t.to}
            aria-label={t.label}
            aria-current={i === active ? 'page' : undefined}
            className="nav-hit pointer-events-auto absolute"
            style={{
              left: `${(t.x0 / W) * 100}%`,
              width: `${((t.x1 - t.x0) / W) * 100}%`,
              top: `${(TILE_TOP / H) * 100}%`,
              bottom: 0,
            }}
          />
        ))}
      </div>
      {/* Под системной полосой жестов — тот же камень, что у нижнего края меню. */}
      <div className="h-[env(safe-area-inset-bottom)] bg-[#4a3d33]" />
    </nav>
  );
}
