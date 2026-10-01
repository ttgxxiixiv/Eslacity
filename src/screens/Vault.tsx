import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import navEsGold from '../assets/nav/nav-es-gold.webp';
import navItGold from '../assets/nav/nav-it-gold.webp';
import { speakAs } from '../audio/tts';
import { CHRONICLER } from '../content/npcs';
import type { SphinxFile, VaultLine } from '../content/schema';
import { loadSphinx } from '../content/sphinx';
import { EXPRESSION_IDS, PHRASE_IDS } from '../content/wordIndex';
import { db } from '../db/db';
import { KEEPER_TITLE, SAGE_TITLE } from '../domain/chapters';
import { isVaultOpen, journeySummary } from '../domain/elixir';
import { KEEPER_DAYS, KEEPER_THRESHOLD, keeperStreak } from '../domain/keeper';
import { plural } from '../domain/medals';
import { LANG, LANGS, switchLang, type Lang } from '../lang';
import { useNow } from '../lib/useNow';
import { NpcPortrait } from '../components/NpcPortrait';
import { addressed } from '../store/settings';
import { SphinxArt } from '../components/SphinxArt';
import { Button, Screen, TopBar } from '../components/ui';
import { useHeroTitle, useJourney } from '../store/journey';
import { useElixirStrength, useKeeper } from '../store/keeper';
import { useMissions } from '../store/missions';
import { syncAndEvaluate, useMotivation } from '../store/motivation';
import { useProgress } from '../store/progress';
import { useSphinx } from '../store/sphinx';

const GOLD_NAV = LANG === 'it' ? navItGold : navEsGold;

type Phase = 'before' | 'drink' | 'after' | 'summary';

/**
 * Хранилище (задача 8.3): открывается, когда разгаданы три загадки Сфинкса. Сцена со Сфинксом и Летописцем,
 * герой пьёт Эликсир, медальон меню становится золотым, титул — «Мудрец», тайная медаль «Хранитель пути».
 * Потом — итоги пути. Если Эликсир уже выпит, экран сразу показывает итоги.
 */
export function VaultScreen() {
  const nav = useNavigate();
  const rec = useSphinx((s) => s.rec);
  const [file, setFile] = useState<SphinxFile | null>(null);
  const [phase, setPhase] = useState<Phase>(() => (useSphinx.getState().rec.elixir !== undefined ? 'summary' : 'before'));
  const [index, setIndex] = useState(0);

  useEffect(() => {
    loadSphinx().then((f) => setFile(f ?? null));
  }, []);

  if (!isVaultOpen(rec)) {
    return (
      <Screen>
        <TopBar title="Хранилище" />
        <div className="flex flex-col gap-3 px-5 py-6">
          <p className="text-stone-600" data-testid="vault-closed">
            Хранилище закрыто: сначала нужно разгадать три загадки Сфинкса у Врат.
          </p>
          <Button variant="secondary" onClick={() => nav('/journey-map')}>
            На карту странствий
          </Button>
        </div>
      </Screen>
    );
  }
  if (!file) return null;
  const sp = file.sphinx;
  const lines = phase === 'after' ? sp.vault.after : sp.vault.before;

  if (phase === 'summary') {
    return (
      <Summary
        onReplay={() => {
          setIndex(0);
          setPhase('before');
        }}
      />
    );
  }

  if (phase === 'drink') {
    return (
      <Screen>
        <TopBar title="Хранилище" />
        <div className="flex flex-1 flex-col items-center gap-4 px-5 pb-6" data-testid="vault-drink">
          <p className="pt-4 text-center text-stone-600">Посреди пустого зала стоит чаша. Свет в ней не гаснет уже сто лет.</p>
          <Cup />
          <div className="flex-1" />
          <Button
            className="w-full"
            data-testid="drink"
            onClick={() => {
              if (rec.elixir === undefined) {
                useSphinx.getState().drink();
                // Титул «Мудрец» и тайная медаль «Хранитель пути» — сразу.
                syncAndEvaluate(Date.now(), {});
              }
              setIndex(0);
              setPhase('after');
            }}
          >
            Выпить Эликсир
          </Button>
        </div>
      </Screen>
    );
  }

  const line = lines[index];
  const last = index + 1 >= lines.length;
  return (
    <Screen>
      <TopBar title="Хранилище" />
      <div className="flex flex-1 flex-col gap-4 px-5 pb-6" data-testid="vault-scene">
        {phase === 'after' && (
          <div className="flex flex-col items-center gap-2 pt-2" data-testid="vault-medallion">
            <Medallion />
            <div className="font-pixel text-sm tracking-widest text-amber-700 uppercase">Новый титул</div>
            <div className="text-2xl font-bold" data-testid="vault-title">
              {SAGE_TITLE}
            </div>
          </div>
        )}
        <Speech key={`${phase}.${index}`} line={line} sphinx={sp} />
        <div className="text-sm text-stone-500 tabular-nums">
          {index + 1} / {lines.length}
        </div>
        <div className="flex-1" />
        <Button
          className="w-full"
          data-testid="vault-next"
          onClick={() => {
            if (!last) setIndex(index + 1);
            else setPhase(phase === 'before' ? 'drink' : 'summary');
          }}
        >
          {!last ? 'Дальше' : phase === 'before' ? 'Подойти к чаше' : 'Итоги пути'}
        </Button>
      </div>
    </Screen>
  );
}

/** Реплика сцены: говорящий, текст на изучаемом языке, перевод по нажатию. Звучит сразу. */
function Speech({ line, sphinx }: { line: VaultLine; sphinx: SphinxFile['sphinx'] }) {
  const [ru, setRu] = useState(false);
  const say = () => speakAs(addressed(line.es), line.who === 'sphinx' ? sphinx : CHRONICLER);
  // Реплика звучит сразу, как появилась.
  useEffect(() => say(), []);
  return (
    <div className="flex flex-col items-center gap-2">
      {line.who === 'sphinx' ? <SphinxArt size={170} watching /> : <NpcPortrait look={CHRONICLER.look} size={110} />}
      <div className="font-semibold capitalize">{line.who === 'sphinx' ? sphinx.name : CHRONICLER.name}</div>
      <div className="flex w-full items-start gap-2 rounded-xl bg-orange-50 px-3 py-2">
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setRu(!ru)} data-testid="vault-line">
          <span className={`block font-semibold ${line.who === 'sphinx' ? 'italic' : ''}`}>{addressed(line.es)}</span>
          {ru ? (
            <span className="block text-sm text-stone-600" data-testid="vault-line-ru">
              {addressed(line.ru, 'ru')}
            </span>
          ) : (
            <span className="block text-xs text-stone-400">Нажмите, чтобы увидеть перевод</span>
          )}
        </button>
        <button
          type="button"
          aria-label="Озвучить"
          onClick={say}
          className="press inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100 text-lg text-brand shadow-sm"
        >
          🔊
        </button>
      </div>
    </div>
  );
}

/** Медальон меню крупно: вырезка из золотой картинки меню (круг радиусом 56 с центром 383, 63 на картинке 768×288). */
function Medallion({ size = 150 }: { size?: number }) {
  const r = 56;
  const k = size / (2 * r);
  return (
    <div
      role="img"
      aria-label="Золотой медальон"
      className="vault-glow rounded-full"
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${GOLD_NAV})`,
        backgroundSize: `${768 * k}px ${288 * k}px`,
        backgroundPosition: `${-(383 - r) * k}px ${-(63 - r) * k}px`,
        backgroundRepeat: 'no-repeat',
        imageRendering: 'pixelated',
      }}
    />
  );
}

/** Чаша с Эликсиром: пиксели кодом, над ней искры. */
function Cup() {
  const R: [number, number, number, number, string][] = [
    [5, 0, 1, 1, '#fff6c9'],
    [9, 0, 1, 1, '#fff6c9'],
    [14, 1, 1, 1, '#fff6c9'],
    [2, 2, 16, 1, '#8a6a3a'],
    [3, 3, 14, 2, '#f6d77a'],
    [3, 5, 14, 4, '#c9962e'],
    [4, 9, 12, 2, '#c9962e'],
    [6, 11, 8, 1, '#8a6a3a'],
    [5, 5, 2, 3, '#fff0a8'],
    [9, 12, 2, 3, '#8a6a3a'],
    [6, 15, 8, 1, '#b8862a'],
    [5, 16, 10, 1, '#8a6a3a'],
  ];
  return (
    <svg viewBox="0 0 20 18" width={160} height={144} shapeRendering="crispEdges" role="img" aria-label="Эликсир" className="vault-glow">
      {R.map(([x, y, w, h, fill], i) => (
        <rect key={i} x={x} y={y} width={w} height={h} fill={fill} />
      ))}
    </svg>
  );
}

/**
 * Сила Эликсира (задача 8.4): средняя вероятность вспоминания всех карточек. Поручения и повторение её держат,
 * тридцать дней подряд выше 90% — титул «Хранитель языка», он не отнимается.
 */
function Strength() {
  const nav = useNavigate();
  const now = useNow();
  const strength = useElixirStrength(now);
  const keeper = useKeeper((s) => s.rec);
  const streak = keeperStreak(keeper.days, now);
  const pct = Math.round(strength * 100);
  const high = strength >= KEEPER_THRESHOLD;
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm" data-testid="elixir-strength">
      <div className="flex items-baseline justify-between">
        <div className="font-pixel text-xs tracking-widest text-amber-700 uppercase">Сила Эликсира</div>
        <div className={`text-2xl font-bold tabular-nums ${high ? 'text-ok' : 'text-amber-700'}`} data-testid="elixir-pct">
          {pct}%
        </div>
      </div>
      <div className="relative mt-2 h-4 overflow-hidden rounded bg-wood p-[2px]" role="img" aria-label={`Сила Эликсира ${pct}%`}>
        <div className="h-full rounded-sm bg-gold" style={{ width: `${pct}%` }} />
        {/* Отметка 90%: выше неё идёт счёт дней Хранителя. */}
        <div className="absolute inset-y-0 w-[2px] bg-stone-50" style={{ left: `${KEEPER_THRESHOLD * 100}%` }} />
      </div>
      <p className="mt-2 text-sm text-stone-600">Это доля выученного, которую вы сейчас помните. Без повторения она тает.</p>
      {keeper.title !== undefined ? (
        <p className="mt-2 rounded-xl bg-okbg px-3 py-2 font-semibold text-ok" data-testid="keeper-title">
          Титул «{KEEPER_TITLE}» получен {new Date(keeper.title).toLocaleDateString('ru-RU')}. Его не отнять.
        </p>
      ) : (
        <p className="mt-2 text-sm text-stone-700" data-testid="keeper-streak">
          Дней подряд выше {Math.round(KEEPER_THRESHOLD * 100)}%: <span className="font-bold tabular-nums">{streak}</span> из {KEEPER_DAYS}. Тридцать дней — титул «
          {KEEPER_TITLE}».
        </p>
      )}
      <Button variant="secondary" className="mt-3 w-full" onClick={() => nav('/errands')} data-testid="keeper-errands">
        Поручения жителей
      </Button>
    </section>
  );
}

/** Предложение начать другой язык: его путь начинается заново, «Мудрец» этого языка будет виден в профиле. */
function SecondLanguage() {
  const others = (Object.keys(LANGS) as Lang[]).filter((l) => l !== LANG);
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm" data-testid="second-lang">
      <div className="font-bold">Второй язык</div>
      <p className="mt-1 text-sm text-stone-600">
        В другом городе свои жители, свои загадки и свой Сфинкс. Прогресс этого языка сохранится, а титул «{SAGE_TITLE}» будет виден в профиле.
      </p>
      {others.map((l) => (
        <Button key={l} className="mt-3 w-full" onClick={() => switchLang(l)} data-testid={`start-${l}`}>
          {LANGS[l].flag} {LANGS[l].name}
        </Button>
      ))}
    </section>
  );
}

/** Итоги пути: дни, слова и выражения, медали, миссии, пять печатей. */
function Summary({ onReplay }: { onReplay(): void }) {
  const nav = useNavigate();
  const cards = useProgress((s) => s.cards);
  const medals = useMotivation((s) => s.medals);
  const missions = useMissions((s) => s.records);
  const seals = useJourney((s) => s.seals);
  const elixir = useSphinx((s) => s.rec.elixir);
  const title = useHeroTitle();
  const [activeDays, setActiveDays] = useState<number | null>(null);
  useEffect(() => {
    db.days.count().then(setActiveDays);
  }, []);
  if (activeDays === null) return null;
  const s = journeySummary({
    cards,
    isPhrase: (id) => PHRASE_IDS.has(id),
    isExpression: (id) => EXPRESSION_IDS.has(id),
    activeDays,
    medals,
    missions,
    seals,
    end: elixir ?? Date.now(),
  });
  const rows: [string, string][] = [
    ['Дней в пути', `${s.days}`],
    ['Дней с занятиями', `${s.activeDays}`],
    ['Слов', `${s.words}`],
    ['Устойчивых выражений', `${s.expressions}`],
    ['Медалей', `${s.medals}`],
    ['Сюжетных миссий', `${s.missions}`],
  ];
  return (
    <Screen>
      <TopBar title="Итоги пути" />
      <div className="flex flex-1 flex-col gap-3 px-5 pb-6" data-testid="vault-summary">
        <Strength />
        <div className="flex flex-col items-center gap-1 rounded-2xl bg-white p-4 text-center shadow-sm">
          <Medallion size={110} />
          <div className="font-pixel text-xs tracking-widest text-amber-700 uppercase">Титул</div>
          <div className="text-xl font-bold" data-testid="vault-hero-title">
            {title}
          </div>
          <p className="text-sm text-stone-600">
            Путь к Хранилищу пройден за {s.days} {plural(s.days, ['день', 'дня', 'дней'])}.
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-2">
          {rows.map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-white px-3 py-2 shadow-sm">
              <dt className="text-xs text-stone-500">{k}</dt>
              <dd className="text-xl font-bold tabular-nums" data-testid={`summary-${k}`}>
                {v}
              </dd>
            </div>
          ))}
        </dl>
        <div className="rounded-2xl bg-white p-3 shadow-sm">
          <div className="text-xs text-stone-500">Печати земель</div>
          <ul className="mt-2 flex justify-between" data-testid="summary-seals">
            {s.seals.map((x) => (
              <li
                key={x.chapter}
                className={`flex h-12 w-12 items-center justify-center rounded-full border-2 font-bold ${x.at ? 'border-[#7a1a14] bg-[#b3261e] text-[#f4cfc0]' : 'border-dashed border-stone-300 text-stone-300'}`}
                title={x.at ? new Date(x.at).toLocaleDateString('ru-RU') : undefined}
              >
                {x.roman}
              </li>
            ))}
          </ul>
        </div>
        <SecondLanguage />
        <div className="flex-1" />
        <Button variant="secondary" className="w-full" onClick={onReplay} data-testid="vault-replay">
          Пересмотреть сцену
        </Button>
        <Button className="w-full" onClick={() => nav('/')}>
          В город
        </Button>
      </div>
    </Screen>
  );
}
