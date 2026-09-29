# Промт для листа портретов итальянской версии

По образцу испанского листа `docs/design/portraits-es.jpg`: тот же стиль, та же сетка, итальянские жители и итальянская обстановка. Готовый лист кладётся в `docs/design/portraits-it.jpg`, режет его `scripts/cut-portraits.py` (координаты рамок нужно будет снять заново: в нижнем ряду семь портретов, а не шесть).

Кьяра (магазин одежды) в этой версии — вышивальщица: крестик и ретичелла.

Промт на английском (генераторы картинок лучше понимают английский), подписи на табличках — по-русски, ровно как в игре.

## Промт

```
A single vertical character sheet, 2:3 aspect ratio (1024×1536), for a cozy fantasy RPG set in an Italian town. Painterly digital illustration, warm golden candle light, rich saturated colors, soft brush texture, detailed but readable faces, friendly storybook mood. Same style as a classic fantasy card game: every character sits inside an ornate carved gold frame with rounded corners and a small blue gem on top, and under each portrait there is a parchment name plaque with a dark serif Cyrillic caption.

Background of the whole sheet: a dark wooden table with a large worn board, lit candles in the top corners, green leaves and small orange flowers, an old parchment map with a compass rose, a brass compass, a feather quill, wax seals, a leather-bound book. Everything warm, brown and gold.

Layout: a grid of 20 large portrait cards in 5 rows of 4, then one bottom row of 7 smaller cards. Equal gaps, all frames aligned, no overlapping. Each portrait is a head-and-shoulders or waist-up view, the character looks toward the viewer, and the background inside the frame shows their workplace with Italian details (terracotta roofs, arches, shutters, cypress trees, Vespa scooters, espresso cups, laundry lines, the sea).

Row 1:
1. «Джулия» — young barista, warm brown hair in a bun, apron over a caramel-brown blouse, smiling, drawing a heart in the foam of a cappuccino; espresso machine and pastries behind her.
2. «Синьора Роза» — loud cheerful market woman, black curly hair, red dress and apron, arms open wide over crates of tomatoes, lemons and basil under a striped awning.
3. «Маттео» — calm student cashier, short dark hair, green shirt, headphones around his neck, supermarket shelves and a till behind him.
4. «Шеф Сальваторе» — Neapolitan chef and restaurant owner, black mustache, white chef's hat and jacket, holding a steaming plate of pasta, wood-fired pizza oven glowing behind him.

Row 2:
5. «Синьора Франка» — caring elderly neighbour, grey hair in a bun, round glasses, purple cardigan, holding a tray of lasagna, a kitchen with hanging copper pots.
6. «Дедушка Джино» — old man with a white beard and flat cap, green jacket, holding a bocce ball, a park with a lake, cypress trees and pigeons.
7. «Кьяра» — young embroiderer in a clothes and fabric shop: long golden-blonde hair, a pink dress with an embroidered collar. She holds a round wooden embroidery hoop with a colourful cross-stitch pattern (small crossed stitches forming red and green Italian floral motifs, clearly visible), and over her shoulder lies a strip of white reticella lace — geometric Italian needle lace with open square cut-work cells, radiating bars and little star wheels. Behind her: shelves of fabric rolls, spools of thread, a pincushion, stork-shaped embroidery scissors, a framed cross-stitch sampler on the wall.
8. «Доктор Бруно» — precise pharmacist, grey hair, glasses, white coat, holding a small glass bottle of green tonic, apothecary shelves with jars.

Row 3:
9. «Учительница Анна» — patient teacher, long brown hair, glasses, blue dress, holding an open book of Dante with a softly glowing page, a chalkboard and a bookcase behind her.
10. «Энцо» — hurried young postman, dark hair, yellow shirt, cap, leather mail bag full of letters, a Vespa scooter and a sunny street with arches.
11. «Доктор Ферри» — formal bank clerk, short dark hair, glasses, dark suit and tie, holding a rolled document with a red wax seal, a vault door and brass safe-deposit boxes.
12. «Тонино» — joyful barber singing an opera aria, curly black hair, black mustache, white shirt, scissors and comb in hand, a barber's chair and mirror.

Row 4:
13. «Федерика» — energetic fitness coach, dark hair in a bun, red headband, red sports top, holding a whistle, a gym with ropes and weights.
14. «Альдо» — grumpy precise stationmaster, grey hair, grey mustache, navy uniform and cap, holding a pocket watch, a railway platform with a clock and an old train.
15. «Марко» — relaxed tanned lifeguard, long dark wavy hair, red lifeguard vest, a rope and a life ring on his shoulder, the sea, a lighthouse and beach umbrellas.
16. «Валентина» — busy office manager, brown hair in a bun, glasses, brown blazer, holding a folder and a coffee cup, an office with papers and a wall calendar.

Row 5:
17. «Элиза» — polite hotel receptionist, long black hair, dark red uniform with a name badge, a brass bell and room keys on hooks, an elegant hotel lobby.
18. «Доктор Конти» — calm slightly strict doctor, brown hair in a bun, white coat, stethoscope, a gentle healing light in her hand, a bright hospital room.
19. «Лука» — traveller and airport check-in clerk, short copper-red hair, blue uniform and tie, a board with fridge magnets from many countries, planes behind a big window.
20. «Комиссар Ринальди» — strict but fair police commissioner, short black hair, navy uniform, cap and badge, arms crossed, an office with a city map and files.

Bottom row, 7 smaller cards:
21. «Летописец» — old wise chronicler, white hair and beard, purple robe, writing with a quill in a big book, mountains behind.
22. «Привратник» — city gate guard, dark mustache, olive cloak, helmet and spear, a stone city gate.
23. «Андреа» — guard of the mountain pass tower, dark beard, grey fur-trimmed cloak, a stone tower on a pass.
24. «Стражница» — guardian of the white city, silver-white hair, light golden robes and a headband, white marble buildings.
25. «Хранительница леса» — forest keeper, long green hair with leaves, green dress, glowing green light among ancient trees.
26. «Хозяин Эха» — master of the echo, bald, grey beard, deep violet robe, standing in a stone labyrinth whose walls repeat faint translucent copies of his face like echoes.
27. «Ферруччо» — blacksmith of verbs, brown hair, mustache, leather apron, hammer and a glowing anvil in a forge.

Text: only the Cyrillic names on the plaques, spelled exactly as above, no other text, no English words, no watermarks, no logos.
```

## Если генератор не справляется

- Подписи искажаются: сгенерировать лист без текста («blank parchment name plaques»), имена добавить потом в редакторе — в игре таблички всё равно отрезаются.
- Кьяра выходит без ретичеллы: вынести её отдельно тем же стилем с уточнением «reticella lace: white geometric needle lace, square openwork grid with diagonal bars and small wheels, Italian Renaissance needlework» и вставить в лист.
