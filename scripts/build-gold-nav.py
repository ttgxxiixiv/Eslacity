"""Золотой медальон меню для финала (задача 8.3): `nav-<язык>-gold.webp` из `nav-<язык>.webp`.

Камень купола с рунами (серые пиксели в круге медальона) перекрашивается в золото по яркости,
глаз-флаг (насыщенные цвета) и прозрачность не трогаются. Запуск: python3 scripts/build-gold-nav.py
"""
import colorsys
from pathlib import Path

from PIL import Image

NAV = Path(__file__).resolve().parent.parent / 'src' / 'assets' / 'nav'
# Круг медальона на картинке 768×288. Внизу купол сходится к стержню: по краям там уже полоса меню.
CX, CY, R = 383, 63, 61
BOTTOM, SLOPE = 22, 1.25
# Глаз-флаг: внутри этого эллипса ничего не перекрашивается (белая полоса и зрачок тоже).
EX, EY, ERX, ERY = 383, 66, 41, 18
# Золото от тёмной бронзы к светлому блику.
STOPS = [(0.0, (58, 36, 8)), (0.35, (140, 92, 22)), (0.6, (214, 164, 52)), (0.8, (240, 200, 90)), (1.0, (255, 243, 190))]


def gold(l: float) -> tuple[int, int, int]:
    for (a, ca), (b, cb) in zip(STOPS, STOPS[1:]):
        if l <= b:
            t = (l - a) / (b - a)
            return tuple(round(x + (y - x) * t) for x, y in zip(ca, cb))
    return STOPS[-1][1]


def build(lang: str) -> None:
    im = Image.open(NAV / f'nav-{lang}.webp').convert('RGBA')
    px = im.load()
    for y in range(max(0, CY - R), CY + R + 1):
        for x in range(CX - R, CX + R + 1):
            if (x - CX) ** 2 + (y - CY) ** 2 > R * R:
                continue
            if abs(x - CX) > R - max(0, y - CY - BOTTOM) * SLOPE:
                continue
            if ((x - EX) / ERX) ** 2 + ((y - EY) / ERY) ** 2 < 1:
                continue
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
            # Камень тёмный: растягиваем яркость, чтобы золото не было грязным.
            nr, ng, nb = gold(min(1.0, l * 1.7))
            px[x, y] = (nr, ng, nb, a)
    im.save(NAV / f'nav-{lang}-gold.webp', 'WEBP', quality=90, method=6)


for lang in ('es', 'it'):
    build(lang)
