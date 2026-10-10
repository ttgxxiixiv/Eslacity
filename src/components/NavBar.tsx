import { Link, useLocation } from 'react-router-dom';
import navEs from '../assets/nav/nav-es.webp';
import navIt from '../assets/nav/nav-it.webp';
import navEsGold from '../assets/nav/nav-es-gold.webp';
import navItGold from '../assets/nav/nav-it-gold.webp';
import { LANG } from '../lang';
import { useSphinx } from '../store/sphinx';

// Меню — картинка по макету (768×288: сверху купол медальона и полоса рун, ниже ряд ячеек). Ячейки всегда каменные,
// выбранный раздел не подсвечивается. Картинки отличаются только глазом: у каждого языка свой флаг.
// С задачи 14.2 меню компактное: на экране только ряд ячеек и уменьшенный медальон на его верхнем крае.
const W = 768;
const H = 288;
/** Верх ячеек на картинке; выше — полоса с рунами и медальоном. */
const TILE_TOP = 106;
const TILES_H = H - TILE_TOP;
/** Круг медальона на картинке: центр и радиус. */
const EYE = { x: 383, y: 63, r: 56 };
/** Медальон над рядом ячеек: диаметр в долях высоты ряда и сколько его выступает над рядом. */
const EYE_SIZE = 0.5;
const EYE_RISE = 0.32;
const TABS = [
  { to: '/', label: 'Город', x0: 0, x1: 189 },
  { to: '/grammar', label: 'Грамматика', x0: 191, x1: 383 },
  { to: '/errands', label: 'Повтор', x0: 385, x1: 577 },
  { to: '/profile', label: 'Профиль', x0: 580, x1: 768 },
];
const IMAGE = LANG === 'it' ? navIt : navEs;
/** После Эликсира медальон золотой (задача 8.3, картинки строит scripts/build-gold-nav.py). */
const GOLD = LANG === 'it' ? navItGold : navEsGold;

function activeTab(pathname: string): number {
  if (pathname.startsWith('/grammar')) return 1;
  if (pathname.startsWith('/review') || pathname.startsWith('/errand')) return 2;
  if (pathname.startsWith('/profile')) return 3;
  return 0;
}

export function NavBar() {
  const { pathname } = useLocation();
  const active = activeTab(pathname);
  const gold = useSphinx((s) => s.rec.elixir !== undefined);
  const src = gold ? GOLD : IMAGE;
  // Высота ряда ячеек — `--nav-h` из index.css; ширина и картинка считаются от неё в тех же пропорциях.
  const h = 'var(--nav-h)';
  const eye = `calc(${h} * ${EYE_SIZE})`;
  const k = `(${eye} / ${2 * EYE.r})`;
  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-10">
      {/* По бокам узкого ряда — тот же тёмный камень, что у краёв ячеек. */}
      <div className="flex justify-center bg-[#4a3d33]">
        <div
          className="nav-art relative max-w-full"
          data-testid="nav-art"
          data-src={src}
          data-gold={gold || undefined}
          style={{
            height: h,
            width: `calc(${h} * ${W / TILES_H})`,
            backgroundImage: `url(${src})`,
            backgroundSize: `100% calc(${h} * ${H / TILES_H})`,
            backgroundPosition: 'center bottom',
          }}
        >
          {/* Медальон с глазом — вырезка круга из той же картинки, меньше и на верхнем крае ряда. */}
          <span
            aria-hidden
            className="absolute left-1/2 -translate-x-1/2 rounded-full"
            style={{
              width: eye,
              height: eye,
              top: `calc(${eye} * ${-EYE_RISE})`,
              backgroundImage: `url(${src})`,
              backgroundSize: `calc(${W} * ${k}) calc(${H} * ${k})`,
              backgroundPosition: `calc(${-(EYE.x - EYE.r)} * ${k}) calc(${-(EYE.y - EYE.r)} * ${k})`,
            }}
          />
          {TABS.map((t, i) => (
            <Link
              key={t.to}
              to={t.to}
              aria-label={t.label}
              aria-current={i === active ? 'page' : undefined}
              className="nav-hit pointer-events-auto absolute inset-y-0"
              style={{ left: `${(t.x0 / W) * 100}%`, width: `${((t.x1 - t.x0) / W) * 100}%` }}
            />
          ))}
        </div>
      </div>
      {/* Под системной полосой жестов — тот же камень, что у нижнего края меню. */}
      <div className="h-[env(safe-area-inset-bottom)] bg-[#4a3d33]" />
    </nav>
  );
}
