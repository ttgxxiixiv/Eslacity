# Промт для кнопок главной (задача 14.1)

С 2.131.0 над картой города стоит ряд круглых кнопок (`DockButton` в `src/screens/Home.tsx`). По этому промту нарисованы их медальоны в стиле главной: рамы и свитки из `docs/design/home-mockup.jpg`, медальон нижнего меню и иконки разделов.

Лист по этому промту лежит в `docs/design/home-dock.png` (с 2.131.0). Его режет `scripts/build-dock-art.py`: пурпурный фон снимается, медальоны ищутся слева направо, сверху вниз и сохраняются в `src/assets/dock/<кнопка>.webp`.

Подписи под кнопками, бейджи с числами и крестик у «Расспросов» рисует код. На картинках их быть не должно: число на бейдже меняется, а надпись на русском генератор испортит.

| № | Кнопка | Куда ведёт | Что изображено |
|---|---|---|---|
| 1 | Повтор | повторение карточек | песочные часы с золотым песком над раскрытой книгой |
| 2 | Путь | карта странствий | свёрнутый край старой карты с красной пунктирной тропой и маленьким компасом |
| 3 | Правила | следующий урок грамматики | свиток с сургучной печатью и гусиным пером |
| 4 | Блиц | блиц на 60 секунд | золотая молния поверх маленьких карманных часов |
| 5 | Праздник | неделя праздника | гирлянда треугольных флажков над бубном или фонариком |
| 6 | Расспросы | входной тест Летописца | раскрытая летопись с вопросительной закорючкой из чернил и свечой |
| 7 | Пустой медальон | запас для будущих кнопок | только рама, внутри ровный пергамент |

```
Game UI icon sheet for a cozy medieval fantasy RPG on mobile, in the exact style of the attached home screen mockup:
hand-painted pixel art, dark carved wood and aged brass frames, warm parchment, gold accents, soft candle-like
light from the top-left, dark outlines of the same thickness as in the mockup. No text, no letters, no numbers,
no badges.

Draw 7 round medallion buttons in a grid of 4 columns and 2 rows (the last cell of the second row stays empty),
all exactly the same size and perfectly circular, on a plain solid magenta (#FF00FF) background with generous
empty space between them. Every medallion has the same frame: a thick ring of dark carved wood with a thin aged
brass rim and four small brass rivets at top, bottom, left and right, and a slightly recessed parchment disc
inside. Only the emblem in the centre changes. The emblem fills about 60% of the disc and has a strong silhouette
that stays readable at 52x52 pixels on a phone.

Order, left to right, top row first:
1. An hourglass with glowing golden sand standing on an open old book.
2. The rolled corner of an old map with a red dotted trail and a tiny brass compass.
3. A parchment scroll with a red wax seal and a quill pen.
4. A golden lightning bolt over a small brass pocket watch.
5. A string of small triangular festive pennants (red, yellow, green) above a little paper lantern.
6. An open chronicle book with an ink question-mark flourish and a small lit candle.
7. The empty medallion: the same frame with plain parchment inside.

Consistent lighting, the same palette as the mockup (#3b2a1a dark wood, #8a6a3a brass, #f4e6c6 parchment,
#d9a441 gold), crisp pixel edges, no drop shadows on the background.
```

Приложить к промту: `docs/design/home-mockup.jpg` (рамы, свитки и плашки главной) и `src/assets/nav/nav-es.webp` (медальон и иконки нижнего меню). Без образцов генератор рисует в другом стиле, и кнопки будут выбиваться из главной.

После генерации:
- проверить, что все медальоны одного размера и рама одинаковая, иначе ряд на главной будет неровным;
- если эмблема нечитаема в маленьком размере (уменьшить картинку до 52×52 и посмотреть), перегенерировать только эту кнопку с тем же промтом и приложенным листом;
- пурпур не должен попадать в саму рамку и эмблему: скрипт нарезки снимает его по цвету.
