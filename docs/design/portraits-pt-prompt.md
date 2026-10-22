# Промт для листа портретов португальской версии

Лист устроен как у других языков: 26 портретов, сетка 5×4 для жителей и нижний ряд из шести (Летописец, четыре стража, кузнец), лист вертикальный 2:3 (как 1024×1536). Так `scripts/cut-portraits.py` режет его тем же порядком (`SMALL`: cronista, guardian1–4, smith), координаты рамок снимаются по готовому листу и пишутся в `SHEETS['pt']`. Хозяина Эха (страж главы V), звонарку Дону Сокорро и привратника пролога на листе нет, как и у других языков.

Пока листа нет, у персонажей в `look` нет поля `portrait`, и в диалогах рисуется пиксельная фигурка. Когда лист готов: положить его в `docs/design/portraits-pt.jpg`, снять рамки, нарезать и проставить `portrait` (id жителя, `cronista`, `guardian1`–`guardian4`, `smith`).

Город — бразильский, на побережье северо-востока: разноцветные дома с белыми рамами окон, мощёные улицы в гору, старая церковь, площадь с деревом и столами для домино, рынок с манго и ананасами, пляж с пальмами и вышкой спасателя, причал с рыбацкими лодками-жангадами. Земли за городом — те же, что в сюжете других языков: башня на горном перевале, белый город в пустыне, лес шёпотов (здесь — тропическая мата), Лабиринт Эха.

```
A single large character roster sheet for a high-fantasy RPG, in the style of World of Warcraft: stylized Blizzard-like hand-painted art, bold chunky proportions, slightly exaggerated features (large expressive hands, strong jaws, big eyes), saturated rich colors, painterly textures with visible brushwork, dramatic rim lighting. Atmosphere of The Lord of the Rings, The Hobbit and Harry Potter: an old-world medieval fantasy realm, candlelight, parchment, runes, stone and timber, a touch of gentle magic. No modern objects, no modern clothing, no electronics.

The setting is a sunny medieval fantasy harbour town on a tropical coast, inspired by colonial towns of north-eastern Brazil: colourful plastered houses with white window frames, steep cobbled streets, an old white church, a square with a huge shade tree, palm trees, a sandy beach, wooden fishing rafts with triangular sails, baskets of mangoes, pineapples and coconuts.

Format: a vertical sheet with a 2:3 aspect ratio. Layout: 26 bust portraits in a neat grid: 5 rows of 4 large portraits for the town folk, then a final row of 6 smaller portraits for the heroes of the road. Each portrait sits in an ornate WoW-style frame of carved gold and dark stone with small gems and rune engravings. Under each portrait there is a parchment scroll plate with the name written exactly as given, in dark-brown serif lettering, Cyrillic script, no other text. The whole sheet lies on a dark oak table with candles, a quill and an old map at the edges. Every face is unique; vary age, face shape, skin tone and expression (the town is mixed: European, African and Indigenous features). Townsfolk look warm and friendly, the guardians solemn and mysterious.

Town folk, row by row, left to right (each shown at their own place in the town):
1. «Сеу Тоньо» — keeper of the coffee house on the square, middle-aged, brown skin, short black hair, moustache, brown waistcoat and apron. Cheerful gossip, pouring strong coffee from a cloth strainer into a tiny cup. Background: coffee house with sacks of beans and cheese buns on a tray.
2. «Дона Граса» — fruit seller at the street market, brown skin, dark hair in a bun, terracotta dress and apron. Loud and laughing, holding out a ripe mango. Background: stall of mangoes, bananas and pineapples under a striped awning.
3. «Веллингтон» — young shop clerk of the corner store, light-brown skin, short black hair, green tunic with a small badge. Neat and ambitious, a ledger and a quill behind his ear. Background: shelves of jars, sacks and bread.
4. «Дона Дита» — cook of a seaside tavern, dark skin, black hair under a white cloth cap, cream smock and apron. Proud and secretive, a steaming clay pot of fish stew with peppers. Background: tavern kitchen with hanging peppers and a wood fire.
5. «Дона Лурдес» — elderly neighbour, fair skin, grey hair in a bun, spectacles, plum-coloured dress. Curious and motherly, watering flowers with a copper can. Background: a window with blue shutters and potted flowers over a cobbled street.
6. «Сеу Валдир» — old retired man, light-brown skin, bald, white moustache, flat cap, olive-green jacket. Stubborn and funny, slapping a domino tile on a wooden table. Background: the shade of a huge tree on the town square, pigeons.
7. «Жулиана» — young seamstress of the clothes shop, light-brown skin, long brown hair, raspberry-pink gown. Honest and stylish, holding up an embroidered linen shirt, a tape measure around her neck. Background: shop with bolts of bright cotton.
8. «Дона Роза» — apothecary, fair skin, black hair in a bun, spectacles, white robe over a slate-blue dress. Calm and wise, offering a cup of herbal tea. Background: shelves of jars, dried herbs and flasks.
9. «Профессора Марсия» — tutor of the town school, brown skin, long dark-brown hair, spectacles, deep-blue scholar's robe. Patient and smiling, chalk in hand. Background: classroom with a slate board.
10. «Эдсон» — town postman, brown skin, short black hair, mustard-yellow tunic and cap. Quick and cheerful, a satchel of sealed letters, riding an old wooden bicycle-like handcart. Background: steep cobbled street with colourful houses.
11. «Сеньор Рикардо» — manager of the coin vault, fair skin, neatly combed black hair, spectacles, dark navy doublet with a cravat. Very polite and precise, counting coins on a ledger. Background: vault counter with iron-bound chests.
12. «Зе Карлос» — barber, dark skin, short black hair, moustache, white smock. Joking with a grin, scissors and comb in hand. Background: barber shop with a brass mirror and a sea view.
13. «Тати» — training master of the arena on the seafront, light-brown skin, long dark hair tied back, teal leather training armour, headband. Energetic, counting out loud on her fingers. Background: training yard on the beach at dawn.
14. «Сеу Раймунду» — keeper of the coach station and the pier, brown skin, white hair and short beard, navy coat and cap. Calm and wise, a big brass pocket watch and a timetable scroll. Background: pier with wooden rafts and a coach with horses.
15. «Бруну» — beach lifeguard, dark skin, curly black hair, red sleeveless tunic. Watchful, a spyglass in hand and a horn at his belt. Background: sandy cove with palms and a wooden watchtower.
16. «Патрисия» — steward of the town office, light-brown skin, long auburn hair, slate-purple jacket with a badge. Busy, scrolls in one hand and a coffee cup in the other. Background: office with ledgers and a big wall calendar.
17. «Дона Элена» — keeper of a family guesthouse in an old house with a veranda, fair skin, light-brown hair in a bun, brown dress and apron. Welcoming, holding a breakfast tray of tropical fruits and a jug of passion-fruit juice. Background: veranda with hammocks and a sea view.
18. «Доктор Фернанда» — healer of the House of Healing, brown skin, short dark hair, white robe. Calm and caring, soft healing light in her palm. Background: bright healing hall.
19. «Тьягу» — young griffon master of the sky port, fair skin, short brown hair, blue uniform coat with a cravat and a badge. Dreams of distant lands, a travel map in hand. Background: griffon roost on a cliff tower above the sea.
20. «Делегаду Морейра» — commissioner of the town watch, light-brown skin, short grey hair, moustache, navy tabard with a silver badge. Quiet, sharp-eyed, a notebook and a pencil in hand. Background: watch house with notices.

Heroes of the road, the final row of six, left to right:
21. «Летописец» — wandering chronicler in the spirit of a wise wizard, light-brown skin, silver-white hair and beard, purple travelling robe. Thoughtful, a quill and an ancient leather-bound chronicle. Background: a coastal road at sunrise among palm trees.
22. «Привратник» — guardian of the town gates, light-brown skin, dark hair, moustache, olive-green armour and cap. Stern but fair, a spear at his side. Background: stone gates with torches.
23. «Северину» — guardian of the tower on a high mountain pass, brown skin, grey hair and beard that look young and old at once, long grey-blue coat. Patient, sad eyes, standing in the wind. Background: a lone stone tower on a windy mountain pass.
24. «Стражница» — guardian of the white city in the desert, a very old and very wise woman, brown skin, dark hair streaked with silver, sand-coloured flowing robes, a golden circlet. Enigmatic, a faint mirage shimmer around her. Background: a dazzling white city with towers and fountains rising from desert dunes under a full moon.
25. «Хранительница леса» — guardian of the whispering rainforest, brown skin, long dark hair woven with leaves and flowers, dark green robes. Eyes closed, listening to the trees, glowing fireflies. Background: ancient misty tropical forest with vines.
26. «Мастер Бене» — the rune blacksmith who forges words, dark skin, short black hair, short beard, brown shirt and leather apron. Strong and cheerful, hammering glowing runes on an anvil. Background: forge with fire.
```

С 2.230.0 лист готов: `docs/design/portraits-pt.jpg`, координаты рамок — `SHEETS['pt']` в `scripts/cut-portraits.py`, 26 портретов в `src/assets/portraits/pt/`.
