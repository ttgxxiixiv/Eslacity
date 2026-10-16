# Промт для листа портретов турецкой версии

Лист устроен как у других языков: 26 портретов, сетка 5×4 для жителей и нижний ряд из шести (Летописец, четыре стража, кузнец), лист вертикальный 2:3 (как 1024×1536). Так `scripts/cut-portraits.py` режет его тем же порядком (`SMALL`: cronista, guardian1–4, smith), координаты рамок снимаются по готовому листу. Хозяина Эха (страж главы V), звонарку Севим и привратника пролога на листе нет, как и у других языков.

С 2.207.0 лист готов: `docs/design/portraits-tr.jpg`, координаты рамок — `SHEETS['tr']` в `scripts/cut-portraits.py`, у персонажей в `look` стоит `portrait` (id жителя, `cronista`, `guardian1`–`guardian4`, `smith`).

Город — эгейский: белые и охристые каменные дома, пристань с паромом на острова, чайная у воды, субботний базар, пекарня с симитами, платаны, герань на балконах, рыбацкие лодки. Земли за городом — те же, что в сюжете других языков: башня на горном перевале, белый город в пустыне, лес шёпотов, Лабиринт Эха.

```
A single large character roster sheet for a high-fantasy RPG, in the style of World of Warcraft: stylized Blizzard-like hand-painted art, bold chunky proportions, slightly exaggerated features (large expressive hands, strong jaws, big eyes), saturated rich colors, painterly textures with visible brushwork, dramatic rim lighting. Atmosphere of The Lord of the Rings, The Hobbit and Harry Potter: an old-world medieval fantasy realm, candlelight, parchment, runes, stone and timber, a touch of gentle magic. No modern objects, no modern clothing, no electronics.

The setting is a sunny medieval fantasy harbour town on an Aegean-like coast: whitewashed and ochre stone houses, a wooden pier with a ferry boat to the islands, a tea house by the water, plane trees, red geraniums on balconies, fishing boats, copper trays and tulip-shaped tea glasses.

Format: a vertical sheet with a 2:3 aspect ratio. Layout: 26 bust portraits in a neat grid: 5 rows of 4 large portraits for the town folk, then a final row of 6 smaller portraits for the heroes of the road. Each portrait sits in an ornate WoW-style frame of carved gold and dark stone with small gems and rune engravings. Under each portrait there is a parchment scroll plate with the name written exactly as given, in dark-brown serif lettering, Cyrillic script, no other text. The whole sheet lies on a dark oak table with candles, a quill and an old map at the edges. Every face is unique; vary age, face shape, skin tone and expression. Townsfolk look warm and friendly, the guardians solemn and mysterious.

Town folk, row by row, left to right (each shown at their own place in the town):
1. «Хасан-уста» — keeper of the tea house by the pier, olive skin, short black hair, thick moustache, dark red waistcoat and apron. Cheerful host carrying a copper tray with tulip-shaped glasses of red tea. Background: tea house with a big double teapot and low stools by the sea.
2. «Тётушка Фатма» — vegetable seller at the Saturday market, olive skin, dark hair in a bun under a light scarf, terracotta dress and apron. Loud and generous, holding out a ripe tomato. Background: market stall of tomatoes, peppers and peaches under an awning, brass scales.
3. «Мехмет» — baker and keeper of the bakery shop, fair skin, short brown hair, moustache, flour-dusted white shirt and apron. Sleepy but kind, holding a long wooden peel with ring-shaped sesame breads. Background: stone oven glowing with fire.
4. «Кемаль-уста» — master cook of the fish tavern on the waterfront, olive skin, short black hair, moustache, white cook's smock and tall cloth cap. Proud and loud, holding a grilled sea bass on a platter. Background: tavern by the water with lanterns and fishing boats.
5. «Нермин-ханым» — elderly neighbour, fair skin, grey hair in a bun, round spectacles, plum-coloured cardigan. Motherly, holding a tiny copper coffee pot. Background: balcony with red geraniums over a narrow street.
6. «Дядя Рыза» — old retired man, olive skin, bald, white moustache, flat cap, olive-green jacket. Sly and stubborn, rolling dice over a wooden backgammon board. Background: shade of a huge plane tree in the town square.
7. «Селин» — young clothier and seamstress, fair skin, long dark-brown hair, raspberry-pink gown. Honest and stylish, holding up an embroidered linen shirt, a tape measure around her neck. Background: shop with bolts of cotton and silk.
8. «Зейнеп-ханым» — apothecary, fair skin, black hair in a bun, spectacles, white robe over a slate-blue dress. Calm and wise, a small vial of linden-flower tincture in her hand. Background: shelves of jars, dried herbs and flasks.
9. «Учительница Элиф» — tutor of the town school, olive skin, long brown hair, spectacles, deep-blue scholar's robe. Patient and smiling, drawing vowel signs with chalk. Background: classroom with a slate board.
10. «Джемиль» — town postman, olive skin, short black hair, mustard-yellow tunic and cap. Quick and talkative, a satchel of sealed letters, a small two-wheeled cart behind him. Background: steep cobbled street with stairs.
11. «Мурат-бей» — clerk of the coin vault, fair skin, neatly combed black hair, spectacles, dark navy doublet with a cravat. Very polite and precise, counting coins on a ledger. Background: vault counter with iron-bound chests.
12. «Юсуф» — barber, olive skin, short black hair, moustache, white smock. Talkative and joking, a straight razor and a small torch for singeing ears. Background: barber shop with a brass mirror and cologne bottles.
13. «Дениз» — training master of the arena, olive skin, long dark hair tied back, sea-green leather training armour, headband. Energetic, counting out loud with her fingers. Background: training yard on the seafront at dawn.
14. «Капитан Исмаил» — ferry captain and keeper of the pier, dark skin, white hair and beard, navy captain's coat and cap. Weathered and calm, holding a ship's rope, gulls around him. Background: pier with a wooden ferry and islands on the horizon.
15. «Джан» — beach lifeguard, dark skin, curly dark hair, red sleeveless tunic. Watchful, a spyglass in hand and a horn at his belt. Background: sandy cove with a watchtower and a cape.
16. «Эбру» — steward of the town office, fair skin, long chestnut hair, slate-purple jacket with a badge. Busy, scrolls in one hand and a coffee cup in the other. Background: office with ledgers and a big wall calendar.
17. «Лейла-ханым» — keeper of a family guesthouse in an old stone house, fair skin, light-brown hair in a bun, brown dress and apron. Welcoming, holding a breakfast tray with seven little jam bowls. Background: courtyard with a vine and a sea view.
18. «Доктор Гюль» — healer of the House of Healing, olive skin, short dark hair, white robe. Calm and caring, soft healing light in her palm. Background: bright healing hall.
19. «Бурак» — young griffon master of the sky port, fair skin, short brown hair, blue uniform coat with a cravat and a badge. Dreams of distant lands, a travel map in hand. Background: griffon roost on a cliff tower.
20. «Комиссар Нихат» — commissioner of the town watch, olive skin, short grey hair, moustache, navy tabard with a silver badge. Quiet, sharp-eyed, a notebook and a pencil in hand. Background: watch house with notices.

Heroes of the road, the final row of six, left to right:
21. «Летописец» — wandering chronicler in the spirit of a wise wizard, light olive skin, silver-white hair and beard, purple travelling robe. Thoughtful, a quill and an ancient leather-bound chronicle. Background: a coastal road at sunrise among olive trees.
22. «Привратник» — guardian of the town gates, olive skin, dark hair, moustache, olive-green armour and cap. Stern but fair, a spear at his side. Background: stone gates with torches.
23. «Орхан» — guardian of the tower on a high mountain pass, fair skin, grey hair and beard that look young and old at once, long grey-blue coat. Patient, sad eyes, standing in the wind. Background: a lone stone tower on a windy mountain pass.
24. «Стражница» — guardian of the white city in the desert, a very old and very wise woman, tan skin, silver-white hair in a bun, sand-coloured flowing robes, a golden circlet. Enigmatic, a faint mirage shimmer around her. Background: a dazzling white city with towers and fountains rising from desert dunes under a full moon.
25. «Хранительница леса» — guardian of the whispering forest, light-tan skin, long moss-green hair, dark green robes woven with leaves. Eyes closed, listening to the trees, glowing fireflies. Background: ancient misty forest.
26. «Ахмет-уста» — the rune blacksmith who forges words, olive skin, short dark hair, moustache, brown shirt and leather apron. Strong and cheerful, hammering glowing runes on an anvil. Background: forge with fire.
```
