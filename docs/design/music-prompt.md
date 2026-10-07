# Промты для музыки на замену синтезу

Сейчас все семь тем играет синтез WebAudio по нотам из `THEMES` в `src/domain/chiptune.ts`: восемь тактов квадратной или треугольной волной по кругу. Звучит как заглушка. Нужны семь настоящих треков с тем же назначением: город, пять земель по главам и Хранилище после Эликсира. Где какая тема играет, решает `themeFor`.

Промты написаны под Suno (поле Style of Music, режим Instrumental), подходят и для Udio. Название игры в промте не нужно, стиль описан словами. Если генератор берёт только короткий стиль (до 200 знаков), хватает первой строки промта.

## Что общее у всех треков

- Только инструменты, без голоса, хора со словами и вокализа на первом плане.
- Длина 1:30–2:30, трек должен закольцовываться: без вступления «из тишины», без финального аккорда с затуханием. Конец по гармонии возвращается к началу.
- Музыка фоновая: под неё читают и думают над ответом. Никаких резких ударов, громких кульминаций и соло, которое тянет внимание. Ровная громкость.
- Поверх идут голоса жителей (озвучка) и звуки ответов. Середина диапазона (300–3000 Гц) не должна быть плотной: мелодия лёгкая, аккомпанемент прозрачный.
- Общий мир: тёплое фэнтези, пиксельная RPG, дерево и пергамент. Живые инструменты, немного ретро допустимо, но не чистый 8-бит.

Общая строка, которую можно ставить в конец каждого промта:

```
instrumental, no vocals, seamless loop, no intro, no outro, no fade, steady dynamics, background music for a calm fantasy RPG, warm, cozy, light texture, leaves room for dialogue
```

## Треки

| № | Тема | Где звучит | Тональность и темп сейчас | Файл |
|---|---|---|---|---|
| 1 | `city` | город, уроки, повторение, большая часть игры | до мажор, 112 | `music-city.ogg` |
| 2 | `land1` | карта странствий, глава I «Окрестности города» | соль мажор, 96 | `music-land1.ogg` |
| 3 | `land2` | глава II «Горный перевал» | ля минор, 84 | `music-land2.ogg` |
| 4 | `land3` | глава III «Пустыня миражей» | ре фригийский, 100 | `music-land3.ogg` |
| 5 | `land4` | глава IV «Лес шёпотов» | ми минор, 88 | `music-land4.ogg` |
| 6 | `land5` | глава V «Лабиринт Эха» | до минор, 92 | `music-land5.ogg` |
| 7 | `vault` | Хранилище и всё после Эликсира | до мажор, 76 | `music-vault.ogg` |

Тональность и темп брать не обязательно, это ориентир.

### 1. Город

Самый важный трек: его слышат дольше всех. Испанский и итальянский курс общие, так что музыка средиземноморская вообще, без явной Андалусии или Неаполя.

```
Cozy Mediterranean town theme for a fantasy RPG, C major, 108 BPM, nylon-string guitar plucking, mandolin melody, accordion pads, light hand percussion (cajon brushes, tambourine very soft), pizzicato strings, sunny afternoon in a seaside market town, cheerful but relaxed, gentle and repetitive, instrumental, no vocals, seamless loop, no intro, no outro, steady dynamics, light texture, leaves room for dialogue
```

### 2. Окрестности города (глава I)

Дорога от парка у озера к холмам на закате. Начало пути, всё знакомое.

```
Pastoral overworld theme for a fantasy RPG, G major, 96 BPM, wooden flute melody, acoustic guitar arpeggios, soft harp, warm cello drone, hills at sunset, first steps of a journey, hopeful and simple, folk feel, instrumental, no vocals, seamless loop, no intro, no outro, steady dynamics, light texture
```

### 3. Горный перевал (глава II)

Ветреный перевал в тумане, наверху башня с мигающим огнём, старые рельсы.

```
Misty mountain pass theme for a fantasy RPG, A minor, 84 BPM, low whistle or shakuhachi-like flute, sustained strings, soft wind ambience, distant bell, slow timpani pulse very quiet, lonely tower on a peak, cold air, steady climb, melancholic but determined, instrumental, no vocals, seamless loop, no intro, no outro, steady dynamics, light texture
```

### 4. Пустыня миражей (глава III)

Дюны под полной луной, на горизонте белый город, которого может не быть.

```
Desert of mirages theme for a fantasy RPG, D phrygian, 100 BPM, oud melody, ney flute, frame drum and darbuka soft and steady, shimmering hammered dulcimer, warm drone, moonlit dunes, a white city shimmering on the horizon, mysterious and hypnotic, not aggressive, instrumental, no vocals, seamless loop, no intro, no outro, steady dynamics, light texture
```

### 5. Лес шёпотов (глава IV)

Огромные деревья в тумане качаются без ветра, светлячки. В этой главе много слушают (шёпоты, страж на слух), поэтому трек самый тихий.

```
Whispering forest theme for a fantasy RPG, E minor, 80 BPM, celesta and music box motifs, soft harp, airy string pads, distant wooden chimes, very quiet low drone, foggy ancient trees, fireflies, something listening in the dark, mysterious and gentle, sparse arrangement, lots of space, instrumental, no vocals, no choir words, seamless loop, no intro, no outro, steady dynamics, very light texture
```

### 6. Лабиринт Эха (глава V)

Каменные ходы, тысяча ступеней, светящиеся руны. Фразы повторяются, как эхо.

```
Echo labyrinth theme for a fantasy RPG, C minor, 92 BPM, plucked harp and dulcimer with long delay echoes, each phrase repeated softer like an echo, low strings ostinato, deep stone-hall reverb, faint glass harmonica, ancient underground maze with glowing runes, tense but calm, puzzle mood, instrumental, no vocals, seamless loop, no intro, no outro, steady dynamics, light texture
```

### 7. Хранилище

Конец пути: золотой свет, Эликсир выпит. Торжественно, но тихо, это фон итогов и ежедневной игры после победы.

```
Golden vault theme for a fantasy RPG, C major, 76 BPM, warm strings, soft French horn melody, harp arpeggios, celesta sparkle, gentle wordless choir pad in the background only, golden light in an ancient treasure hall, quiet triumph and peace after a long journey, majestic but soft, instrumental, no lead vocals, seamless loop, no intro, no outro, steady dynamics, light texture
```

## Если генератор делает трек с началом и концом

Suno часто начинает с тишины и в конце затихает. Тогда:

- в поле Lyrics поставить только `[Instrumental]` и `[Loop]`, без `[Intro]` и `[Outro]`;
- взять трек подлиннее (3 минуты) и вырезать кусок из середины по границе такта, длиной 4 или 8 фраз; склейку конца с началом проверить на слух в редакторе с кольцом (Audacity: выделить, Shift+пробел);
- если склейка щёлкает, сделать перекрёстное затухание 50–100 мс.

## Как это встанет в игру

Сделано в 2.145.0, первая запись — город. Новая запись: `python3 scripts/build-music.py <тема> <файл>`, скрипт сам найдёт кольцо, сделает переход и запишет `public/music/<тема>.ogg` и `src/audio/tracks.json`.

Трек на 2 минуты в Ogg Opus 96 кбит/с весит около 1,4 МБ, семь треков — около 10 МБ. В precache их класть нельзя: первая загрузка станет в разы тяжелее. Поэтому:

- файлы в `public/music/`, кэш service worker по первому запросу (runtime cache), без сети и до загрузки играет нынешний синтез;
- `src/audio/music.ts` играет файл через `AudioBufferSourceNode` с кольцом, громкость и затихание под речь остаются те же (`musicVolume`, `onSpeaking`);
- в APK файлы лежат внутри сборки, там размер не так важен;
- лицензия: на бесплатном тарифе Suno права на коммерческое использование нет, игра бесплатная, но условия стоит проверить перед публикацией.
