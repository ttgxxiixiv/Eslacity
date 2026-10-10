# Рамка карты города на главной

С 2.158.0 карта города на главной (`CityGrid`) в той же рамке, что блок с просьбами над ней: тонкий брус с бронзой, скалки свитка по бокам, драконьи головы в углах. Картинка не генерировалась: `scripts/build-city-frame.py` берёт `src/assets/home/quest.webp` и вырезает кожаную середину вместе с окном портрета и стрелкой, получается `src/assets/home/city-frame.webp`. Класс `.city-frame` в `src/index.css` растягивает её на карту через `border-image`: углы с драконами остаются как есть, брус и скалки тянутся. Рамка шире карты на 11 px с боков и 8 px сверху и снизу, поэтому скалки ложатся рядом с картой и закрывают только её собственный тонкий брус.

Табличка над картой не нужна: заголовок «Карта города» остаётся прежним.

## Если понадобится своя рисованная рамка

Узкая, в духе блока с просьбами. Всё украшение в углах, стороны ровные: код растянет их через `border-image`.

```
Narrow decorative frame for a city map in a mobile fantasy RPG, matching a UI of dark carved wood, aged bronze
trim and small bronze dragon heads: hand-painted, warm colors, painterly texture, soft light from the top-left.
Not pixel art, not photorealistic.

Square image, 1024x1024 pixels. A thin rectangular frame: a dark carved wooden bar with a bronze edge, the same
thickness on all four sides, about 3% of the image width (around 30 pixels). The left and right sides are rolled
wooden scroll rods with bronze end caps, slightly thicker than the top and bottom bars. In each of the four
corners a small bronze dragon head curls around the corner. Everything inside the frame and outside it is plain
solid magenta (#FF00FF), so the frame can be cut out.

All decoration is only in the corners. The straight sides between the corners are plain and uniform along their
whole length, with no ornaments and no perspective, so they can be stretched without visible repeats.
Flat front view, no text, no letters, no numbers, no shadow outside the frame.
```

После генерации: снять пурпурный фон, сохранить вместо `city-frame.webp` и поправить срез и толщину в `.city-frame`.
