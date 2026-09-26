"""
Правка пиксельного шрифта Tiny5 (кириллица): у заглавных Ь, Ъ, Ы брюшко в исходном шрифте в три пикселя
из пяти, и на экране буква выглядит обрезанной сверху. Здесь брюшко в четыре пикселя.

Запуск (нужен fontTools: pip install fonttools brotli):
    python3 scripts/patch-tiny5.py
Берёт шрифт из node_modules/@fontsource/tiny5, пишет src/assets/fonts/tiny5-cyrillic-400-normal.woff2 и .woff.
Лицензия шрифта — SIL OFL 1.1: изменённая версия распространяется под той же лицензией.
"""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.ttGlyphPen import TTGlyphPen

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'node_modules/@fontsource/tiny5/files/tiny5-cyrillic-400-normal.woff2'
OUT = ROOT / 'src/assets/fonts'
PX = 128  # один пиксель шрифта в единицах em (1024 / 8)

# Сверху вниз, пять строк высоты заглавной буквы.
GLYPHS = {
    'Ь': ['#...',
          '###.',
          '#..#',
          '#..#',
          '###.'],
    'Ъ': ['##....',
          '.###..',
          '.#..#.',
          '.#..#.',
          '.###..'],
    'Ы': ['#....#',
          '###..#',
          '#..#.#',
          '#..#.#',
          '###..#'],
}


def draw(rows, glyphs):
    pen = TTGlyphPen(glyphs)
    for i, row in enumerate(rows):
        y0 = (len(rows) - 1 - i) * PX
        x = 0
        while x < len(row):
            if row[x] != '#':
                x += 1
                continue
            start = x
            while x < len(row) and row[x] == '#':
                x += 1
            # Прямоугольник по часовой стрелке, как контуры исходного шрифта.
            pen.moveTo((start * PX, y0))
            pen.lineTo((start * PX, y0 + PX))
            pen.lineTo((x * PX, y0 + PX))
            pen.lineTo((x * PX, y0))
            pen.closePath()
    return pen.glyph()


font = TTFont(SRC)
cmap = font.getBestCmap()
glyf = font['glyf']
for ch, rows in GLYPHS.items():
    name = cmap[ord(ch)]
    g = draw(rows, font.getGlyphSet())
    glyf[name] = g
    g.recalcBounds(glyf)
    width, _ = font['hmtx'][name]
    font['hmtx'][name] = (width, g.xMin)
OUT.mkdir(parents=True, exist_ok=True)
for flavor in ('woff2', 'woff'):
    font.flavor = flavor
    font.save(OUT / f'tiny5-cyrillic-400-normal.{flavor}')
print('готово:', ', '.join(GLYPHS))
