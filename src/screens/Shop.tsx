import { useState } from 'react';
import { decorIcon } from '../components/CityDecorCard';
import { NpcPortrait } from '../components/NpcPortrait';
import { Button, Screen, TopBar } from '../components/ui';
import { LOCATION_BY_ID } from '../content/locations';
import { NPCS } from '../content/npcs';
import { ECONOMY } from '../config';
import { chapterById } from '../domain/chapters';
import { DECOR, earnedDecor } from '../domain/decor';
import { plural } from '../domain/medals';
import { rankOf } from '../domain/reputation';
import { GIFT_REP, giftState, HINT_PACK, priceFactor, shopPrice } from '../domain/shop';
import { canBuyFreeze } from '../domain/streak';
import { dayNumber } from '../domain/srs';
import { useCity } from '../store/city';
import { useErrands } from '../store/errands';
import { useJourney } from '../store/journey';
import { useMotivation } from '../store/motivation';
import { useRewards } from '../store/rewards';

const coinsLabel = (n: number) => `🪙 ${n}`;

/** Строка товара: название, пояснение, цена и кнопка покупки. */
function Ware({ title, text, price, disabled, note, onBuy, testId }: {
  title: string; text: string; price: number; disabled: boolean; note?: string; onBuy: () => void; testId: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm" data-testid={testId}>
      <div className="min-w-0 flex-1">
        <div className="font-semibold">{title}</div>
        <p className="text-sm text-stone-500">{text}</p>
        {note && <p className="text-xs text-amber-700">{note}</p>}
      </div>
      <Button variant="secondary" className="shrink-0 px-3 py-2 tabular-nums" disabled={disabled} onClick={onBuy}>
        {coinsLabel(price)}
      </Button>
    </div>
  );
}

/**
 * Лавка (задача 13.4): монеты на расходники и украшения города. Цены растут с открытой главой (`priceFactor`),
 * заморозка стрика стоит одинаково. Подарки — жителям с «Приятеля», одному раз в неделю.
 */
export function ShopScreen() {
  const coins = useCity((s) => s.coins);
  const chapter = useJourney((s) => s.opened);
  const rec = useRewards((s) => s.rec);
  const medals = useMotivation((s) => s.medals);
  const streak = useMotivation((s) => s.streak);
  const rep = useErrands((s) => s.rep);
  const [said, setSaid] = useState('');
  const today = dayNumber(Date.now());
  const price = (id: Parameters<typeof shopPrice>[0]) => shopPrice(id, chapter);
  const roman = chapterById(chapter)?.roman;

  const earned = earnedDecor(medals);
  const bought = rec.boughtDecor ?? [];
  const decorOnSale = DECOR.filter((d) => !earned.includes(d) && !bought.includes(d.line));
  const friends = NPCS.map((npc) => ({ npc, state: giftState(rep[npc.id] ?? 0, rec.gifts?.[npc.id], today) }));
  const open = friends.filter((f) => f.state.kind !== 'locked');

  return (
    <Screen>
      <TopBar title="Лавка" right={<span className="font-semibold tabular-nums" data-testid="shop-coins">{coinsLabel(coins)}</span>} />
      <div className="flex flex-col gap-3 px-4 pb-8">
        <p className="text-sm text-stone-600">
          Цены главы {roman}{priceFactor(chapter) > 1 ? ` (×${priceFactor(chapter)} к началу пути)` : ''}: чем дальше путь, тем богаче
          город и дороже товар. Монеты не открывают новых слов и глав, их открывает карта.
        </p>
        {said && (
          <p className="rounded-2xl bg-okbg px-4 py-2 text-sm font-semibold" role="status" data-testid="shop-said">
            {said}
          </p>
        )}

        <h2 className="mt-2 font-bold">Для пути</h2>
        <Ware
          testId="shop-hints"
          title={`Жетоны подсказки ×${HINT_PACK}`}
          text={`Открывают первую букву при вводе слова. Сейчас на руках: ${rec.hints}.`}
          price={price('hints')}
          disabled={coins < price('hints')}
          onBuy={() => useRewards.getState().buyHints(HINT_PACK, price('hints')) && setSaid(`Куплено ${HINT_PACK} жетона подсказки.`)}
        />
        <Ware
          testId="shop-freeze"
          title="Заморозка стрика"
          text={`Сама тратится, если пропущен день. Сейчас: ${'🧊'.repeat(streak.freezes) || 'нет'}.`}
          note={streak.freezes >= ECONOMY.maxFreezes ? `Больше ${ECONOMY.maxFreezes} не унести.` : undefined}
          price={price('freeze')}
          disabled={!canBuyFreeze(streak, coins)}
          onBuy={() => useMotivation.getState().buyFreeze() && setSaid('Заморозка в сумке.')}
        />

        <h2 className="mt-2 font-bold">Подарки жителям</h2>
        <p className="-mt-1 text-sm text-stone-500">
          С отношений «{rankOf(5).ru}» жителю можно раз в неделю подарить что-нибудь из лавки: +{GIFT_REP} к отношениям, а с ними скидка на
          улучшение здания и тёплые приветствия.
        </p>
        {open.length ? (
          open.map(({ npc, state }) => (
            <div key={npc.id} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm" data-testid="shop-gift">
              <NpcPortrait look={npc.look} size={48} label={npc.name} />
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{npc.name}</div>
                <div className="text-sm text-stone-500">
                  {LOCATION_BY_ID[npc.location]?.ru} · {rankOf(rep[npc.id] ?? 0).ru}
                </div>
                {state.kind === 'wait' && (
                  <div className="text-xs text-stone-500">снова через {state.days} {plural(state.days, ['день', 'дня', 'дней'])}</div>
                )}
              </div>
              <Button
                variant="secondary"
                className="shrink-0 px-3 py-2 tabular-nums"
                disabled={state.kind !== 'ready' || coins < price('gift')}
                onClick={() => {
                  const r = useRewards.getState().giveGift(npc.id, price('gift'), today);
                  if (r !== false) setSaid(r ? `${npc.name}: теперь вы — ${r.ru.toLowerCase()}!` : `${npc.name} рад${npc.gender === 'f' ? 'а' : ''} подарку.`);
                }}
              >
                🎁 {price('gift')}
              </Button>
            </div>
          ))
        ) : (
          <p className="rounded-2xl bg-white p-3 text-sm text-stone-500 shadow-sm">
            Пока никто из жителей не стал вам приятелем: поручения и миссии сближают.
          </p>
        )}

        <h2 className="mt-2 font-bold">Украшения города</h2>
        <p className="-mt-1 text-sm text-stone-500">
          Обычно украшение ставит золотая медаль линии. Не хочется ждать медали — его можно купить и поставить у здания сразу.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {decorOnSale.map((d) => (
            <div key={d.line} className="flex flex-col items-center gap-1 rounded-2xl bg-[#3b4a2c] p-2 text-center text-[#f1dfb5]" data-testid="shop-decor">
              <img src={decorIcon(d.line)} alt="" className="h-12 w-auto max-w-[84px] object-contain" draggable={false} />
              <span className="text-xs leading-tight">
                {d.title}
                <br />
                {LOCATION_BY_ID[d.place].ru}
              </span>
              <Button
                variant="secondary"
                className="w-full px-2 py-1.5 text-sm tabular-nums"
                disabled={coins < price('decor')}
                onClick={() => useRewards.getState().buyDecor(d.line, price('decor')) && setSaid(`${d.title} — у здания «${LOCATION_BY_ID[d.place].ru}».`)}
              >
                {coinsLabel(price('decor'))}
              </Button>
            </div>
          ))}
        </div>
        {!decorOnSale.length && <p className="text-sm text-stone-500">Все украшения уже в городе.</p>}
      </div>
    </Screen>
  );
}
