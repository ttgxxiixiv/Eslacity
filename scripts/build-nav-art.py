"""Нижнее меню в рисованном стиле (к задаче 14.2): ряд ячеек и медальоны с глазом.

Источники — `docs/design/nav-wow-strip.png` (ряд на белом фоне) и `docs/design/nav-wow-eyes.png` (четыре медальона
на пурпурном фоне: испанский, итальянский, золотой испанский, золотой итальянский), промт — `docs/design/nav-wow-prompt.md`.
Белый фон вокруг ряда снимается заливкой от краёв (белые места внутри, перо и бумага, остаются), ряд обрезается
по камню и ужимается до ширины 1536. Медальоны ищутся по столбцам без пурпура, вырезаются кругом.
Запуск: python3 scripts/build-nav-art.py
"""
from collections import deque
from pathlib import Path

import json

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
DESIGN = ROOT / 'docs/design'
OUT = ROOT / 'src/assets/nav'
STRIP_W = 1536
EYE = 160
# Ряд на картинке выше прежнего (2.8:1 вместо 4.2:1). Чтобы меню было не выше 13–14% экрана, из пустой полосы под
# подписью и из нижнего каменного края вырезаются ровные полосы строк (координаты — после ужатия до 1536),
# а ряд чуть сжимается по высоте.
CUTS = [(435, 470), (520, 535)]
SQUASH = 0.88
# Геометрия на ряду шириной 1536 до вырезания: ячейки, полоса подписи между бронзовыми линиями, гнездо медальона.
TILES = [(0, 384), (384, 768), (768, 1152), (1152, 1536)]
LABEL = (405, 501)
SOCKET = {'x': 768, 'y': 48, 'r': 45}


def shift(y: float) -> float:
    """Строка после вырезания полос и сжатия."""
    cut = sum(min(max(y - a, 0), b - a) for a, b in CUTS)
    return round((y - cut) * SQUASH, 1)


def strip() -> None:
    im = Image.open(DESIGN / 'nav-wow-strip.png').convert('RGB')
    a = np.asarray(im).astype(int)
    h, w, _ = a.shape
    light = (a.min(axis=2) > 225) & (a.max(axis=2) - a.min(axis=2) < 24)
    bg = np.zeros((h, w), bool)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if light[y, x] and not bg[y, x]:
                bg[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if light[y, x] and not bg[y, x]:
                bg[y, x] = True
                q.append((y, x))
    while q:
        y, x = q.popleft()
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= ny < h and 0 <= nx < w and light[ny, nx] and not bg[ny, nx]:
                bg[ny, nx] = True
                q.append((ny, nx))
    rgba = np.dstack([a, np.where(bg, 0, 255)]).astype(np.uint8)
    out = Image.fromarray(rgba, 'RGBA')
    out = out.crop(out.getbbox())
    out = out.resize((STRIP_W, round(out.height * STRIP_W / out.width)), Image.LANCZOS)
    keep = np.ones(out.height, bool)
    for a0, b0 in CUTS:
        keep[a0:b0] = False
    rows = np.asarray(out)[keep]
    out = Image.fromarray(rows, 'RGBA')
    out = out.resize((STRIP_W, round(out.height * SQUASH)), Image.LANCZOS)
    out.save(OUT / 'nav-strip.webp', 'WEBP', quality=86, method=6)
    geometry = {
        'w': out.width,
        'h': out.height,
        'tiles': TILES,
        'label': [shift(LABEL[0]), shift(LABEL[1])],
        'eye': {'x': SOCKET['x'], 'y': shift(SOCKET['y']), 'r': round(SOCKET['r'] * SQUASH, 1)},
    }
    (OUT / 'nav-strip.json').write_text(json.dumps(geometry) + '\n')
    print('nav-strip.webp', out.size, geometry)


def eyes() -> None:
    im = Image.open(DESIGN / 'nav-wow-eyes.png').convert('RGB')
    a = np.asarray(im).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    magenta = (r > 180) & (b > 180) & (g < 90)
    cols = np.where((~magenta).sum(axis=0) > 10)[0]
    runs, start = [], cols[0]
    for p, c in zip(cols, cols[1:]):
        if c != p + 1:
            runs.append((start, p))
            start = c
    runs.append((start, cols[-1]))
    names = ['eye-es', 'eye-it', 'eye-es-gold', 'eye-it-gold']
    assert len(runs) == len(names), runs
    for name, (x0, x1) in zip(names, runs):
        rows = np.where((~magenta[:, x0:x1 + 1]).sum(axis=1) > 10)[0]
        y0, y1 = rows[0], rows[-1]
        d = max(x1 - x0, y1 - y0) + 1
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        box = (round(cx - d / 2), round(cy - d / 2), round(cx + d / 2), round(cy + d / 2))
        piece = im.crop(box).resize((EYE * 2, EYE * 2), Image.LANCZOS).convert('RGBA')
        mask = Image.new('L', piece.size, 0)
        ImageDraw.Draw(mask).ellipse((2, 2, piece.width - 3, piece.height - 3), fill=255)
        piece.putalpha(mask)
        piece.resize((EYE, EYE), Image.LANCZOS).save(OUT / f'{name}.webp', 'WEBP', quality=86, method=6)
        print(f'{name}.webp', d)


if __name__ == '__main__':
    strip()
    eyes()
