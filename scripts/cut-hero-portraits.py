"""
Портреты путника для диалогов: docs/design/hero-m.jpg и hero-f.jpg (промт — docs/design/hero-portrait-prompt.md).
Вырезается бюст с капюшоном в пропорциях игрового портрета 14:18 (фонарь и низ накидки уходят за край: в 40 пикселях
главное — силуэт капюшона), размер 168×216, как у портретов жителей. Путник один на оба языка.
Запуск: python3 scripts/cut-hero-portraits.py (нужен Pillow).
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
RATIO = 14 / 18
# Доли картинки: верх рамки и её высота, центр по горизонтали — капюшон.
TOP, HEIGHT, CENTER = 0.03, 0.80, 0.50

for g in ['m', 'f']:
    im = Image.open(ROOT / 'docs' / 'design' / f'hero-{g}.jpg').convert('RGB')
    w, h = im.size
    ch = round(h * HEIGHT)
    cw = round(ch * RATIO)
    x = min(max(0, round(w * CENTER - cw / 2)), w - cw)
    y = round(h * TOP)
    out = im.crop((x, y, x + cw, y + ch)).resize((168, 216), Image.LANCZOS)
    out.save(ROOT / 'src' / 'assets' / 'hero' / f'hero-{g}.webp', 'WEBP', quality=88, method=6)
    print(f'hero-{g}', (x, y, x + cw, y + ch))
