# Промт для нижнего меню в рисованном стиле (к задаче 14.2)

С 2.155.0 меню компактное (`src/components/NavBar.tsx`): на экране только ряд из четырёх каменных ячеек и маленький медальон с глазом на верхнем крае ряда, по центру. Сейчас обе части вырезаются из старой пиксельной картинки `src/assets/nav/nav-<язык>.webp` (768×288). Этот промт — для новой картинки в духе World of Warcraft: та же суть меню, другая рисовка.

Генерировать лучше двумя картинками: ряд ячеек отдельно, медальоны отдельно. Так медальон не придётся вырезать из ряда, и ряд не будет отличаться у языков.

## Что изображено

| Ячейка | Раздел | Знак |
|---|---|---|
| 1 | Город | свиток карты с лабиринтом улиц и золотой розой ветров |
| 2 | Грамматика | раскрытая книга, гусиное перо и старый ключ крест-накрест, лавровый венок |
| 3 | Повтор | песочные часы в деревянной оправе, золотой песок, лёгкое голубое свечение |
| 4 | Профиль | путник в коричневом плаще с капюшоном и фонарём, лица не видно |

Медальоны: глаз дракона в каменном круге с рунами. Зрачок и радужка в цветах флага языка курса: у испанского красный и жёлтый, у итальянского зелёный, белый и красный. После Эликсира меню золотое, поэтому нужны ещё два золотых медальона с теми же глазами.

## Подписи

Генераторы портят кириллицу. Лучше рисовать ячейки без надписей, а «Город», «Грамматика», «Повтор», «Профиль» выводить кодом поверх картинки (небольшая правка `NavBar`: подписи — текст внизу ячейки шрифтом Tiny5). Если генератор пишет по-русски чисто, можно вставить в промт строку про подписи, она ниже отдельно.

## Промт 1: ряд ячеек

```
Bottom navigation bar for a mobile fantasy RPG, in the hand-painted stylized art style of World of Warcraft:
chunky exaggerated proportions, thick bold shapes, saturated warm colors, painterly textures with visible brush
strokes, strong rim light, soft ambient occlusion, readable silhouettes. Not pixel art, not photorealistic.

One long horizontal strip, exact aspect ratio 4.2:1 (for example 2016x480 pixels), fully filling the image edge to
edge. It is a slab of heavy carved grey-brown stone, like the wall of an old dwarven or human keep: large beveled
blocks, chipped edges, faint cracks, a little green moss and a few climbing ivy leaves on the left end. The strip
is divided into exactly 4 equal square-ish tiles separated by thin vertical carved grooves. Each tile is a slightly
recessed stone panel with a worn bronze trim, and the four tiles look identical in frame, size and lighting: no tile
is highlighted, selected or glowing more than the others.

In the centre of each tile, one emblem that fills about 55% of the tile height and stays readable at 70x70 pixels
on a phone. Keep the lower 20% of each tile empty and calm (a plain stone band) for a caption that will be added
later in code. Emblems, left to right:
1. A rolled parchment city map with a maze of streets and a small golden compass rose.
2. An open old book with a goose-feather quill and an ornate brass key crossed over it, framed by a laurel wreath.
3. An hourglass in a dark wooden frame with glowing golden sand and a faint blue magical swirl around it.
4. A hooded traveler in a long brown cloak holding a small glowing lantern, face hidden in shadow.

Leave the top centre of the strip, where tiles 2 and 3 meet, free of emblems: a round medallion will be placed
over that edge later. No text, no letters, no numbers, no UI icons, no frame around the whole image, no background
outside the stone.
```

Если генератор чисто пишет кириллицу, вместо фразы про пустую нижнюю полосу:

```
Under each emblem, carved into the stone and filled with pale gold, a caption in Russian, bold rounded letters:
1. ГОРОД  2. ГРАММАТИКА  3. ПОВТОР  4. ПРОФИЛЬ
```

## Промт 2: медальоны

```
Sheet of 4 round UI medallions for a mobile fantasy RPG, in the hand-painted stylized art style of World of
Warcraft: chunky shapes, saturated colors, painterly textures, strong rim light. Not pixel art.

The 4 medallions are in one row, all exactly the same size and perfectly circular, on a plain solid magenta
(#FF00FF) background with generous empty space between them. Each medallion is a thick ring of carved stone with
small glowing runes around it, and in the centre a large reptilian dragon eye with a vertical slit pupil, looking
straight at the viewer. The eye has a strong silhouette that stays readable at 44x44 pixels.

Left to right:
1. Grey stone ring, the iris in red and yellow bands like the flag of Spain, glowing softly.
2. Grey stone ring, the iris in green, white and red bands like the flag of Italy, glowing softly.
3. The same as 1, but the ring is polished gold with warm golden runes.
4. The same as 2, but the ring is polished gold with warm golden runes.

No text, no letters, no numbers, no shadow on the background.
```

## Что сделать после генерации

1. Положить ряд в `docs/design/nav-wow-strip.png`, медальоны — в `docs/design/nav-wow-eyes.png`.
2. Скрипт (по образцу `scripts/build-dock-art.py`) ужимает ряд до 1536×364, снимает пурпурный фон с медальонов, режет их по кругу и сохраняет в `src/assets/nav/`.
3. `NavBar` берёт ряд фоном `nav-art` целиком, без `backgroundSize` под старую картинку, а медальон — отдельной картинкой своего языка, золотой после Эликсира. Пропорция ряда в `--nav-h` (`index.css`) меняется с 768/182 на пропорцию новой картинки.
4. Если ячейки нарисованы без подписей — добавить их кодом и проверить сквозным тестом меню (`app.spec.ts`).

## Английский курс: медальоны с глазом (с 2.185.0)

С 2.186.0 медальоны английского готовы: `eye-en.webp` и `eye-en-gold.webp`, лист `docs/design/nav-wow-eyes-en.png`. Для следующих языков — два медальона в той же манере, что `nav-wow-eyes.png`: обычный и золотой (после Эликсира). Генерировать лучше с приложенным листом `docs/design/nav-wow-eyes.png` как образцом, чтобы кольцо, руны и масштаб глаза совпали.

```
Sheet of 2 round UI medallions for a mobile fantasy RPG, in the hand-painted stylized art style of World of
Warcraft: chunky shapes, saturated colors, painterly textures, strong rim light. Not pixel art. Match the attached
reference sheet exactly in ring shape, rune style, eye size and lighting.

The 2 medallions are in one row, exactly the same size and perfectly circular, on a plain solid magenta (#FF00FF)
background with generous empty space between them. Each medallion is a thick ring of carved stone with small
glowing runes around it, and in the centre a large reptilian dragon eye with a vertical slit pupil, looking
straight at the viewer. The iris is deep navy blue crossed by a bold red cross with thin white edges and white
diagonal rays, like the colours of the British Union Flag, glowing softly. The eye has a strong silhouette that
stays readable at 44x44 pixels.

Left to right:
1. Grey stone ring with pale blue glowing runes.
2. The same eye, but the ring is polished gold with warm golden runes.

No text, no letters, no numbers, no shadow on the background. Do not use magenta or bright pink in the medallions.
```

После генерации: лист — в `docs/design/nav-wow-eyes-<язык>.png`, в `scripts/build-nav-art.py` — вызов `eyes(...)` с именами `eye-<язык>` и `eye-<язык>-gold`, в `EYES` в `NavBar.tsx` — строка языка.

## Турецкий курс: медальоны с глазом

С 2.207.0 медальоны готовы: `eye-tr.webp` и `eye-tr-gold.webp`, лист `docs/design/nav-wow-eyes-tr.png`. Лист из двух медальонов, как у английского, генерировать с приложенным образцом `docs/design/nav-wow-eyes.png`.

```
Sheet of 2 round UI medallions for a mobile fantasy RPG, in the hand-painted stylized art style of World of
Warcraft: chunky shapes, saturated colors, painterly textures, strong rim light. Not pixel art. Match the attached
reference sheet exactly in ring shape, rune style, eye size and lighting.

The 2 medallions are in one row, exactly the same size and perfectly circular, on a plain solid magenta (#FF00FF)
background with generous empty space between them. Each medallion is a thick ring of carved stone with small
glowing runes around it, and in the centre a large reptilian dragon eye with a vertical slit pupil, looking
straight at the viewer. The iris is deep crimson red, and inside the iris, to the left of the pupil, a thin white
crescent moon with a small white five-pointed star beside it, like the colours of the flag of Turkey, glowing
softly. The eye has a strong silhouette that stays readable at 44x44 pixels.

Left to right:
1. Grey stone ring with pale turquoise glowing runes.
2. The same eye, but the ring is polished gold with warm golden runes.

No text, no letters, no numbers, no shadow on the background. Do not use magenta or bright pink in the medallions.
```

После генерации: лист — в `docs/design/nav-wow-eyes-tr.png`, в `scripts/build-nav-art.py` — `eyes('nav-wow-eyes-tr.png', ['eye-tr', 'eye-tr-gold'])`, в `EYES` в `NavBar.tsx` — строка `tr`. Если полумесяц и звезда на 44 px сливаются в пятно, перегенерировать с более крупным полумесяцем.
