# Промт для рамки карты города на главной

Карта города на главной (`CityGrid` в `src/components/CityGrid.tsx`) — картинка `src/assets/city.webp` (891×1108, и её освещённые варианты `city-lit.webp`, `city-decor.webp`). Рамка у неё сейчас нарисована прямо на картинке: тонкий тёмный брус около 20 px по краю, а над картой — золотой заголовок «Карта города» кодом. Под картой с 2.157.0 стоит рисованное меню из камня с бронзой (`docs/design/nav-wow-prompt.md`), рамка должна быть с ним в одной манере.

Новая рамка кладётся поверх карты и закрывает старый брус. Карту при этом перерисовывать не нужно, и одна рамка подойдёт ко всем трём её вариантам.

Рамку лучше генерировать отдельно от таблички с названием:

1. Сама рамка — квадратная, с пустой серединой. Код растянет её на карту через `border-image`: углы останутся как есть, а прямые стороны вытянутся. Поэтому всё украшение должно быть в углах, а стороны — ровными и одинаковыми по всей длине.
2. Табличка-картуш над верхней стороной рамки. Надпись «Карта города» на ней рисует код: кириллицу генератор портит.

## Промт 1: рамка

```
Ornate frame for a city map in a mobile fantasy RPG, in the hand-painted stylized art style of World of Warcraft:
chunky exaggerated shapes, saturated warm colors, painterly textures with visible brush strokes, strong rim light,
soft ambient occlusion. Not pixel art, not photorealistic.

Square image, 1024x1024 pixels. A square frame made of heavy carved grey-brown stone blocks with a worn bronze
inner trim, matching a stone-and-bronze game UI. The frame band is the same thickness on all four sides, about 9%
of the image width (around 90 pixels). The inside of the frame is completely empty and filled with plain solid
magenta (#FF00FF), and the outside of the frame is also plain solid magenta, so the frame can be cut out.

All decoration is only in the four corners: each corner has a square stone block with a small bronze rivet
cluster and a little green moss; the top-left and bottom-right corners also have a few climbing ivy leaves.
The four straight sides between the corners are plain and uniform along their whole length, with no ornaments,
no gems, no breaks and no perspective, so that they can be stretched without visible repeats.
The inner edge of the frame is a clean straight bronze line with a thin dark shadow falling inward.

Flat front view, no tilt, no drop shadow outside the frame, no text, no letters, no numbers.
```

## Промт 2: табличка с названием

```
Title plaque for a mobile fantasy RPG, in the hand-painted stylized art style of World of Warcraft: chunky shapes,
saturated warm colors, painterly textures, strong rim light. Not pixel art.

One horizontal cartouche, aspect ratio about 4:1, centered on a plain solid magenta (#FF00FF) background with
empty space around it. A carved stone plaque with a bronze rim and small bronze scroll curls at the left and right
ends, the same stone-and-bronze style as a game menu. The middle of the plaque is a flat, calm, dark stone field
with no pattern, reserved for a title that will be added later in code.

Flat front view, no text, no letters, no numbers, no shadow on the background.
```

## Что сделать после генерации

1. Положить картинки в `docs/design/city-frame.png` и `docs/design/city-title.png`.
2. Скрипт (по образцу `scripts/build-nav-art.py`) снимает пурпурный фон, обрезает рамку и табличку и сохраняет в `src/assets/home/city-frame.webp` и `city-title.webp`.
3. В `CityGrid` поверх карты — слой с `border-image: url(city-frame.webp) <срез> fill?` без заливки середины (середина прозрачная), ширина бруса на экране около 14 px, чтобы закрыть старый брус карты (8 px на телефоне). Здания у края и путник не должны уходить под рамку: проверить по скриншоту, при необходимости рамку класть с небольшим выступом наружу.
4. Табличка встаёт по центру над верхней стороной рамки, заголовок «Карта города» — тем же `gold-heading` поверх неё. Кнопка «Собрать всё» остаётся справа от таблички.
5. Проверить `home.spec.ts`: карта по-прежнему видна без прокрутки.
