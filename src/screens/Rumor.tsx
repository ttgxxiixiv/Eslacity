import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listeningEnabled, speak, speakAs } from '../audio/tts';
import { wordsByIds } from '../content';
import { CHRONICLER, NPC_BY_ID, npcFor } from '../content/npcs';
import { loadRumors } from '../content/rumors';
import type { Rumor, Word } from '../content/schema';
import { logAnswer } from '../db/answers';
import { seeded } from '../domain/generators';
import { wordIds } from '../domain/itemId';
import { plural } from '../domain/medals';
import { buildRumorEvent, nextRumor, RUMOR_MIN_WORDS, RUMOR_PLACE, RUMOR_TITLE, rumorCoins, rumorDue, rumorKind, rumorRight, type RumorEvent } from '../domain/rumor';
import { priceFactor } from '../domain/shop';
import { dayNumber } from '../domain/srs';
import { NpcPortrait } from '../components/NpcPortrait';
import { Button, Screen, TopBar } from '../components/ui';
import { useCity } from '../store/city';
import { useJourney } from '../store/journey';
import { useProgress } from '../store/progress';
import { useMotivation } from '../store/motivation';
import { useRumors } from '../store/rumors';

/** Кто рассказал слух: житель или Летописец. */
const speakerOf = (who: string) => NPC_BY_ID[who] ?? (who === CHRONICLER.id ? CHRONICLER : undefined);

/**
 * Слухи города (задача 13.7): событие дня на минуту из выученных слов. Верный ответ — монеты и слух жителя,
 * ошибка — правильный ответ и новое событие того же вида. Внизу — собранные слухи.
 */
export function RumorScreen() {
  const nav = useNavigate();
  const today = dayNumber(Date.now());
  const rec = useRumors((s) => s.rec);
  const opened = useJourney((s) => s.opened);
  const [learned, setLearned] = useState<Word[] | null>(null);
  const [rumors, setRumors] = useState<Rumor[]>([]);
  const [seed, setSeed] = useState(() => Date.now());
  const [result, setResult] = useState<{ right: boolean; coins: number; rumor: Rumor | null } | null>(null);
  const kind = rumorKind(today);

  useEffect(() => {
    let alive = true;
    Promise.all([wordsByIds(wordIds(Object.keys(useProgress.getState().cards))), loadRumors()]).then(([ws, rs]) => {
      if (!alive) return;
      setLearned(ws);
      setRumors(rs);
    });
    return () => {
      alive = false;
    };
  }, []);

  const event = useMemo(() => (learned ? buildRumorEvent(kind, learned, seeded(seed)) : null), [learned, kind, seed]);
  const due = rumorDue(rec, today);
  const host = npcFor(RUMOR_PLACE[kind]);

  const answer = (given: string) => {
    if (!event) return;
    const right = rumorRight(event, given);
    logAnswer({ itemId: event.word.id, kind: `rumor-${event.kind}`, verdict: right ? 'correct' : 'wrong', mode: 'rumor', ms: 0 });
    if (!right) return setResult({ right, coins: 0, rumor: null });
    const coins = rumorCoins(priceFactor(opened));
    const rumor = nextRumor(rumors, rec.got, opened);
    useCity.getState().addCoins(coins);
    useRumors.getState().complete(today, rumor?.id ?? null);
    // Слух — запись дневника (задача 13.8): полный дневник главы даёт тайную медаль.
    useMotivation.getState().evaluate(Date.now(), {});
    setResult({ right, coins, rumor });
  };

  const got = rumors.filter((r) => rec.got.includes(r.id));

  return (
    <Screen>
      <TopBar title="Слухи города" />
      <div className="flex flex-col gap-3 px-4 pb-8">
        {learned === null ? null : result?.right ? (
          <RumorReward coins={result.coins} rumor={result.rumor} />
        ) : !due ? (
          <p className="rounded-2xl bg-white p-4 text-center shadow-sm" data-testid="rumor-done">
            Сегодня вы уже узнали слух. Завтра в городе случится что-нибудь ещё.
          </p>
        ) : !event ? (
          <p className="rounded-2xl bg-white p-4 text-center shadow-sm" data-testid="rumor-empty">
            Пока в городе тихо. Выучите хотя бы {RUMOR_MIN_WORDS} слов, и жители начнут с вами делиться новостями.
          </p>
        ) : (
          <div className="rounded-2xl bg-white p-3 shadow-sm" data-testid="rumor-event" data-kind={event.kind}>
            <div className="flex items-center gap-3">
              {host && <NpcPortrait look={host.look} size={56} />}
              <div>
                <div className="font-bold">{RUMOR_TITLE[event.kind]}</div>
                <div className="text-sm text-stone-500">{host?.name} расскажет слух, если поможете</div>
              </div>
            </div>
            {result && !result.right ? (
              <div className="mt-3 flex flex-col gap-2">
                <p className="rounded-xl bg-badbg px-3 py-2" data-testid="rumor-wrong">
                  {/* Что было в задании: без этого правильный ответ не к чему приложить. */}
                  {event.kind !== 'cat' && <span className="block text-lg">«{event.kind === 'notice' ? event.text : event.word.es}»</span>}
                  Не то. Правильно: <span className="font-semibold">{event.answer}</span>
                </p>
                <Button
                  onClick={() => {
                    setResult(null);
                    setSeed((s) => s + 1);
                  }}
                  data-testid="rumor-retry"
                >
                  Ещё раз
                </Button>
              </div>
            ) : (
              <RumorTask key={seed} event={event} onAnswer={answer} />
            )}
          </div>
        )}

        <h2 className="mt-3 font-bold">Собранные слухи</h2>
        <p className="-mt-2 text-sm text-stone-500 tabular-nums" data-testid="rumor-count">
          {got.length} из {rumors.filter((r) => r.chapter <= opened).length} {plural(got.length, ['слух', 'слуха', 'слухов'])} открытых глав
        </p>
        {got.map((r) => (
          <RumorLine key={r.id} rumor={r} />
        ))}
        <Button variant="secondary" onClick={() => nav('/')}>
          В город
        </Button>
      </div>
    </Screen>
  );
}

/** Задание события: на слух, буквы или объявление. */
function RumorTask({ event, onAnswer }: { event: RumorEvent; onAnswer(given: string): void }) {
  const sound = listeningEnabled();
  const [chosen, setChosen] = useState<number[]>([]);
  useEffect(() => {
    if (event.kind === 'guest' && sound) speak(event.word.es);
  }, [event, sound]);

  if (event.kind === 'cat') {
    return (
      <div className="mt-3 flex flex-col gap-2">
        <p>
          Кот утащил с прилавка слово «<span className="font-semibold" data-testid="rumor-ru">{event.word.ru}</span>» и рассыпал буквы. Соберите его.
        </p>
        <div className="flex min-h-12 flex-wrap gap-1.5 rounded-xl border-2 border-dashed border-stone-300 p-2" data-testid="rumor-built">
          {chosen.map((i, pos) => (
            <button key={i} type="button" className="press h-10 min-w-9 rounded-lg bg-orange-50 px-2 text-lg" onClick={() => setChosen(chosen.filter((_, p) => p !== pos))}>
              {event.letters[i]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5" data-testid="rumor-letters">
          {event.letters.map((l, i) => (
            <button
              key={i}
              type="button"
              disabled={chosen.includes(i)}
              className={`press h-10 min-w-9 rounded-lg border-2 border-stone-300 bg-white px-2 text-lg ${chosen.includes(i) ? 'opacity-0' : ''}`}
              onClick={() => setChosen([...chosen, i])}
            >
              {l}
            </button>
          ))}
        </div>
        <Button disabled={chosen.length !== event.letters.length} onClick={() => onAnswer(chosen.map((i) => event.letters[i]).join(''))}>
          Отнять у кота
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      {event.kind === 'guest' ? (
        <>
          <p>Гость на площади о чём-то спрашивает. Что ему нужно?</p>
          {sound ? (
            <Button variant="secondary" onClick={() => speak(event.word.es)} data-testid="rumor-listen">
              🔊 Ещё раз
            </Button>
          ) : (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-lg" data-testid="rumor-heard">
              «{event.word.es}?»
            </p>
          )}
        </>
      ) : (
        <>
          <p>На двери почты висит объявление. Что в нём написано?</p>
          <p className="rounded-xl border-2 border-amber-300 bg-amber-50 px-3 py-2 text-lg" data-testid="rumor-notice">
            {event.text}
          </p>
        </>
      )}
      {event.options.map((o) => (
        <button key={o} type="button" className="press min-h-12 rounded-xl border-2 border-stone-300 bg-white px-3 py-2 text-left" onClick={() => onAnswer(o)} data-testid="rumor-option">
          {o}
        </button>
      ))}
    </div>
  );
}

function RumorReward({ coins, rumor }: { coins: number; rumor: Rumor | null }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-okbg p-3" data-testid="rumor-reward">
      <div className="font-bold">Верно! +{coins} 🪙</div>
      {rumor ? (
        <>
          <p className="text-sm text-stone-600">В благодарность вам рассказали слух:</p>
          <RumorLine rumor={rumor} open />
        </>
      ) : (
        <p className="text-sm text-stone-600">Новых слухов пока нет: все, что ходят по городу, вы уже знаете. Откройте следующую главу.</p>
      )}
    </div>
  );
}

/** Слух: кто сказал, реплика голосом жителя, перевод по нажатию. */
function RumorLine({ rumor, open = false }: { rumor: Rumor; open?: boolean }) {
  const [ru, setRu] = useState(open);
  const who = speakerOf(rumor.who);
  useEffect(() => {
    if (open && who) speakAs(rumor.es, who);
  }, [open, who, rumor]);
  return (
    <div className="flex gap-2 rounded-2xl bg-white p-3 shadow-sm" data-testid="rumor-line" data-id={rumor.id}>
      {who && <NpcPortrait look={who.look} size={44} />}
      <div className="min-w-0 flex-1">
        <div className="text-xs text-stone-500">{who?.name}</div>
        <button type="button" className="text-left text-lg leading-snug" onClick={() => setRu(!ru)} data-testid="rumor-text">
          {rumor.es}
        </button>
        {ru && <p className="text-sm text-stone-600">{rumor.ru}</p>}
        {rumor.gloss && ru && (
          <p className="mt-1 text-xs text-stone-500">
            {Object.entries(rumor.gloss)
              .map(([k, v]) => `${k} — ${v}`)
              .join(', ')}
          </p>
        )}
      </div>
      {who && (
        <button type="button" aria-label="Озвучить" className="press h-9 w-9 shrink-0 rounded-full bg-orange-100" onClick={() => speakAs(rumor.es, who)}>
          🔊
        </button>
      )}
    </div>
  );
}
