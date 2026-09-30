"""Дневной переход (замена сердечек дневной цели): картинки из `docs/design/daily-road.png`.

Лист нарисован на пурпурном фоне (#FF00FF). Скрипт находит элементы как связные области не-фона, снимает фон
с мягким краем (у свечения костра и фонаря розовый ореол убирается вычитанием фона) и сохраняет в
`src/assets/home/road-*.webp` в тройном размере от показа. Запуск: python3 scripts/build-road-art.py
"""
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'docs' / 'design' / 'daily-road.png'
OUT = ROOT / 'src' / 'assets' / 'home'
KEY = np.array([255.0, 0.0, 255.0])
# «Пурпурность» пикселя: насколько красный и синий оба выше зелёного. У фона около 255, у розового ореола
# свечения около 90, у серого камня и оранжевого огня 0 и меньше. Выше M_BG — фон, ниже M_SOLID — непрозрачно.
M_SOLID, M_BG = 40.0, 110.0

img = np.asarray(Image.open(SRC).convert('RGB')).astype(np.float64)
magenta = np.minimum(img[..., 0], img[..., 2]) - img[..., 1]
alpha = np.clip((M_BG - magenta) / (M_BG - M_SOLID), 0, 1)
# Цвет без примеси фона: p = a*c + (1-a)*KEY.
safe = np.maximum(alpha, 1e-3)[..., None]
color = np.clip((img - (1 - alpha[..., None]) * KEY) / safe, 0, 255)
# На полупрозрачном крае остатки пурпура: синий не выше зелёного, ореол огня остаётся тёплым.
edge = alpha < 1
color[..., 2] = np.where(edge, np.minimum(color[..., 2], color[..., 1]), color[..., 2])
rgba = np.dstack([color, alpha * 255]).astype(np.uint8)

mask = cv2.dilate((alpha > 0.05).astype(np.uint8), np.ones((13, 13), np.uint8))
_, _, stats, _ = cv2.connectedComponentsWithStats(mask)
boxes = [
    (slice(y, y + h), slice(x, x + w))
    for x, y, w, h, area in stats[1:]
    if w * h > 2000
]
# Две полосы дороги (широкие) сверху вниз, под ними пять элементов слева направо.
wide = sorted([b for b in boxes if b[1].stop - b[1].start > 800], key=lambda b: b[0].start)
boxes = wide + sorted([b for b in boxes if b[1].stop - b[1].start <= 800], key=lambda b: b[1].start)
names = ['road-empty', 'road-full', 'road-stone', 'road-stone-lit', 'road-walker', 'road-fire-out', 'road-fire-lit']
assert len(boxes) == len(names), f'найдено элементов: {len(boxes)}'


def tight(b):
    """Рамка вплотную к непрозрачным пикселям."""
    ys, xs = np.nonzero(alpha[b] > 0.05)
    return (slice(b[0].start + ys.min(), b[0].start + ys.max() + 1), slice(b[1].start + xs.min(), b[1].start + xs.max() + 1))


boxes = [tight(b) for b in boxes]
# Пустая и пройденная дорога должны совпасть пиксель в пиксель: общая ширина, одинаковая высота.
(y0, x0), (y1, x1) = boxes[0], boxes[1]
x = slice(min(x0.start, x1.start), max(x0.stop, x1.stop))
h = max(y0.stop - y0.start, y1.stop - y1.start)
boxes[0] = (slice(y0.start, y0.start + h), x)
boxes[1] = (slice(y1.start, y1.start + h), x)
# Высота в пикселях картинки: тройной размер от показа.
HEIGHT = {'road-empty': 39, 'road-full': 39, 'road-stone': 36, 'road-stone-lit': 36, 'road-walker': 54, 'road-fire-out': 66, 'road-fire-lit': 66}

# Погасший костёр без дыма ниже горящего: оба в одном масштабе, иначе погасший выйдет крупнее.
SAME_SCALE = {'road-fire-out': 'road-fire-lit'}
src_h = {name: b[0].stop - b[0].start for name, b in zip(names, boxes)}

for name, (ys, xs) in zip(names, boxes):
    part = Image.fromarray(rgba[ys, xs], 'RGBA')
    ref = SAME_SCALE.get(name, name)
    k = HEIGHT[ref] / src_h[ref]
    h = round(part.height * k)
    w = round(part.width * k)
    part.resize((w, h), Image.LANCZOS).save(OUT / f'{name}.webp', 'WEBP', quality=92, method=6)
    print(name, (xs.start, ys.start, xs.stop, ys.stop), '->', (w, h))
