# Промты для фонов главной по главам

Сейчас фон главной — тёмный градиент на `body` (`body.home-dark` в `src/index.css`, `background-attachment: fixed`). Идея: у каждой главы свой фон с её землёй, и фон меняется, когда открывается новая глава (`opened` в `src/store/journey.ts`). Игрок видит, куда дошёл, прямо на главной.

Пять картин в живописной манере медалей и кнопок главной (`docs/design/medals-prompt.md`, `docs/design/home-dock-prompt.md`): рисованная живопись крупными мазками, насыщенный цвет, сильный контровой свет. Название игры стоит в промте одной строкой. Если генератор откажется рисовать «в стиле» чужой игры, строку можно убрать: стиль описан и без неё.

| № | Глава | Земля | Что на картине | Файл |
|---|---|---|---|---|
| 1 | I | Окрестности города | приморский город на закате, дорога от парка у озера уходит к холмам, вдали камень стража | `home-bg-1.png` |
| 2 | II | Горный перевал | ветреный перевал в тумане, на вершине башня, в окне мигает свет, старые рельсы | `home-bg-2.png` |
| 3 | III | Пустыня миражей | дюны под полной луной, на горизонте белый город-мираж, блестящий как вода песок | `home-bg-3.png` |
| 4 | IV | Лес шёпотов | огромные деревья в тумане качаются без ветра, светлячки, в глубине горит свет | `home-bg-4.png` |
| 5 | V | Лабиринт Эха | каменные ходы и тысяча ступеней к двери, светящиеся руны, за дверью золотой свет Хранилища | `home-bg-5.png` |

## Где фон виден

Экран телефона 393×852. Фон закрыт почти целиком:

- сверху (0–8% высоты) — панель с монетами и уровнем;
- 9–25% — карточка «Продолжить» и свиток карты;
- 26–34% — ряд круглых кнопок с подписями светлым цветом (#e8dcc0);
- 35–40% — заголовок «Карта города»;
- ниже 40% — карта города почти во всю ширину, по бокам остаются полоски по 10–15 px.

Поэтому:

- узнаваемое (башня, мираж, свет в лесу, дверь) стоит в верхней трети картины и ближе к краям, чтобы выглядывать между кнопками и из-за карточки;
- полоса 25–40% высоты тёмная и спокойная, без мелких ярких деталей: на ней светлые подписи кнопок;
- нижние две трети — тёмный, почти однотонный низ земли (трава, камень, песок, корни, плиты), он виден только по бокам карты и при прокрутке;
- в картине нет людей, текста, рамок и интерфейса.

Фон закреплён (`fixed`) и растягивается по экрану с обрезкой (`cover`, привязка к верху), так что края по бокам могут уйти.

## Общая часть промта

Её одинаковое начало ставится перед описанием каждой земли:

```
Vertical full-screen background for the home screen of a fantasy RPG on mobile, portrait 9:16 (1080x1920 or
larger). Stylized hand-painted fantasy MMO art in the spirit of World of Warcraft loading screens and zone
art: bold chunky exaggerated shapes, thick painterly brushwork, saturated colors, strong rim light, glowing
highlights, deep atmospheric perspective. Match the manner of the attached medal and button sheets.

Composition rules (the image sits behind game UI):
- The recognizable landmark and the brightest light are in the upper third of the image, placed toward the
  left or right edge, never in the exact centre.
- The band from 25% to 40% of the height is dark and calm, with no small bright details, because light text
  and round buttons will sit on top of it.
- The lower two thirds are a dark, low-contrast, almost uniform ground that fades into deep shadow at the
  bottom; it will be mostly covered by a city map.
- Dark overall value: the image must keep light parchment-colored text readable anywhere on it.
- No people, no characters, no text, no letters, no logos, no frames, no user interface.
```

## 1. Окрестности города (глава I)

```
Scene: the outskirts of a warm Mediterranean seaside town at golden sunset. In the upper part, terracotta
roofs and a small bell tower on the right edge, the sea glittering behind them, and a calm lake in a park
with old pines. A dusty winding road leaves the lake and climbs into soft green hills toward the left edge,
where a tall lonely standing stone with a faint golden rune glows at the end of the road — the first
guardian's seal. Distant mountains are barely visible on the horizon. Warm orange and rose sky fading to
deep plum higher up. The lower part is a dark meadow with olive trees and stone walls sinking into warm
brown shadow. Palette: terracotta, olive green, sea blue, sunset gold, deep plum and brown shadows.
```

## 2. Горный перевал (глава II)

```
Scene: a high windy mountain pass at dusk. On a sharp peak near the right edge of the upper part stands an
old stone watchtower with a single window glowing warm yellow, as if blinking a signal. Streams of mist and
low clouds flow through the pass; snow on the far summits catches the last cold light. An old narrow-gauge
railway with rusty rails winds along the cliff toward the tower and disappears into the fog. Far away
through a gap on the left, a strip of shining sand that looks like water hints at the desert beyond.
The lower part is dark grey rock, scree and wind-bent grass sinking into blue-black shadow. Palette: slate
grey, cold blue, mist white, one warm yellow window, dark indigo shadows.
```

## 3. Пустыня миражей (глава III)

```
Scene: an endless desert of golden dunes on a night of a huge full moon. In the upper part near the left
edge, a white city with domes and slender towers floats above the horizon as a shimmering mirage,
half transparent, reflected in sand that shines like water. The full moon hangs near the right edge, very
large, pale gold. A faint line of old rails crosses the dunes toward the mirage. Sand ripples catch silver
moonlight, a few dark palm silhouettes stand by a dry oasis. The lower part is dark dunes in deep
violet-blue shadow with soft sand texture. Palette: moon gold, warm sand, pearl white for the mirage,
deep violet and navy shadows.
```

## 4. Лес шёпотов (глава IV)

```
Scene: an ancient misty forest of colossal trees with twisted roots and hanging moss. The trees lean and
sway as if moved by a wind that is not there; the mist curls between them in soft swirling ribbons like
whispers. In the upper part, deep between the trunks near the right edge, a warm golden light glows in the
heart of the forest. Small fireflies and pale floating motes drift in the air, a black raven feather falls
slowly near the left edge. The lower part is dark roots, ferns and moss sinking into green-black shadow.
Palette: deep emerald, teal mist, moss green, warm gold light, near-black green shadows.
```

## 5. Лабиринт Эха (глава V)

```
Scene: a vast labyrinth of ancient grey stone corridors seen from above at twilight, walls carved with faint
glowing violet runes, the walls forming winding passages that echo into the distance. In the upper part a
long stairway of a thousand worn stone steps rises from the edge of a quiet forest toward a massive carved
stone door near the right edge; a thin line of warm golden light escapes through the gap of the door —
the Vault beyond. Pale ghostly ripples, like sound waves, spread from the walls. The lower part is dark
labyrinth walls and floor stones fading into deep violet-black shadow. Palette: cold stone grey, violet
rune glow, one warm gold light from the door, deep violet and charcoal shadows. Use violet, not pink or
magenta.
```

## После генерации

- Положить картины в `docs/design/` под именами из таблицы.
- Уменьшить картинку до 393×852 и положить поверх снимок главной (или хотя бы её схему из раздела «Где фон виден»): подписи кнопок должны читаться, а примета земли — выглядывать между кнопками или из-за карточки. Если ярко в полосе кнопок, перегенерировать с тем же промтом и припиской «make the band from 25% to 40% of the height darker and calmer».
- Все пять картин должны быть одного тона по светлоте: при смене главы главная не должна вдруг стать светлее или темнее. Если одна выбивается, перегенерировать её, приложив готовую соседнюю как образец.
- Дальше понадобятся скрипт, который ужмёт картины в `src/assets/home/bg-<глава>.webp` (около 720×1280 px: живопись без мелких деталей это выдержит, а precache не раздуется), и выбор фона по открытой главе на главной вместо градиента. Градиент останется запасным, пока картинка грузится.
