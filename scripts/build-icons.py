"""Иконки приложения из `docs/design/app-icon.jpg` (медальон с глазом, как над нижним меню), для сайта и для APK.

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

# Приложение для Android (`android/`, Capacitor): иконки запуска и заставка из той же картинки.
# - `mipmap-*/ic_launcher.png` и `ic_launcher_round.png` — как `icon-512` (без рамки по краю);
# - `ic_launcher_foreground.png` — слой адаптивной иконки 108dp: картинка целиком, медальон (63%) внутри видимого
#   круга 72dp, фон слоя — тёмное дерево `ic_launcher_background`;
# - `drawable*/splash.png` — заставка: медальон по центру на тёмном дереве, размеры как у шаблона Capacitor.
RES = ROOT / 'android' / 'app' / 'src' / 'main' / 'res'
BG = (31, 14, 7)
if RES.exists():
    for dpi, k in {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}.items():
        d = RES / f'mipmap-{dpi}'
        save(icon, round(48 * k), d / 'ic_launcher.png')
        save(icon, round(48 * k), d / 'ic_launcher_round.png')
        save(src, round(108 * k), d / 'ic_launcher_foreground.png')
    (RES / 'values' / 'ic_launcher_background.xml').write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#1F0E07</color>\n</resources>\n'
    )
    for path in sorted(RES.glob('drawable*/splash.png')):
        w, h = Image.open(path).size
        splash = Image.new('RGB', (w, h), BG)
        side = round(min(w, h) * 0.5)
        splash.paste(src.resize((side, side), Image.LANCZOS), ((w - side) // 2, (h - side) // 2))
        splash.quantize(256, method=Image.Quantize.MEDIANCUT).save(path, 'PNG', optimize=True)
        print(path.relative_to(ROOT), (w, h))

# Значок уведомления (напоминания, задача 10.4): Android рисует его в строке состояния одним цветом по прозрачности,
# цветная картинка превратилась бы в квадрат. Белый силуэт медальона с глазом: кольцо, глаз-миндалина, зрачок.
# `drawable-*/ic_stat_eslacity.png`, 24dp; имя прописано в `capacitor.config.ts` (LocalNotifications.smallIcon).
if RES.exists():
    from PIL import ImageDraw

    def stat_icon(px: int) -> Image.Image:
        s = px * 8
        img = Image.new('L', (s, s), 0)
        d = ImageDraw.Draw(img)
        d.ellipse((s * 0.06, s * 0.06, s * 0.94, s * 0.94), fill=255)
        d.ellipse((s * 0.16, s * 0.16, s * 0.84, s * 0.84), fill=0)
        # Глаз: две дуги-окружности дают миндалину.
        eye = Image.new('L', (s, s), 0)
        e = ImageDraw.Draw(eye)
        e.ellipse((s * 0.1, s * 0.26, s * 0.9, s * 1.06), fill=255)
        top = Image.new('L', (s, s), 0)
        ImageDraw.Draw(top).ellipse((s * 0.1, s * -0.06, s * 0.9, s * 0.74), fill=255)
        eye = Image.composite(eye, Image.new('L', (s, s), 0), top)
        img = Image.composite(Image.new('L', (s, s), 255), img, eye)
        d = ImageDraw.Draw(img)
        d.ellipse((s * 0.38, s * 0.38, s * 0.62, s * 0.62), fill=0)
        d.ellipse((s * 0.45, s * 0.45, s * 0.55, s * 0.55), fill=255)
        alpha = img.resize((px, px), Image.LANCZOS)
        out = Image.new('RGBA', (px, px), (255, 255, 255, 0))
        out.putalpha(alpha)
        return out

    for dpi, k in {'mdpi': 1, 'hdpi': 1.5, 'xhdpi': 2, 'xxhdpi': 3, 'xxxhdpi': 4}.items():
        path = RES / f'drawable-{dpi}' / 'ic_stat_eslacity.png'
        path.parent.mkdir(exist_ok=True)
        stat_icon(round(24 * k)).save(path, 'PNG', optimize=True)
        print(path.relative_to(ROOT), round(24 * k))
