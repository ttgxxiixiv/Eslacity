"""Тайные медали английских праздников (задача 17.9): Ночь костров и карнавал в Ноттинг-Хилле.

В листе `docs/design/medal-secrets.png` их нет, поэтому скрипт собирает их из готовых медалей праздников:
у Ночи костров — фейерверк Феррагосто в огненной гамме (тёмное небо, красный и золотой), у карнавала —
маска Карнавала с другим оттенком (розовая маска, зелёные перья). Оправа остаётся прежней, меняется только круг.
Запуск: python3 scripts/build-en-festival-medals.py
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


def fire(src: str) -> Image.Image:
    """Круг в огненной гамме: тёмное — ночное небо, среднее — красный, светлое — золото."""
    base = Image.open(MEDALS / f'{src}.webp').convert('RGBA')
    gray = ImageOps.grayscale(base.convert('RGB'))
    col = ImageOps.colorize(gray, black='#160a26', mid='#c8401c', white='#fff3b8', midpoint=110).convert('RGBA')
    out = base.copy()
    out.paste(col, (0, 0), disc_mask(base.width))
    return out


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


for name, image in [
    ('secret-festival-bonfire', fire('secret-festival-ferragosto')),
    ('secret-festival-carnival', hue('secret-festival-carnevale', 200, 1.3)),
]:
    image.save(MEDALS / f'{name}.webp', 'WEBP', quality=82, method=6)
    print(f'{name}.webp', image.size)
