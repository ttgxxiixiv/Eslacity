"""Тайная медаль «Страница летописи» (задача 13.8): оправа тайной медали и свиток с пером в её круге.

В листе `docs/design/medal-secrets.png` для неё нет картинки, поэтому скрипт собирает её из готовых:
оправа — `secret-flawless.webp` (звезда внутри стирается), свиток с пером — центр медальона `dock/grammar.webp`.
Запуск: python3 scripts/build-diary-medal.py
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
MEDALS = ROOT / 'src/assets/medals'

# Круг внутри оправы тайной медали (доли стороны картинки 192×192).
CX, CY, R = 0.5, 0.43, 0.268

base = Image.open(MEDALS / 'secret-flawless.webp').convert('RGBA')
size = base.width
book = Image.open(ROOT / 'src/assets/dock/grammar.webp').convert('RGBA')
# Центр медальона «Правила» без его оправы.
bw = book.width
inner = book.crop((int(bw * 0.17), int(bw * 0.17), int(bw * 0.83), int(bw * 0.83)))
d = int(2 * R * size)
inner = inner.resize((d, d), Image.LANCZOS)
mask = Image.new('L', (d, d), 0)
ImageDraw.Draw(mask).ellipse((0, 0, d - 1, d - 1), fill=255)
# Золотой фон круга под свитком с пером.
disc = Image.new('RGBA', (d, d), (214, 160, 70, 255))
disc.alpha_composite(inner)
x, y = int(CX * size - d / 2), int(CY * size - d / 2)
base.paste(disc, (x, y), mask)
base.save(MEDALS / 'secret-diary.webp', 'WEBP', quality=82, method=6)
print('secret-diary.webp', base.size)
