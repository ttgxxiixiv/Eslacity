import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import strip from '../assets/nav/nav-strip.webp';
import geometry from '../assets/nav/nav-strip.json';
import eyeEs from '../assets/nav/eye-es.webp';
import eyeIt from '../assets/nav/eye-it.webp';
import eyeEsGold from '../assets/nav/eye-es-gold.webp';
import eyeItGold from '../assets/nav/eye-it-gold.webp';
import eyeEn from '../assets/nav/eye-en.webp';
import eyeEnGold from '../assets/nav/eye-en-gold.webp';
import eyeTr from '../assets/nav/eye-tr.webp';
import eyeTrGold from '../assets/nav/eye-tr-gold.webp';
import { LANG, LANGS, RELEASED_LANGS, switchLang, type Lang } from '../lang';
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
const EYES: Partial<Record<Lang, { plain: string; gold: string }>> = {
  es: { plain: eyeEs, gold: eyeEsGold },
  it: { plain: eyeIt, gold: eyeItGold },
  en: { plain: eyeEn, gold: eyeEnGold },
  tr: { plain: eyeTr, gold: eyeTrGold },
};
/** Медальон языка; после Эликсира — золотой (задача 8.3). Курс без своего медальона берёт испанский. */
const eyeFor = (lang: Lang, gold: boolean) => (EYES[lang] ?? EYES.es!)[gold ? 'gold' : 'plain'];
/** Медальон языка курса. */
export const eyeOf = (gold: boolean) => eyeFor(LANG, gold);
/** Языки в меню медальона: открытые курсы и текущий, даже если он закрыт. */
const MENU_LANGS = RELEASED_LANGS.includes(LANG) ? RELEASED_LANGS : [...RELEASED_LANGS, LANG];

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
  const [open, setOpen] = useState(false);
  // Меню языка закрывается при переходе на другой экран и по Escape.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-10">
      {/* Пока меню языка открыто, нажатие мимо него закрывает его. */}
      {open && (
        <button
          type="button"
          aria-label="Закрыть выбор языка"
          tabIndex={-1}
          onClick={() => setOpen(false)}
          className="pointer-events-auto fixed inset-0 cursor-default"
          data-testid="lang-menu-backdrop"
        />
      )}
      {/* Высота ряда — `--nav-h` из index.css; ширина — в пропорции картинки. По бокам узкого ряда — тёмный камень. */}
      <div className="flex justify-center">
        <div
          className="nav-art relative max-w-full"
          data-testid="nav-art"
          data-src={eye}
          data-gold={gold || undefined}
          style={{ height: 'var(--nav-h)', width: `calc(var(--nav-h) * ${W / H})`, backgroundImage: `url(${strip})`, backgroundSize: '100% 100%' }}
        >
          {/* Медальон — кнопка выбора языка курса: над рядом открывается список открытых курсов. */}
          <button
            type="button"
            aria-label={`Язык курса: ${LANGS[LANG].name}. Сменить язык`}
            aria-expanded={open}
            aria-haspopup="menu"
            onClick={() => setOpen((v) => !v)}
            className="pointer-events-auto absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ left: pct(EYE.x, W), top: pct(EYE.y, H), width: pct(d, W) }}
            data-testid="nav-eye-button"
          >
            <img src={eye} alt="" draggable={false} className="block h-auto w-full select-none" data-testid="nav-eye" />
          </button>
          {open && (
            <div
              role="menu"
              aria-label="Язык курса"
              className="pointer-events-auto absolute bottom-full left-1/2 z-20 mb-3 w-64 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-2xl border-2 border-wood bg-white p-2 shadow-xl"
              data-testid="lang-menu"
            >
              {MENU_LANGS.map((id) => (
                <button
                  key={id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={id === LANG}
                  onClick={() => (id === LANG ? setOpen(false) : switchLang(id))}
                  className={`press flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left font-semibold ${
                    id === LANG ? 'bg-stone-100 text-wood' : 'text-wood'
                  }`}
                  data-testid="lang-option"
                  data-lang={id}
                >
                  <img src={eyeFor(id, id === LANG && gold)} alt="" className="h-9 w-9" />
                  <span className="flex-1">{LANGS[id].name}</span>
                  {id === LANG && <span className="shrink-0 text-sm text-stone-500">сейчас</span>}
                </button>
              ))}
            </div>
          )}
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
