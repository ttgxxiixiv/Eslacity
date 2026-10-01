# Промт для портрета путника

Портрет путника для диалогов (сцены, миссии, шёпоты): сейчас вместо него значок 🧭. Он должен стоять рядом с портретами жителей, поэтому стиль тот же, что у листов `docs/design/portraits-<язык>.jpg`: живописная фэнтези в духе World of Warcraft, бюст, свой фон, без рамки. Путник один на оба курса.

Портретов два, по полу путника из настроек (`heroGender`). Лицо скрыто под капюшоном у обоих, пол читается по силуэту: плечи, руки, прядь волос из-под капюшона. Каждый портрет генерируется отдельной картинкой с пропорциями 7:9 (игровой портрет 14:18, режется в 168×216). Готовые картинки кладутся в `docs/design/hero-m.png` и `docs/design/hero-f.png`.

Накидка на портрете простая, тёмная шерстяная: накидки уровней (`docs/design/cloaks-prompt.md`) видны на дороге дня, а портрет в диалогах не меняется. Если захочется, чтобы и портрет менял накидку, это ещё 16 картинок по тому же промту с заменой строки о ткани.

Общая часть промта:

```
A single bust portrait of a hooded wanderer for a high-fantasy RPG, in the style of World of Warcraft: stylized
Blizzard-like hand-painted art, bold chunky proportions, saturated rich colors, painterly textures with visible
brushwork, dramatic rim lighting. Atmosphere of The Lord of the Rings and The Hobbit: an old-world medieval fantasy
realm, a touch of gentle magic. No modern objects. No text, no letters, no frame, no border, no watermark.

Vertical portrait, aspect ratio 7:9, head and shoulders, the figure centered and filling most of the image, the top
of the hood close to the top edge.

The wanderer wears a deep hood of thick dark-brown wool that hides the face completely: inside the hood there is
only soft darkness, no eyes, no nose, no mouth, no glowing eyes, at most a faint warm reflection of lantern light on
the edge of the hood. The cloak is plain dark-brown travelling wool with a worn hem, fastened at the collar with a
small round brass clasp engraved with an open eye. A leather backpack strap crosses the chest. One hand holds a small
brass lantern near the shoulder; its warm amber glow lights the folds of the cloak from below and the side.

Background: an old stone road at dusk winding into misty hills, a distant city with a tall tower on the horizon,
the first stars in a violet-blue sky. The background is darker and less detailed than the figure so the silhouette
reads clearly at a small size (about 40x52 pixels on a phone).

Mood: calm, determined, mysterious, a traveller on a long road to a hidden Vault.
```

Строка для мужского портрета (добавить в конец):

```
The wanderer is a man: broad shoulders, a strong large hand with visible knuckles on the lantern ring, the hood
sits wide and heavy over the shoulders.
```

Строка для женского портрета (добавить в конец):

```
The wanderer is a woman: narrower shoulders, a slender hand on the lantern ring, a long dark-chestnut braid falls
from under the hood over one shoulder and catches the lantern light.
```
