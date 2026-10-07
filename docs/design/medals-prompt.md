# Промты для медалей

Медали — `LINES` и `SECRETS` в `src/domain/medals.ts`: 12 линий по 6 ступеней (`TIERS`: дерево, камень, бронза, серебро, золото, бриллиант) и 10 тайных медалей, из них 4 праздничные (у каждого языка свои две). Листы по этим промтам лежат в `docs/design/medal-*.png` (с 2.132.0), их режет `scripts/build-medal-art.py`, показывает компонент `Medal`.

Рисовать 72 медали линий по одной не нужно: медаль — это оправа ступени и эмблема линии в центре, их сложит код. Поэтому листов три:

1. `docs/design/medal-frames.png` — шесть оправ ступеней, пустых внутри.
2. `docs/design/medal-emblems.png` — двенадцать эмблем линий без оправы.
3. `docs/design/medal-secrets.png` — десять тайных медалей целиком, каждая своей формы.

Стиль — рисовка фэнтезийных MMO в духе иконок достижений World of Warcraft: рисованная живопись крупными мазками, утрированные массивные формы, насыщенный цвет, толстый металл с бликами, светящиеся камни и руны. Название игры в промте стоит одной строкой. Если генератор откажется рисовать «в стиле» чужой игры, строку можно убрать: стиль описан словами и без неё.

Остальной интерфейс игры — пиксельный. Медали в живописном стиле будут заметно отличаться от него. В профиле и в окне награды это скорее плюс: награда выглядит «дороже», чем обычные кнопки.

Фон у всех листов — ровный пурпур #FF00FF, его снимет скрипт нарезки. Поэтому в самих медалях не должно быть пурпурного и ярко-розового цвета, промты это оговаривают.

Порядок на листах — слева направо, сверху вниз, как в таблицах.

## 1. Оправы ступеней

| № | Ступень | Оправа |
|---|---|---|
| 1 | Дерево | тёмный дуб с железными гвоздями, грубая резьба |
| 2 | Камень | серый гранит с резьбой и пятнами мха |
| 3 | Бронза | бронза с патиной и простым орнаментом |
| 4 | Серебро | полированное серебро с гравировкой |
| 5 | Золото | золото с филигранью и четырьмя рубинами |
| 6 | Бриллиант | кристалл с ледяным голубым свечением и огранёнными камнями |

```
Stylized hand-painted fantasy MMO achievement icon art, in the spirit of World of Warcraft achievement medals:
bold chunky shapes, thick painterly brushwork, saturated colors, strong rim light, heavy ornate metalwork.
No text, no letters, no numbers.

Draw 6 round medal frames in a grid of 3 columns and 2 rows, all exactly the same size and shape, perfectly
circular, front view, on a plain solid magenta (#FF00FF) background with generous empty space between them.
Each frame is a thick ring with a short folded ribbon tail at the bottom, and the centre is an EMPTY recessed
dark disc (deep brown-black, plain, no emblem) — an emblem will be placed there later. Only the material and
ornament of the ring change, from humble to precious:

1. Dark oak wood with iron nails and rough carving, a brown leather ribbon.
2. Grey granite with carved runes and patches of moss, a grey cloth ribbon.
3. Bronze with green patina and a simple knotwork border, a dark red ribbon.
4. Polished silver with fine engraving and small leaf ornaments, a deep blue ribbon.
5. Gold with filigree and four inset rubies, a crimson ribbon with gold trim.
6. Crystal and white gold with an icy blue inner glow and faceted gems, a pale blue ribbon with silver trim.

Do not use magenta or bright pink anywhere in the frames. Consistent light from the top-left. Each frame must
stay readable at 64x64 pixels on a phone.
```

## 2. Эмблемы линий

| № | Линия | За что | Эмблема |
|---|---|---|---|
| 1 | Словесник | закреплённые слова | раскрытая книга со светящимися рунами |
| 2 | Упорство | стрик | вечный огонь в железной жаровне |
| 3 | Знаток правил | уроки грамматики | свиток с печатью и скрещённое перо |
| 4 | Картограф | обрывки карты | роза ветров поверх клочка карты |
| 5 | Друг города | друзья среди жителей | две сцепленные руки |
| 6 | Посыльный | поручения | запечатанный конверт с крыльями |
| 7 | Молния | блиц | золотая молния |
| 8 | Твёрдая рука | ввод без ошибок подряд | латная перчатка, сжимающая перо |
| 9 | Строитель | уровни зданий | молот и мастерок перед кирпичной башенкой |
| 10 | Испытатель | испытания и стражи | щит со скрещёнными мечами |
| 11 | Слушатель | задания на слух | бронзовый колокол с волнами звука |
| 12 | Эхо | выражения в другом регистре | две зеркальные театральные маски с фиолетовым свечением |

```
Stylized hand-painted fantasy MMO achievement icon art, in the spirit of World of Warcraft achievement icons:
bold chunky shapes, thick painterly brushwork, saturated colors, glowing highlights, a strong readable
silhouette. No text, no letters, no numbers, no frame, no circle behind the object.

Draw 12 separate emblems in a grid of 4 columns and 3 rows, all at the same scale, each centred in its cell,
on a plain solid magenta (#FF00FF) background with generous empty space between them. Each emblem is a single
object that will later be placed inside a round medal, so it should fit in a circle and fill about 70% of it.
Order, left to right, top row first:

1. An open ancient book with glowing golden runes rising from the pages.
2. An eternal flame burning in a black iron brazier.
3. A rolled parchment scroll with a red wax seal and a crossed quill.
4. A golden compass rose over a torn piece of old map.
5. Two hands clasped in a firm handshake, one in a leather glove.
6. A sealed envelope with red wax and two small white wings.
7. A jagged golden lightning bolt crackling with energy.
8. A steel plate gauntlet firmly gripping a quill pen.
9. A smith's hammer and a mason's trowel crossed in front of a small brick tower.
10. A round heater shield with two crossed swords behind it.
11. A bronze bell with curved sound waves around it.
12. Two mirrored theatre masks, one smiling and one serious, with a soft violet glow (violet, not pink).

Do not use magenta or bright pink anywhere in the emblems. Consistent light from the top-left. Each emblem must
stay readable at 40x40 pixels on a phone.
```

## 3. Тайные медали

Тайная медаль — отдельная форма, чтобы её сразу отличали от медалей линий: восьмиконечная звезда из тёмного металла с фиолетово-золотой лентой, в центре — своя сцена. Праздничные медали тайные, но видны только в своём языке: Сан-Фермин и Томатина — в испанском, Феррагосто и Карнавал — в итальянском.

| № | Медаль | За что | Сцена в центре |
|---|---|---|---|
| 1 | Спасённый стрик | заморозка сохранила стрик | огонь внутри ледяного кристалла |
| 2 | Без единой ошибки | урок на 100% | сияющая идеально огранённая звезда |
| 3 | Полночный путник | урок после полуночи | полумесяц над фонарём путника |
| 4 | Выход из Лабиринта | печать главы V | диск-лабиринт со светящимся выходом |
| 5 | Взгляд Сфинкса | дойти до Врат Хранилища | глаз Сфинкса в каменной арке |
| 6 | Хранитель пути | выпить Эликсир | чаша с золотым сияющим эликсиром |
| 7 | Красный платок | Сан-Фермин | красный шейный платок и бычьи рога |
| 8 | Томатная битва | Ла Томатина | разбрызганный спелый помидор |
| 9 | Августовский фейерверк | Феррагосто | фейерверк над морем |
| 10 | Венецианская маска | Карнавал в Венеции | золото-белая венецианская маска с перьями |

```
Stylized hand-painted fantasy MMO achievement icon art, in the spirit of World of Warcraft feat-of-strength
medals: bold chunky shapes, thick painterly brushwork, saturated colors, strong rim light, heavy ornate metal.
No text, no letters, no numbers.

Draw 10 secret medals in a grid of 5 columns and 2 rows, all exactly the same size and shape, front view, on a
plain solid magenta (#FF00FF) background with generous empty space between them. Every medal has the same frame:
an eight-pointed star of dark blackened metal with gold edges, a round inner disc, and a short ribbon tail at the
bottom in deep purple and gold stripes (deep purple, not pink). Only the scene in the inner disc changes:

1. A small flame trapped inside an icy blue crystal.
2. A perfectly cut radiant white star gem with light rays.
3. A crescent moon over a small brass travel lantern, night-blue sky.
4. A round stone maze with a glowing golden exit path.
5. A single golden sphinx eye inside a carved stone arch.
6. A golden chalice with a shining golden elixir.
7. A red neckerchief tied in a knot with a pair of black bull horns behind it.
8. A ripe red tomato bursting with juice splashes.
9. Golden and white fireworks bursting over a dark sea.
10. A white and gold Venetian carnival mask with dark green feathers.

Do not use magenta or bright pink anywhere in the medals. Consistent light from the top-left. Each medal must stay
readable at 64x64 pixels on a phone.
```

## После генерации

- Проверить, что оправы одного размера и центр у всех пустой: эмблема ляжет в него кодом.
- Эмблемы должны быть одного масштаба, без фона и рамки. Если одна вышла крупнее, её проще перегенерировать, чем подгонять.
- Уменьшить лист до размера показа (оправа и тайная медаль — 64 px, эмблема — 40 px) и посмотреть, читается ли рисунок. Нечитаемую перегенерировать по тому же промту, приложив готовый лист как образец.
- Пурпур не должен попадать в саму медаль: скрипт нарезки снимает его по цвету.
- Готовые листы положить в `docs/design/` под именами из начала файла. Потом понадобятся скрипт нарезки (как `scripts/build-dock-art.py`) и показ медали в профиле и в окне награды.
