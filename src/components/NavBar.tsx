import { Link, useLocation } from 'react-router-dom';
import nav0 from '../assets/nav/nav-0.webp';
import nav1 from '../assets/nav/nav-1.webp';
import nav2 from '../assets/nav/nav-2.webp';
import nav3 from '../assets/nav/nav-3.webp';

// Меню — картинка по макету (768×288, сверху дорисован купол медальона) в четырёх вариантах: в каждом подсвечен свой раздел.
const W = 768;
const H = 288;
/** Верх ячеек на картинке; выше — полоса с рунами и медальоном. */
const TILE_TOP = 106;
const TABS = [
  { to: '/', label: 'Город', x0: 0, x1: 189 },
  { to: '/grammar', label: 'Грамматика', x0: 191, x1: 383 },
  { to: '/review', label: 'Повтор', x0: 385, x1: 577 },
  { to: '/profile', label: 'Профиль', x0: 580, x1: 768 },
];
const IMAGES = [nav0, nav1, nav2, nav3];

function activeTab(pathname: string): number {
  if (pathname.startsWith('/grammar')) return 1;
  if (pathname.startsWith('/review')) return 2;
  if (pathname.startsWith('/profile')) return 3;
  return 0;
}

/**
 * Нижнее меню. Все четыре картинки лежат друг на друге, видна одна:
 * при смене раздела ничего не загружается и меню не мигает.
 */
export function NavBar() {
  const { pathname } = useLocation();
  const active = activeTab(pathname);
  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-10">
      <div className="nav-art relative mx-auto max-w-md" style={{ aspectRatio: `${W} / ${H}` }}>
        {IMAGES.map((src, i) => (
          <img
            key={src}
            src={src}
            alt=""
            draggable={false}
            className="absolute inset-0 h-full w-full select-none"
            style={{ opacity: i === active ? 1 : 0 }}
          />
        ))}
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
