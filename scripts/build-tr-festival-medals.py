"""Тайные медали турецких праздников (задача 18.9): Хыдырэллез и Детский праздник 23 апреля.

Рисованного листа для них пока нет, поэтому скрипт собирает их из готовых медалей праздников, как когда-то
у английского курса: у Хыдырэллеза — костёр Ночи костров в весенней гамме (розовый огонь, зелёное небо), у 23 апреля —
барабан карнавала в цветах турецкого флага. Оправа остаётся прежней, меняется только круг.
Запуск: python3 scripts/build-tr-festival-medals.py
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps

ROOT = Path(__file__).resolve().parent.parent
MEDALS = ROOT / 'src/assets/medals'

# Круг внутри оправы тайной медали (доли стороны картинки), чуть меньше, чтобы не задеть золотой ободок.
CX, CY, R = 0.5, 0.43, 0.252


def disc_mask(size: int) -> Image.Image:
    mask = Image.new('L', (size, size), 0)
    r = R * size
    ImageDraw.Draw(mask).ellipse((CX * size - r, CY * size - r, CX * size + r, CY * size + r), fill=255)
    return mask


def hue(src: str, shift: int, sat: float) -> Image.Image:
    """Круг с поворотом оттенка (0–255) и усиленной насыщенностью."""
    base = Image.open(MEDALS / f'{src}.webp').convert('RGBA')
    h, s, v = base.convert('RGB').convert('HSV').split()
    h = h.point(lambda x: (x + shift) % 256)
    s = s.point(lambda x: min(255, int(x * sat)))
    col = Image.merge('HSV', (h, s, v)).convert('RGB').convert('RGBA')
    out = base.copy()
    out.paste(col, (0, 0), disc_mask(base.width))
    return out


def flag(src: str) -> Image.Image:
    """Круг в цветах флага: тёмное — бордовый, среднее — красный, светлое — белый."""
    base = Image.open(MEDALS / f'{src}.webp').convert('RGBA')
    gray = ImageOps.grayscale(base.convert('RGB'))
    col = ImageOps.colorize(gray, black='#3a0006', mid='#e30a17', white='#ffffff', midpoint=110).convert('RGBA')
    out = base.copy()
    out.paste(col, (0, 0), disc_mask(base.width))
    return out


for name, image in [
    ('secret-festival-hidrellez', hue('secret-festival-bonfire', 225, 1.2)),
    ('secret-festival-nisan', flag('secret-festival-carnival')),
]:
    image.save(MEDALS / f'{name}.webp', 'WEBP', quality=82, method=6)
    print(f'{name}.webp', image.size)
