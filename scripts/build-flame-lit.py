"""Горящий огонёк стрика: `src/assets/home/flame-lit.webp` из серого `flame.webp` (он вырезан из макета серым).

Серые пиксели перекрашиваются по яркости: тёмные — в тёмно-красный, средние — в оранжевый, светлые — в жёлтый.
Прозрачность не трогается. Запуск: python3 scripts/build-flame-lit.py
"""
import colorsys
from pathlib import Path

from PIL import Image

HOME = Path(__file__).resolve().parent.parent / 'src' / 'assets' / 'home'
STOPS = [(0.0, (70, 12, 4)), (0.3, (170, 36, 10)), (0.55, (236, 104, 24)), (0.8, (255, 190, 60)), (1.0, (255, 246, 200))]


def fire(l: float) -> tuple[int, int, int]:
    for (a, ca), (b, cb) in zip(STOPS, STOPS[1:]):
        if l <= b:
            t = (l - a) / (b - a)
            return tuple(round(x + (y - x) * t) for x, y in zip(ca, cb))
    return STOPS[-1][1]


im = Image.open(HOME / 'flame.webp').convert('RGBA')
px = im.load()
for y in range(im.height):
    for x in range(im.width):
        r, g, b, a = px[x, y]
        if a == 0:
            continue
        _, l, _ = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
        px[x, y] = (*fire(l), a)
im.save(HOME / 'flame-lit.webp', 'WEBP', lossless=True)
