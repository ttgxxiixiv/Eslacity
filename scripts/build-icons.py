"""Иконки приложения из `docs/design/app-icon.jpg` (медальон с глазом, как над нижним меню).

- `public/icons/icon-192.png`, `icon-512.png`, `apple-touch-icon.png` (180): картинка без тонкой рамки по краю
  (обрезается по 7% с каждой стороны), медальон крупнее.
- `public/icons/maskable-512.png`: картинка целиком — медальон лежит в центральных 63%, это внутри безопасной зоны
  80%, которую сохраняют круглые и скруглённые маски Android.
- `public/favicon-32.png`, `favicon-16.png`: только медальон (обрезка по нему), иначе во вкладке браузера он
  слишком мелкий.

Запуск: python3 scripts/build-icons.py
"""
from pathlib import Path

from PIL import Image, ImageEnhance

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'docs' / 'design' / 'app-icon.jpg'
PUBLIC = ROOT / 'public'

src = Image.open(SRC).convert('RGB')
W, H = src.size
assert W == H, 'картинка иконки должна быть квадратной'


def crop(frac: float) -> Image.Image:
    """Квадрат по центру: отступ `frac` от каждого края."""
    m = round(W * frac)
    return src.crop((m, m, W - m, H - m))


def save(img: Image.Image, size: int, path: Path) -> None:
    # Палитра на 256 цветов: для пиксельной картинки разницы не видно, а файл в 3–4 раза легче (иконки идут в precache).
    small = img.resize((size, size), Image.LANCZOS)
    small.quantize(256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG).save(path, 'PNG', optimize=True)
    print(path.relative_to(ROOT), size)


icon = crop(0.07)
save(icon, 512, PUBLIC / 'icons' / 'icon-512.png')
save(icon, 192, PUBLIC / 'icons' / 'icon-192.png')
save(icon, 180, PUBLIC / 'icons' / 'apple-touch-icon.png')
save(src, 512, PUBLIC / 'icons' / 'maskable-512.png')

# Значок вкладки: медальон занимает почти весь квадрат, контраст чуть выше, чтобы глаз не терялся в 16 пикселях.
tab = ImageEnhance.Contrast(crop(0.16)).enhance(1.15)
save(tab, 32, PUBLIC / 'favicon-32.png')
save(tab, 16, PUBLIC / 'favicon-16.png')
