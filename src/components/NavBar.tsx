import { Link, useLocation } from 'react-router-dom';
import strip from '../assets/nav/nav-strip.webp';
import geometry from '../assets/nav/nav-strip.json';
import eyeEs from '../assets/nav/eye-es.webp';
import eyeIt from '../assets/nav/eye-it.webp';
import eyeEsGold from '../assets/nav/eye-es-gold.webp';
import eyeItGold from '../assets/nav/eye-it-gold.webp';
import { LANG } from '../lang';
import { useSphinx } from '../store/sphinx';

// Нижнее меню — рисованный ряд из четырёх каменных ячеек (`nav-strip.webp`) и медальон с глазом в гнезде над ними.
// Картинки и геометрию (`nav-strip.json`: ячейки, полоса подписи, гнездо медальона) строит scripts/build-nav-art.py
// из docs/design/nav-wow-*.png. Ячейки всегда каменные, выбранный раздел не подсвечивается. Ряд у языков общий,
// глаз медальона — в цветах флага языка курса.
const { w: W, h: H, tiles: TILES, panels: PANELS, label: LABEL, eye: EYE } = geometry;
/** Медальон больше гнезда: прикрывает его каменный обод и чуть выступает над рядом. */
const EYE_SCALE = 1.45;
const TABS = [
  { to: '/', label: 'Город' },
  { to: '/grammar', label: 'Грамматика' },
  { to: '/errands', label: 'Повтор' },
  { to: '/profile', label: 'Профиль' },
];
const EYES = { es: { plain: eyeEs, gold: eyeEsGold }, it: { plain: eyeIt, gold: eyeItGold } };
/** Медальон языка курса; после Эликсира — золотой (задача 8.3). */
export const eyeOf = (gold: boolean) => EYES[LANG === 'it' ? 'it' : 'es'][gold ? 'gold' : 'plain'];

function activeTab(pathname: string): number {
  if (pathname.startsWith('/grammar')) return 1;
  if (pathname.startsWith('/review') || pathname.startsWith('/errand')) return 2;
  if (pathname.startsWith('/profile')) return 3;
  return 0;
}

const pct = (v: number, of: number) => `${(v / of) * 100}%`;

export function NavBar() {
  const { pathname } = useLocation();
  const active = activeTab(pathname);
  const gold = useSphinx((s) => s.rec.elixir !== undefined);
  const eye = eyeOf(gold);
  const d = 2 * EYE.r * EYE_SCALE;
  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-10">
      {/* Высота ряда — `--nav-h` из index.css; ширина — в пропорции картинки. По бокам узкого ряда — тёмный камень. */}
      <div className="flex justify-center">
        <div
          className="nav-art relative max-w-full"
          data-testid="nav-art"
          data-src={eye}
          data-gold={gold || undefined}
          style={{ height: 'var(--nav-h)', width: `calc(var(--nav-h) * ${W / H})`, backgroundImage: `url(${strip})`, backgroundSize: '100% 100%' }}
        >
          <img
            src={eye}
            alt=""
            draggable={false}
            className="absolute -translate-x-1/2 -translate-y-1/2 select-none"
            style={{ left: pct(EYE.x, W), top: pct(EYE.y, H), width: pct(d, W), height: 'auto' }}
            data-testid="nav-eye"
          />
          {TABS.map((t, i) => {
            const [x0, x1] = TILES[i];
            // Подпись — по середине внутренней панели ячейки, а не всей ячейки с каменным краем.
            const [p0, p1] = PANELS[i];
            return (
              <Link
                key={t.to}
                to={t.to}
                aria-label={t.label}
                aria-current={i === active ? 'page' : undefined}
                className="nav-hit pointer-events-auto absolute inset-y-0"
                style={{ left: pct(x0, W), width: pct(x1 - x0, W) }}
              >
                {/* Подпись в нижней полосе ячейки: рисуется кодом, на картинке полоса пустая. Размер не растёт с размером текста. */}
                <span
                  aria-hidden
                  className="nav-label absolute flex items-center justify-center font-pixel text-[12px] leading-none whitespace-nowrap uppercase"
                  style={{ top: pct(LABEL[0], H), height: pct(LABEL[1] - LABEL[0], H), left: pct(p0 - x0, x1 - x0), width: pct(p1 - p0, x1 - x0) }}
                >
                  {t.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
      {/* Под системной полосой жестов — тёмный камень. */}
      <div className="h-[env(safe-area-inset-bottom)] bg-[#2b221c]" />
    </nav>
  );
}
