# Промты для украшений города (задача 9.3)

Украшения — награды за золотые медали (`DECOR` в `src/domain/decor.ts`). Сейчас они нарисованы кодом и стоят на перекрёстках. В новой версии каждое украшение будет стоять у своего здания, и картинка участка будет меняться целиком, как у освещённых зданий.

Нужны две картинки.

1. Лист украшений `docs/design/decor.png`: 12 украшений по отдельности на пурпурном фоне, как лист накидок. Из него режутся значки для карточки «Украшения города» в профиле. Его стоит сделать первым: потом он идёт образцом для карты, и украшения в профиле и на карте совпадут.
2. Карта с украшениями `docs/design/city-decor.png`: это `src/assets/city-lit.webp`, где у 12 зданий дорисованы украшения, а всё остальное не тронуто. Игра покажет участок здания из этой картинки, когда у линии есть золото, так же, как `LitPlot` показывает участок из `city-lit.webp`. Основа — освещённая карта, потому что к золотой медали здания уже открыты и светятся. Иначе украшенный участок погасил бы окна.

## Какое украшение у какого здания

Порядок — как на листе: слева направо, сверху вниз. Номер участка — индекс в `LOCATIONS` (сетка 4 × 5, считая с левого верхнего угла).

| № | Линия медалей | Украшение | Здание (участок) | Цвет |
|---|---|---|---|---|
| 1 | Словесник (`words`) | Знамя с раскрытой книгой | Школа (8) | синий #2f5fa8 |
| 2 | Знаток правил (`grammar`) | Клумба с лавандой | Аптека (7) | фиолетовый #8a4fc4 |
| 3 | Упорство (`streak`) | Гирлянда фонариков над террасой | Кафе (0) | оранжевый #ff9a2e |
| 4 | Картограф (`cartographer`) | Знамя с розой ветров и указатель | Вокзал (13) | зелёный #3c8a3c |
| 5 | Строитель (`builder`) | Колодец с черепичной крышей | Дом (4) | голубая вода #5a8fc4 |
| 6 | Друг города (`friend`) | Праздничные флажки между лотками и кадки с цветами | Рынок (1) | красный #d8435a |
| 7 | Посыльный (`courier`) | Два фонаря у двери | Почта (9) | жёлтый #ffd24a |
| 8 | Испытатель (`trials`) | Два знамени со скрещёнными мечами | Спортзал (12) | алый #b3261e |
| 9 | Слушатель (`listener`) | Клумбы голубых цветов у пруда и колокольчики ветра на столбике | Парк (5) | голубой #4fa8c4 |
| 10 | Молния (`blitz`) | Флажок-ветроуказатель с молнией | Аэропорт (18) | золотой #e0b43c |
| 11 | Твёрдая рука (`typed`) | Каменный фонтан | Банк (10) | серо-зелёный #7a9a6a |
| 12 | Эхо (`echo`) | Пара фиолетовых фонарей у входа | Отель (16) | фиолетовый #b48cff |

Без украшений остаются супермаркет, ресторан, магазин одежды, парикмахерская, пляж, офис, больница и полиция.

Чтобы участок можно было подменить, украшение должно стоять внутри своего участка (на его траве и мостовой, не на улице), не закрывать надпись с названием и строку звёзд или цены под ней (её закрывает табличка) и не задевать соседние здания. Поэтому в промте карты это повторено для каждого здания.

## 1. Лист украшений

```
Game item sprite sheet for a cozy medieval fantasy town-building RPG on mobile. Art style must match the attached
town map exactly: detailed hand-painted pixel art in a 3/4 top-down view, warm evening light, dark outlines of the
same thickness, the same palette and level of detail as the buildings on the map. No text, no letters, no numbers,
no ground tiles, no shadows on the background.

Draw 12 town decorations in a grid of 4 columns and 3 rows, all at the same scale as they would stand next to the
buildings on the map, each one standing on its own small patch of ground (a bit of cobblestone or grass right under
it, nothing more), on a plain solid magenta (#FF00FF) background with generous empty space between them.
Order, left to right, top row first:

1. A tall wooden flagpole with a long royal-blue (#2f5fa8) banner showing a white open book.
2. A low stone-edged flowerbed full of purple (#8a4fc4) lavender and small herbs.
3. A string of warm orange (#ff9a2e) paper lanterns hanging between two wooden posts, softly glowing.
4. A wooden flagpole with a green (#3c8a3c) banner with a golden compass rose, and a small wooden signpost
   with three arrow boards at its foot.
5. A round stone well with a little wooden roof of red tiles, a bucket on a rope, blue (#5a8fc4) water inside.
6. Festive bunting: a line of small triangular red (#d8435a), yellow and white pennants between two poles,
   with two wooden tubs of red flowers under it.
7. A pair of black iron street lanterns with bright yellow (#ffd24a) flames, glowing.
8. Two crossed wooden poles with scarlet (#b3261e) banners, each showing two crossed silver swords.
9. A round flowerbed of light-blue (#4fa8c4) flowers with a small wooden post holding brass wind chimes.
10. A tall thin mast with a golden-yellow (#e0b43c) windsock and a small pennant with a lightning bolt.
11. A small round stone fountain with a carved basin, a thin jet of water, grey-green (#7a9a6a) moss on the stone.
12. A pair of ornate iron lanterns on posts with violet (#b48cff) magical flames, glowing softly.

Each decoration must be readable as a small icon (about 48x48 CSS pixels on a phone): clear silhouette,
strong value contrast, the key color clearly visible. Consistent light from the top-left, crisp edges.
```

Приложить к промту: `src/assets/city-lit.webp` (образец стиля и масштаба). Готовый лист — `docs/design/decor.png`.

## 2. Карта с украшениями

```
Edit the attached town map. Keep the image EXACTLY the same: the same size and aspect ratio (891x1108), the same
streets, plots, buildings, trees, lamps, lit windows, colors, Cyrillic labels, stars and coin plates, every pixel in
the same place. Do not move, resize, redraw or restyle anything. The only change: add decorations next to 12
buildings, in the same hand-painted pixel art style and lighting as the map, matching the attached decorations sheet.

The map is a grid of 4 columns and 5 rows of plots separated by cobblestone streets. Every decoration must stay
inside its own plot (on its grass or pavement, within the plot's rounded border), must not cover the building's name
label or the stars / coin plate line under it, must not touch the streets around the plot and must not overlap
neighbouring plots. Prefer the free corners of the plot: the area above or beside the building, or the bottom
corners left and right of the coin plate.

Row 1:
- Plot 1 (КАФЕ, top-left): a string of warm orange paper lanterns hanging above the wooden terrace on the left.
- Plot 2 (РЫНОК): festive bunting of small red, yellow and white pennants strung between the stalls above the
  awnings, and two wooden tubs of red flowers in the free corners.
- Plots 3 and 4 (СУПЕРМАРКЕТ, РЕСТОРАН): unchanged.

Row 2:
- Plot 1 (ДОМ): a round stone well with a little red-tiled roof and blue water, in the garden to the left of the
  vegetable beds.
- Plot 2 (ПАРК): round beds of light-blue flowers along the pond and a small wooden post with brass wind chimes
  near the benches.
- Plot 3 (МАГАЗИН): unchanged.
- Plot 4 (АПТЕКА): low stone-edged flowerbeds of purple lavender in front of the building, left and right of the
  label.

Row 3:
- Plot 1 (ШКОЛА): a tall flagpole beside the school with a long royal-blue banner showing a white open book.
- Plot 2 (ПОЧТА): a pair of black iron street lanterns with bright yellow flames on both sides of the door.
- Plot 3 (БАНК): a small round stone fountain with a thin jet of water and grey-green moss, in a free corner.
- Plot 4 (ПАРИКМАХЕР): unchanged.

Row 4:
- Plot 1 (СПОРТЗАЛ): two scarlet banners with crossed silver swords on poles at the front corners of the building.
- Plot 2 (ВОКЗАЛ): a flagpole with a green banner with a golden compass rose and a small wooden signpost with three
  arrow boards next to the platform.
- Plots 3 and 4 (ПЛЯЖ, ОФИС): unchanged.

Row 5:
- Plot 1 (ОТЕЛЬ): a pair of ornate iron lanterns with violet magical flames at the hotel entrance.
- Plot 2 (БОЛЬНИЦА): unchanged.
- Plot 3 (АЭРОПОРТ): a tall thin mast with a golden-yellow windsock and a small pennant with a lightning bolt at the
  edge of the runway.
- Plot 4 (ПОЛИЦИЯ): unchanged.

Decorations are lit by the same warm evening light as the map; lanterns glow softly but their glow stays inside
the plot. Keep all eight unchanged plots and all streets identical to the original.
```

Приложить к промту: `src/assets/city-lit.webp` (основа, её и надо отредактировать) и готовый `docs/design/decor.png`. Генератор картинок должен уметь редактировать приложенное изображение: если он рисует карту заново, сетка съедет, и участки не совпадут.

После генерации:
- проверить, что сетка совпала с `city-lit.webp`: разница двух картинок должна быть только на 12 участках (так проверяли и `city-lit.webp` в 1.10.0);
- если украшение вылезло на улицу или на надпись, перегенерировать только этот участок (вырезать, отредактировать, вставить обратно) или поправить вручную;
- если пришёл другой размер с тем же соотношением сторон, привести к 891 × 1108.
