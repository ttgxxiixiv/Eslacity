"""Украшения города (задача 9.3): значки из `docs/design/decor.png` и карта с украшениями из `docs/design/city-decor.png`
(промты — `docs/design/city-decor-prompt.md`).

Лист: 12 украшений сеткой 4 × 3 на прозрачном фоне с полупрозрачным свечением. Порядок — как `DECOR` в
`src/domain/decor.ts`. В каждой клетке берётся самая крупная плотная область (сам предмет), свечение снимается:
на экране его даёт тень CSS. Значки — `src/assets/decor/<линия>.webp` высотой 96 px.

Карта: та же `city-lit.webp` с украшениями у 12 зданий, сетка совпадает (проверено наложением, сдвиг не больше
пикселя). Приводится к размеру карты 891 × 1108 — `src/assets/city-decor.webp`.

Запуск: python3 scripts/build-decor-art.py
"""
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SHEET = ROOT / 'docs' / 'design' / 'decor.png'
MAP = ROOT / 'docs' / 'design' / 'city-decor.png'
OUT = ROOT / 'src' / 'assets'
LINES = ['words', 'grammar', 'streak', 'cartographer', 'builder', 'friend', 'courier', 'trials', 'listener', 'blitz', 'typed', 'echo']
COLS, ROWS = 4, 3
SOLID = 200  # прозрачность предмета; свечение ниже
HEIGHT = 96
MAP_SIZE = (891, 1108)


def icons():
    img = np.asarray(Image.open(SHEET).convert('RGBA'))
    h, w = img.shape[:2]
    cw, ch = w // COLS, h // ROWS
    (OUT / 'decor').mkdir(exist_ok=True)
    for k, line in enumerate(LINES):
        cell = img[(k // COLS) * ch:(k // COLS + 1) * ch, (k % COLS) * cw:(k % COLS + 1) * cw].copy()
        solid = (cell[..., 3] >= SOLID).astype(np.uint8)
        # Части предмета (столбы гирлянды, пара фонарей) могут не касаться друг друга: склеиваем близкие области.
        joined = cv2.dilate(solid, np.ones((15, 15), np.uint8))
        n, labels, stats, _ = cv2.connectedComponentsWithStats(joined)
        big = 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))
        keep = (labels == big) & (solid > 0)
        alpha = np.where(keep, cell[..., 3], 0).astype(np.uint8)
        # Мягкий край: полупрозрачная кайма в 1 px вокруг предмета остаётся.
        edge = cv2.dilate(keep.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
        alpha = np.where(edge & ~keep, cell[..., 3] // 2, alpha).astype(np.uint8)
        cell[..., 3] = alpha
        ys, xs = np.nonzero(alpha)
        crop = Image.fromarray(cell[ys.min():ys.max() + 1, xs.min():xs.max() + 1])
        out = crop.resize((round(crop.width * HEIGHT / crop.height), HEIGHT), Image.LANCZOS)
        out.save(OUT / 'decor' / f'{line}.webp', quality=90)
        print(line, out.size)


def city():
    Image.open(MAP).convert('RGB').resize(MAP_SIZE, Image.LANCZOS).save(OUT / 'city-decor.webp', quality=85)
    print('city-decor.webp', MAP_SIZE)


if __name__ == '__main__':
    icons()
    city()
