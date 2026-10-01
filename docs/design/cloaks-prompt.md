# Промт для листа накидок путника

Накидки — награды уровней героя (`LEVEL_REWARDS` в `src/config.ts`): восемь материалов от самого простого к самому благородному. Лист по этому промту лежит в `docs/design/cloaks.png` (с 2.109.1), его режет `scripts/build-road-art.py`: элементы ищутся на пурпурном фоне, порядок — слева направо, сверху вниз, все в одном масштабе.

Чтобы путник остался тем же, к промту стоит приложить `docs/design/daily-road.png` как образец: поза, рост, рюкзак, фонарь и сапоги должны совпасть, меняется только накидка.

| № | Накидка | Уровень | Что должно читаться в маленьком размере |
|---|---|---|---|
| 1 | Мешковина | сразу | грубое редкое плетение, бахрома, заплаты, верёвка вместо застёжки |
| 2 | Сермяга | 4 | толстая домотканая шерсть, серо-бурая, пушистый край |
| 3 | Лён | 9 | светлая лёгкая ткань, мягкие складки, простая кайма |
| 4 | Сукно | 13 | плотная валяная шерсть глубокого синего цвета, ровный край, латунная пряжка |
| 5 | Кожа | 17 | коричневая кожа с прострочкой, оплечье, ремешки |
| 6 | Бархат | 20 | тёмно-винный бархат с мягким блеском на складках, тесьма |
| 7 | Шёлк | 23 | изумрудный шёлк с переливом, вышитая кайма |
| 8 | Парча | 26 | парча с золотой нитью и узором, меховая опушка капюшона, золотая фибула |

```
Pixel-art game sprite sheet for a mobile RPG about a traveller on the road to a hidden Vault. Painterly pixel art
matching the attached reference exactly: the same small hooded wanderer walking to the right, same pose, same height,
same brown backpack with a rolled blanket, same glowing brass lantern in the front hand, same boots. Only the cloak
changes. No text, no letters, no numbers.

Draw 8 copies of the wanderer in a grid of 4 columns and 2 rows, all the same size and aligned on the same baseline,
on a plain solid magenta (#FF00FF) background with generous empty space between them. Each cloak is made of a
different material, ordered from the poorest to the most noble (left to right, top row first):

1. Sackcloth: coarse loose burlap weave in dull straw-beige, frayed fringe at the hem, two visible patches, tied
   with a rope instead of a clasp.
2. Homespun wool: thick rough grey-brown wool, fuzzy edges, heavy and shapeless.
3. Linen: light undyed off-white linen, soft natural folds, a thin plain border.
4. Broadcloth: dense felted deep blue wool, clean straight edges, a small brass buckle at the collar.
5. Leather: brown leather cloak with visible stitching, a shoulder piece and two thin straps.
6. Velvet: deep wine-red velvet with a soft sheen along the folds, dark braided trim.
7. Silk: emerald silk with a shimmering highlight, an embroidered border at the hem and hood.
8. Brocade: rich brocade woven with gold thread in a small repeating pattern, a fur-trimmed hood,
   a golden clasp shaped like an eye.

The difference between materials must be readable at a small size (about 13x18 CSS pixels on a phone): rely on
silhouette details (fringe, trim, fur, buckle), value contrast and highlights, not only on hue. Consistent light
from the top-left, same outline thickness and palette style as the reference, crisp edges, no shadows on the
background.
```
