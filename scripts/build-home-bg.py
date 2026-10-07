"""Фоны главной по главам: `src/assets/home/bg-<глава>.webp` из `docs/design/home-bg-<глава>.jpg`.

Картины нарисованы по промтам `docs/design/home-backgrounds-prompt.md` (пять земель глав и Хранилище — `vault`,
фон после Эликсира). Скрипт только ужимает их в webp: размер тот же (768×1376), этого хватает для фона
под интерфейсом, а precache растёт меньше. Запуск: python3 scripts/build-home-bg.py
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'docs' / 'design'
OUT = ROOT / 'src' / 'assets' / 'home'
NAMES = ['1', '2', '3', '4', '5', 'vault']

for name in NAMES:
    im = Image.open(SRC / f'home-bg-{name}.jpg').convert('RGB')
    path = OUT / f'bg-{name}.webp'
    im.save(path, 'WEBP', quality=70, method=6)
    print(path.relative_to(ROOT), im.size, f'{path.stat().st_size // 1024} КБ')
