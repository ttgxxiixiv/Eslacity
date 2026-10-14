# Промт для листа портретов английской версии

С 2.186.0 лист готов (`docs/design/portraits-en.jpg`), портреты у всех 20 жителей, Летописца, четырёх стражей и кузнеца. Лист устроен как испанский и итальянский: 26 портретов, сетка 5×4 для жителей и нижний ряд из шести (Летописец, четыре стража, кузнец), лист вертикальный 2:3 (как 1024×1536). Так `scripts/cut-portraits.py` режет его тем же порядком (`SMALL`: cronista, guardian1–4, smith), координаты рамок снимаются заново по готовому листу. Хозяина Эха (страж главы V), звонарку Агнес и привратника пролога на листе нет, как и у других языков.

Готовый лист кладётся в `docs/design/portraits-en.jpg`. Дальше: координаты в `SHEETS['en']` скрипта, `python3 scripts/cut-portraits.py en`, у персонажей в `look` появляется `portrait` (имя файла: id жителя, `cronista`, `guardian1`–`guardian4`, `smith`).

Город — британский приморский: белые скалы, маяк, пирс, рыбные лавки, дождь и чай. Земли за городом — как в сюжете английского курса: маяк на горном перевале в тумане, белый город в пустыне, лес шёпотов, Лабиринт Эха.

```
A single large character roster sheet for a high-fantasy RPG, in the style of World of Warcraft: stylized Blizzard-like hand-painted art, bold chunky proportions, slightly exaggerated features (large expressive hands, strong jaws, big eyes), saturated rich colors, painterly textures with visible brushwork, dramatic rim lighting. Atmosphere of The Lord of the Rings, The Hobbit and Harry Potter: an old-world medieval fantasy realm, candlelight, parchment, runes, stone and timber, a touch of gentle magic. No modern objects, no modern clothing, no electronics.

The setting is a windswept medieval fantasy harbour town inspired by old England: white chalk cliffs, a wooden pier, slate roofs, half-timbered houses, gulls, drizzle and warm tea rooms.

Format: a vertical sheet with a 2:3 aspect ratio. Layout: 26 bust portraits in a neat grid: 5 rows of 4 large portraits for the town folk, then a final row of 6 smaller portraits for the heroes of the road. Each portrait sits in an ornate WoW-style frame of carved gold and dark stone with small gems and rune engravings. Under each portrait there is a parchment scroll plate with the name written exactly as given, in dark-brown serif lettering, Cyrillic script, no other text. The whole sheet lies on a dark oak table with candles, a quill and an old map at the edges. Every face is unique; vary age, face shape, skin tone and expression. Townsfolk look warm and friendly, the guardians solemn and mysterious.

Town folk, row by row, left to right (each shown at their own place in the town):
1. «Молли» — young keeper of a cosy tea room, fair skin, ginger hair in a bun, brown bodice and linen apron. Chatty and cheerful, pouring tea from a big copper kettle. Background: tea counter with cups and scones.
2. «Миссис Патель» — fruit seller, brown skin, black hair in a bun, deep red dress and apron. Warm and bargaining, offering a shiny red apple. Background: market stall of apples and pears under a striped awning, brass scales.
3. «Джейк» — young clerk of the provisions store, fair skin, sandy hair, teal tunic. Relaxed and a little sleepy, leaning on the counter. Background: shelves with sacks, jars and tins.
4. «Шеф Арчи» — master cook of the fish tavern, light skin, short brown hair, moustache, white cook's smock and tall cloth cap. Proud and loud, holding a platter of golden fried fish and chips. Background: tavern kitchen by the harbour.
5. «Миссис Хиггинс» — elderly neighbour, fair skin, white hair in a bun, round spectacles, sage-green cardigan. Motherly, holding a teapot and an old handwritten cookbook. Background: cosy cottage kitchen with a kettle on the hearth.
6. «Старина Берт» — old retired man, fair skin, bald with a white beard, flat tweed cap, brown coat. Kind storyteller, sitting on a park bench with bread for the ducks. Background: town park with ducks on a pond and an old oak.
7. «Хлоя» — young clothier and dressmaker, fair skin, long chestnut hair, rose-pink gown. Stylish, holding up a thick woollen scarf, a tape measure around her neck. Background: shop with bolts of wool and tweed.
8. «Мистер Шах» — apothecary, brown skin, short black hair, round spectacles, pale robe. Calm and precise, a small glowing potion vial in hand. Background: shelves of flasks, herbs and jars of throat sweets.
9. «Мисс Эванс» — tutor of the town school, fair skin, long brown hair, spectacles, deep-blue scholar's robe. Strict in class but smiling, holding a book and a chalk stick. Background: classroom with a slate board.
10. «Дэн» — town postman, light-tan skin, short dark hair, red tunic and cap. Always on the move, a satchel of sealed letters, a big black raven perched on his shoulder. Background: rainy cobbled street.
11. «Мистер Уитмор» — manager of the coin vault, fair skin, neatly combed hair, spectacles, dark doublet with a cravat. Very polite and precise, holding a ledger. Background: vault counter with iron-bound chests.
12. «Лиам» — barber, light-tan skin, curly dark hair, moustache, teal smock. Joking, scissors and a shaving brush in hand. Background: barber shop with a brass mirror.
13. «Зои» — training master of the arena, light-tan skin, dark hair in a high bun, orange leather training armour, headband. Cheering loudly, fist raised. Background: training yard with stone steps.
14. «Грэм» — station master of the coaching station, fair skin, grey hair, moustache, navy coat with brass buttons and a cap, a pipe in his pocket. Punctual, checking a brass pocket watch. Background: station yard with a stagecoach and a timetable board.
15. «Финн» — harbour lifeguard, fair skin, long sun-bleached hair, red sleeveless tunic. Watching the waves, a coil of rope and a horn at his belt. Background: sandy beach with flags and the sea.
16. «Прия» — steward of the town office, brown skin, black hair in a bun, spectacles, purple velvet jacket. Busy, scrolls in one hand and a cup of tea in the other. Background: office with ledgers and archive shelves.
17. «Эмма» — innkeeper of a seaside inn, fair skin, long golden hair, teal gown with a brooch. Welcoming, holding an iron room key with a number tag. Background: inn hall with a fireplace and sea view.
18. «Доктор Окафор» — healer of the House of Healing, dark skin, black hair in a bun, white robe over blue tunic. Calm and kind, soft healing light in her palm. Background: healing hall.
19. «Том» — young griffon master of the sky port, fair skin, short brown hair, blue uniform coat with a cravat. Dreams of distant lands, a small travel map in hand. Background: griffon roost on a cliff tower.
20. «Инспектор Брэдли» — inspector of the town watch, light-tan skin, short dark hair, navy tabard with a silver badge, cap. Quiet, observant and formal, a notebook in hand. Background: watch house with notices.

Heroes of the road, the final row of six, left to right:
21. «Летописец» — wandering chronicler in the spirit of a wise wizard, light olive skin, silver-white hair and beard, purple travelling robe. Thoughtful, a quill and an ancient leather-bound chronicle. Background: a coastal road at sunrise.
22. «Привратник» — guardian of the town gates, light skin, dark hair, moustache, olive-green armour and cap. Stern but fair, a spear at his side. Background: stone gates with torches.
23. «Освальд» — guardian of the lighthouse on a high mountain pass, fair skin, grey hair and beard that look young and old at once, long grey coat. Patient, sad eyes, holding a glowing lantern. Background: a lone lighthouse on a misty mountain pass, fog all around.
24. «Стражница» — guardian of the white city in the desert, a very old and very wise woman, tan skin, silver-white hair in a bun, sand-coloured flowing robes, a golden circlet. Enigmatic, a faint mirage shimmer around her. Background: a dazzling white city with towers and fountains rising from desert dunes under a full moon.
25. «Хранительница леса» — guardian of the whispering forest, light-tan skin, long moss-green hair, dark green robes woven with leaves. Eyes closed, listening to the trees, glowing fireflies. Background: ancient misty forest.
26. «Гарет» — the rune blacksmith who forges words, fair skin, auburn hair and beard, brown shirt and leather apron. Strong and cheerful, hammering glowing runes on an anvil. Background: forge with fire.
```
