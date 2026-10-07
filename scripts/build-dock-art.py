"""Медальоны кнопок главной (задача 14.1): лист `docs/design/home-dock.png` (промт — `docs/design/home-dock-prompt.md`).

Лист нарисован на пурпурном фоне (#FF00FF); с 2.133.0 — в живописной манере медалей, прежний пиксельный — `docs/design/home-dock-pixel.png`. Скрипт снимает фон, находит медальоны как связные области не-фона,
раскладывает их слева направо, сверху вниз и сохраняет в `src/assets/dock/<кнопка>.webp` квадратом в тройном
размере от показа (кнопка на главной — 52 px). Запуск: python3 scripts/build-dock-art.py
"""
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'docs' / 'design' / 'home-dock.png'
OUT = ROOT / 'src' / 'assets' / 'dock'
# Порядок на листе — как в промте.
NAMES = ['review', 'journey', 'grammar', 'blitz', 'festival', 'placement', 'empty']
SIZE = 156
KEY = np.array([255.0, 0.0, 255.0])
M_SOLID, M_BG = 40.0, 110.0


def keyed(path: Path):
    img = np.asarray(Image.open(path).convert('RGB')).astype(np.float64)
    magenta = np.minimum(img[..., 0], img[..., 2]) - img[..., 1]
    a = np.clip((M_BG - magenta) / (M_BG - M_SOLID), 0, 1)
    safe = np.maximum(a, 1e-3)[..., None]
    color = np.clip((img - (1 - a[..., None]) * KEY) / safe, 0, 255)
    edge = a < 1
    color[..., 2] = np.where(edge, np.minimum(color[..., 2], color[..., 1]), color[..., 2])
    return np.dstack([color, a * 255]).astype(np.uint8), a


def main():
    rgba, a = keyed(SRC)
    n, _, stats, _ = cv2.connectedComponentsWithStats((a > 0.5).astype(np.uint8), connectivity=8)
    # Медальоны крупные: мелкие пятна (шум сжатия) отбрасываются.
    boxes = [tuple(stats[i][:4]) for i in range(1, n) if stats[i][4] > 5000]
    # Лишние медальоны в конце листа (второй пустой) не нужны; меньше — ошибка.
    if len(boxes) < len(NAMES):
        raise SystemExit(f'медальонов {len(boxes)}, ожидалось не меньше {len(NAMES)}')
    # Ряды: по верхнему краю с допуском в половину высоты медальона, внутри ряда — слева направо.
    h = max(b[3] for b in boxes)
    boxes.sort(key=lambda b: (round(b[1] / (h / 2)), b[0]))
    OUT.mkdir(parents=True, exist_ok=True)
    for name, (x, y, w, hh) in zip(NAMES, boxes):
        side = max(w, hh)
        crop = Image.fromarray(rgba).crop((x - (side - w) // 2, y - (side - hh) // 2, x - (side - w) // 2 + side, y - (side - hh) // 2 + side))
        crop.resize((SIZE, SIZE), Image.LANCZOS).save(OUT / f'{name}.webp', 'WEBP', quality=90, method=6)
        print(f'{name}: {w}x{hh}')


if __name__ == '__main__':
    main()
