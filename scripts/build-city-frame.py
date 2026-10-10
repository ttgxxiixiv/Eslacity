"""Рамка карты города на главной: та же, что у блока с просьбами (`src/assets/home/quest.webp`), без кожаной середины.

Кожа, окно портрета и стрелка внутри рамки вырезаются (становятся прозрачными), остаются брус с бронзой, скалки
по бокам и драконьи головы в углах. `CityGrid` растягивает её на карту через `border-image` (`.city-frame` в
`src/index.css`): углы с драконами как есть, брус и скалки тянутся. Запуск: python3 scripts/build-city-frame.py
"""
from pathlib import Path

from PIL import Image, ImageDraw

HOME = Path(__file__).resolve().parent.parent / 'src/assets/home'
# Кожаная середина на картинке 540×228: между тёмными внутренними кромками рамки.
INNER = (43, 33, 500, 196)

im = Image.open(HOME / 'quest.webp').convert('RGBA')
alpha = im.getchannel('A')
ImageDraw.Draw(alpha).rectangle(INNER, fill=0)
im.putalpha(alpha)
im.save(HOME / 'city-frame.webp', 'WEBP', quality=90, method=6)
print('city-frame.webp', im.size)
