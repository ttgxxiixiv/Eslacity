# Промт для придорожных фонарей

Фонари стоят на дороге дня вместо верстовых камней (камни с листа `daily-road.png` походили на надгробия). Лист — `docs/design/road-posts.png`, режет его `scripts/build-road-art.py` (слева погасший, справа горящий; ключ фона строже обычного, иначе ореол краснеет). К промту прикладывался `docs/design/daily-road.png` как образец стиля.

```
Pixel-art game UI sprites for a mobile RPG, painterly pixel art matching the attached reference exactly
(the same road strip, campfire and hooded wanderer style: warm browns, brass, soft highlights, dark outline,
light from the top-left). No text, no letters, no numbers.

Draw a small roadside lantern post in two states, side by side, same size and same baseline, on a plain
solid magenta (#FF00FF) background with generous empty space around each:

1. Unlit: a short weathered wooden post driven into a tuft of grass and a few pebbles, with a small
   wrought-iron lantern hanging from a little bracket at the top. The lantern glass is dark and empty,
   cool grey-blue tones, no glow.
2. Lit: exactly the same post and lantern, but a warm candle flame burns inside, the glass glows amber,
   a soft golden halo surrounds the lantern head, and a faint warm light falls on the top of the post.

The post must read clearly as a lamp post at a tiny size (about 9x12 CSS pixels on a phone, tall and narrow,
roughly 3:4): a thin vertical post, a distinct lantern shape at the top, no rounded slab, no cross, nothing
that looks like a gravestone. Keep the glow compact so it does not spill far beyond the lantern.
```
