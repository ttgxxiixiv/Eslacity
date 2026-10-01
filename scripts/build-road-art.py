"""Дневной переход (замена сердечек дневной цели): картинки из `docs/design/daily-road.png`, накидки путника —
из `docs/design/cloaks.png` (промт — `docs/design/cloaks-prompt.md`).

Листы нарисованы на пурпурном фоне (#FF00FF). Скрипт находит элементы как связные области не-фона, снимает фон
с мягким краем (у свечения костра и фонаря розовый ореол убирается вычитанием фона) и сохраняет в
`src/assets/home/road-*.webp` в тройном размере от показа. Запуск: python3 scripts/build-road-art.py
"""
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'docs' / 'design' / 'daily-road.png'
CLOAKS_SRC = ROOT / 'docs' / 'design' / 'cloaks.png'
OUT = ROOT / 'src' / 'assets' / 'home'
KEY = np.array([255.0, 0.0, 255.0])
# «Пурпурность» пикселя: насколько красный и синий оба выше зелёного. У фона около 255, у розового ореола
# свечения около 90, у серого камня и оранжевого огня 0 и меньше. Выше M_BG — фон, ниже M_SOLID — непрозрачно.
M_SOLID, M_BG = 40.0, 110.0



def keyed(path: Path):
    """Лист без пурпурного фона: RGBA и прозрачность 0–1."""
    img = np.asarray(Image.open(path).convert('RGB')).astype(np.float64)
    magenta = np.minimum(img[..., 0], img[..., 2]) - img[..., 1]
    a = np.clip((M_BG - magenta) / (M_BG - M_SOLID), 0, 1)
    # Цвет без примеси фона: p = a*c + (1-a)*KEY.
    safe = np.maximum(a, 1e-3)[..., None]
    color = np.clip((img - (1 - a[..., None]) * KEY) / safe, 0, 255)
    # На полупрозрачном крае остатки пурпура: синий не выше зелёного, ореол огня остаётся тёплым.
    edge = a < 1
    color[..., 2] = np.where(edge, np.minimum(color[..., 2], color[..., 1]), color[..., 2])
    return np.dstack([color, a * 255]).astype(np.uint8), a


def find(a):
    """Элементы листа: рамки связных областей не-фона."""
    mask = cv2.dilate((a > 0.05).astype(np.uint8), np.ones((13, 13), np.uint8))
    _, _, stats, _ = cv2.connectedComponentsWithStats(mask)
    return [(slice(y, y + h), slice(x, x + w)) for x, y, w, h, area in stats[1:] if w * h > 2000]


rgba, alpha = keyed(SRC)
boxes = find(alpha)
# Две полосы дороги (широкие) сверху вниз, под ними пять элементов слева направо.
wide = sorted([b for b in boxes if b[1].stop - b[1].start > 800], key=lambda b: b[0].start)
boxes = wide + sorted([b for b in boxes if b[1].stop - b[1].start <= 800], key=lambda b: b[1].start)
names = ['road-empty', 'road-full', 'road-stone', 'road-stone-lit', 'road-walker', 'road-fire-out', 'road-fire-lit']
assert len(boxes) == len(names), f'найдено элементов: {len(boxes)}'


def tight(b, a=None):
    """Рамка вплотную к непрозрачным пикселям."""
    ys, xs = np.nonzero((alpha if a is None else a)[b] > 0.05)
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

# Накидки путника (награды уровней героя, задача 9.2): лист 4×2, от мешковины до парчи слева направо, сверху вниз.
# Все в одном масштабе — по самому высокому путнику, высота как у путника дороги; ширина у накидок разная (опушка
# парчи, бахрома мешковины), поэтому на экране картинка ставится по высоте, ширина своя.
CLOAKS = ['sackcloth', 'homespun', 'linen', 'broadcloth', 'leather', 'velvet', 'silk', 'brocade']
c_rgba, c_alpha = keyed(CLOAKS_SRC)
c_boxes = [tight(b, c_alpha) for b in find(c_alpha)]
assert len(c_boxes) == len(CLOAKS), f'найдено накидок: {len(c_boxes)}'
# Ряды по вертикали, в ряду — слева направо.
top = min(b[0].start for b in c_boxes)
c_boxes.sort(key=lambda b: (b[0].start - top > 200, b[1].start))
k = HEIGHT['road-walker'] / max(b[0].stop - b[0].start for b in c_boxes)
for cid, (ys, xs) in zip(CLOAKS, c_boxes):
    part = Image.fromarray(c_rgba[ys, xs], 'RGBA')
    size = (round(part.width * k), round(part.height * k))
    part.resize(size, Image.LANCZOS).save(OUT / f'road-walker-{cid}.webp', 'WEBP', quality=92, method=6)
    print(f'road-walker-{cid}', (xs.start, ys.start, xs.stop, ys.stop), '->', size)
