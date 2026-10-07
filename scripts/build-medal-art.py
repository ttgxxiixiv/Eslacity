"""Медали (промты — `docs/design/medals-prompt.md`): оправы ступеней `docs/design/medal-frames.png`, эмблемы линий
`docs/design/medal-emblems.png` и тайные медали `docs/design/medal-secrets.png`.

Листы нарисованы на пурпурном фоне (#FF00FF) сеткой: каждая медаль в своей ячейке (искры у книги и молнии — отдельные
пятна, поэтому делим по ячейкам, а не по связным областям). Скрипт снимает фон и сохраняет в `src/assets/medals/`
квадраты в тройном размере от самого крупного показа (64 px): оправа и тайная медаль вписаны по высоте (лента снизу),
эмблема — по большей стороне. Для каждой оправы считается, где центр её пустого круга и какого он размера:
`src/assets/medals/frames.json` (доли стороны квадрата), по нему код кладёт эмблему.
Запуск: python3 scripts/build-medal-art.py
"""
import json
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
DESIGN = ROOT / 'docs' / 'design'
OUT = ROOT / 'src' / 'assets' / 'medals'
SIZE = 192
KEY = np.array([255.0, 0.0, 255.0])
M_SOLID, M_BG = 40.0, 110.0

TIERS = ['wood', 'stone', 'bronze', 'silver', 'gold', 'diamond']
LINES = ['words', 'streak', 'grammar', 'cartographer', 'friend', 'courier', 'blitz', 'typed', 'builder', 'trials', 'listener', 'echo']
SECRETS = ['saved-streak', 'flawless', 'midnight', 'labyrinth', 'sphinx', 'keeper',
           'festival-sanfermin', 'festival-tomatina', 'festival-ferragosto', 'festival-carnevale']


def keyed(path: Path):
    img = np.asarray(Image.open(path).convert('RGB')).astype(np.float64)
    magenta = np.minimum(img[..., 0], img[..., 2]) - img[..., 1]
    a = np.clip((M_BG - magenta) / (M_BG - M_SOLID), 0, 1)
    safe = np.maximum(a, 1e-3)[..., None]
    color = np.clip((img - (1 - a[..., None]) * KEY) / safe, 0, 255)
    edge = a < 1
    color[..., 2] = np.where(edge, np.minimum(color[..., 2], color[..., 1]), color[..., 2])
    return np.dstack([color, a * 255]).astype(np.uint8), a


def cells(path: Path, cols: int, rows: int):
    """Элементы листа по ячейкам сетки: RGBA-кусок по рамке непрозрачного внутри ячейки."""
    rgba, a = keyed(path)
    h, w = a.shape
    out = []
    for r in range(rows):
        for c in range(cols):
            y0, y1, x0, x1 = r * h // rows, (r + 1) * h // rows, c * w // cols, (c + 1) * w // cols
            m = a[y0:y1, x0:x1] > 0.5
            ys, xs = np.where(m)
            if not len(ys):
                raise SystemExit(f'{path.name}: пустая ячейка {r},{c}')
            out.append(rgba[y0 + ys.min(): y0 + ys.max() + 1, x0 + xs.min(): x0 + xs.max() + 1])
    return out


def square(piece: np.ndarray, by_height: bool) -> tuple[Image.Image, float, int, int]:
    """Квадрат SIZE×SIZE: кусок вписан (по высоте или по большей стороне) и стоит по центру. Масштаб и сдвиг — для оправ."""
    h, w = piece.shape[:2]
    scale = SIZE / (h if by_height else max(h, w))
    img = Image.fromarray(piece).resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
    canvas = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    ox, oy = (SIZE - img.width) // 2, (SIZE - img.height) // 2
    canvas.alpha_composite(img, (ox, oy))
    return canvas, scale, ox, oy


def disc(piece: np.ndarray) -> tuple[float, float, float]:
    """Пустой тёмный круг оправы: центр и радиус в пикселях куска. Центр — середина круглой части (квадрат по ширине
    сверху), радиус — медиана восьми лучей от центра до первого светлого пикселя оправы."""
    lum = piece[..., :3].astype(np.float64).mean(axis=2)
    h, w = lum.shape
    cx = cy = w / 2
    dists = []
    for k in range(8):
        dx, dy = np.cos(k * np.pi / 4), np.sin(k * np.pi / 4)
        for d in range(5, w // 2):
            x, y = int(cx + dx * d), int(cy + dy * d)
            # Светлый металл, камень или дерево оправы: три пикселя подряд ярче фона круга.
            if all(lum[int(cy + dy * (d + i)), int(cx + dx * (d + i))] > 95 for i in range(3)):
                dists.append(d)
                break
    return cx, cy, float(np.median(dists))


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    frames = {}
    for tier, piece in zip(TIERS, cells(DESIGN / 'medal-frames.png', 3, 2)):
        img, scale, ox, oy = square(piece, by_height=True)
        cx, cy, r = disc(piece)
        frames[tier] = {'x': round((ox + cx * scale) / SIZE, 4), 'y': round((oy + cy * scale) / SIZE, 4), 'r': round(r * scale / SIZE, 4)}
        img.save(OUT / f'frame-{tier}.webp', 'WEBP', quality=80, method=6)
    (OUT / 'frames.json').write_text(json.dumps(frames, indent=2) + '\n')
    for line, piece in zip(LINES, cells(DESIGN / 'medal-emblems.png', 4, 3)):
        square(piece, by_height=False)[0].save(OUT / f'emblem-{line}.webp', 'WEBP', quality=80, method=6)
    for sid, piece in zip(SECRETS, cells(DESIGN / 'medal-secrets.png', 5, 2)):
        square(piece, by_height=True)[0].save(OUT / f'secret-{sid}.webp', 'WEBP', quality=80, method=6)
    print(json.dumps(frames))


if __name__ == '__main__':
    main()
