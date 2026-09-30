import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import land1Open from '../assets/journey/land1-open.webp';
import land1Closed from '../assets/journey/land1-closed.webp';
import { LOCATIONS } from '../content/locations';
import { fragmentKey, type ChapterId, type ChapterState, type PlaceState } from '../domain/chapters';
import { plural } from '../domain/medals';
import { Button, Screen, TopBar } from '../components/ui';
import { ChroniclerPanel } from '../components/ChroniclerPanel';
import { NpcPortrait } from '../components/NpcPortrait';
import { guardianOf } from '../content/npcs';
import { guardianId } from '../domain/guardian';
import { trialStatus, waitLabel } from '../domain/trial';
import { useNow } from '../lib/useNow';
import { cellCenter, cellOf, cellPolygon, MAP_H, MAP_W, SEAL } from '../components/journeyArt';
import { useCity } from '../store/city';
import { currentJourney, useJourney } from '../store/journey';
import { useProgress } from '../store/progress';
import { useMissions } from '../store/missions';
import { useTrials } from '../store/trials';
import { useSphinx } from '../store/sphinx';
import { SphinxArt } from '../components/SphinxArt';
import { GATES_CHAPTER, SPHINX_HEARTS, SPHINX_ROUNDS, sphinxStatus, sphinxWaitLabel } from '../domain/sphinx';

const INK = '#5c452d';
const PARCHMENT = '#f1dfb0';
const DARK = '#2e2216';

/**
 * Нарисованные карты земель: закрытая лежит подложкой, открытая проступает в полученных обрывках.
 * Места на рисунке стоят в той же сетке 5×4, что и обрывки. Для земель без рисунка карта рисуется кодом.
 */
export const LAND_IMAGES: Partial<Record<ChapterId, { open: string; closed: string; seal: { x: number; y: number; r: number } }>> = {
  1: { open: land1Open, closed: land1Closed, seal: { x: 164, y: 122, r: 28 } },
};
/** Точки у левого верхнего угла каждого обрывка: украшения рисунка не лезут на значки мест. */
const CORNERS: [number, number][] = Array.from({ length: 20 }, (_, i) => [(i % 5) * 64 + 13, Math.floor(i / 5) * 64 + 16]);

/** Рисунок земли под обрывками: у каждой главы свой пейзаж. Виден только в полученных обрывках. */
export function LandArt({ chapter }: { chapter: ChapterId }): ReactNode {
  const road = 'M -10 200 C 60 170, 90 230, 150 190 S 250 120, 330 60';
  const common = (
    <>
      <rect width={MAP_W} height={MAP_H} fill={PARCHMENT} />
      <path d={road} fill="none" stroke={INK} strokeWidth="3" strokeDasharray="7 6" strokeLinecap="round" />
    </>
  );
  const trees = (pts: [number, number][], color: string) =>
    pts.map(([x, y], i) => (
      <g key={i}>
        <rect x={x - 1.5} y={y + 6} width="3" height="6" fill={INK} />
        <polygon points={`${x},${y - 10} ${x - 8},${y + 7} ${x + 8},${y + 7}`} fill={color} stroke={INK} strokeWidth="1" />
      </g>
    ));
  switch (chapter) {
    case 1:
      return (
        <>
          {common}
          <path d="M 0 90 C 60 70, 120 110, 190 80 S 290 40, 320 70" fill="none" stroke="#6f9fc2" strokeWidth="6" opacity="0.8" />
          {trees(CORNERS, '#6f9b45')}
        </>
      );
    case 2:
      return (
        <>
          {common}
          {CORNERS.map(([x, y], i) => (
            <g key={i}>
              <polygon points={`${x},${y - 12} ${x - 12},${y + 8} ${x + 12},${y + 8}`} fill="#a79a88" stroke={INK} strokeWidth="1" />
              <polygon points={`${x},${y - 12} ${x - 4},${y - 6} ${x + 4},${y - 6}`} fill="#fbf4de" />
            </g>
          ))}
        </>
      );
    case 3:
      return (
        <>
          <rect width={MAP_W} height={MAP_H} fill="#ecd08e" />
          {[40, 100, 160, 220].map((y, i) => (
            <path key={i} d={`M 0 ${y} Q 80 ${y - 25}, 160 ${y} T 320 ${y}`} fill="none" stroke="#c9a15a" strokeWidth="3" />
          ))}
          <path d="M -10 200 C 60 170, 90 230, 150 190 S 250 120, 330 60" fill="none" stroke={INK} strokeWidth="3" strokeDasharray="7 6" />
          <ellipse cx="250" cy="200" rx="26" ry="10" fill="#6fb3c9" opacity="0.8" />
          <rect x="246" y="170" width="3" height="22" fill={INK} />
          <path d="M 247 172 q -12 -6 -18 4 M 247 172 q 12 -6 18 4" stroke="#5d8b3a" strokeWidth="4" fill="none" />
        </>
      );
    case 4:
      return (
        <>
          <rect width={MAP_W} height={MAP_H} fill="#d9d6a4" />
          <path d={road} fill="none" stroke={INK} strokeWidth="3" strokeDasharray="7 6" />
          {trees(CORNERS, '#3f6b35')}
          {trees(CORNERS.map(([x, y]) => [x + 40, y + 34] as [number, number]), '#4d7d3e')}
        </>
      );
    default:
      return (
        <>
          <rect width={MAP_W} height={MAP_H} fill="#e4d2b8" />
          {[0, 1, 2, 3, 4, 5].map((k) => (
            <rect key={k} x={20 + k * 24} y={20 + k * 16} width={280 - k * 48} height={216 - k * 32} fill="none" stroke={INK} strokeWidth="3" />
          ))}
          <path d={road} fill="none" stroke="#8a3a2a" strokeWidth="3" strokeDasharray="7 6" />
        </>
      );
  }
}

/**
 * Дорога через пять земель к Хранилищу, герой на текущей главе. Без onPick земли не нажимаются (сцена перехода),
 * смена `current` двигает героя по дороге плавно.
 */
export function Road({ state, current, shown, opened, onPick }: {
  state: ChapterState[];
  opened: number;
  current: ChapterId;
  shown: ChapterId;
  onPick?(id: ChapterId): void;
}) {
  const xs = [36, 99, 162, 225, 288];
  const ys = [70, 40, 72, 42, 70];
  const path = `M 10 80 ${xs.map((x, i) => `L ${x} ${ys[i]}`).join(' ')} L 345 55`;
  return (
    <svg viewBox="0 0 360 110" className="w-full" role="group" aria-label="Путь к Хранилищу">
      <rect width="360" height="110" rx="10" fill={PARCHMENT} stroke={INK} strokeWidth="2" />
      <path d={path} fill="none" stroke={INK} strokeWidth="2.5" strokeDasharray="5 5" />
      {state.map((c, i) => {
        const id = c.chapter.id;
        const done = c.complete;
        const open = id <= opened;
        return (
          <g
            key={id}
            role={onPick ? 'button' : undefined}
            tabIndex={onPick ? 0 : undefined}
            aria-label={`Глава ${c.chapter.roman}: ${c.chapter.land}${done ? ', карта собрана' : ''}`}
            aria-pressed={onPick ? shown === id : undefined}
            onClick={() => onPick?.(id)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onPick?.(id)}
            className={onPick ? 'cursor-pointer outline-none' : undefined}
          >
            <circle cx={xs[i]} cy={ys[i]} r={shown === id ? 17 : 15} fill={done ? '#e0b43c' : open ? '#fbf4de' : '#8f7a5c'} stroke={DARK} strokeWidth={shown === id ? 3 : 2} />
            <text x={xs[i]} y={ys[i] + 5} textAnchor="middle" fontSize="13" fontWeight="bold" fill={DARK}>
              {c.chapter.roman}
            </text>
            <text x={i === 0 ? 6 : xs[i]} y={ys[i] + (i % 2 ? -22 : 30)} textAnchor={i === 0 ? 'start' : 'middle'} fontSize="8.5" fill={INK}>
              {c.chapter.land}
            </text>
          </g>
        );
      })}
      {/* Хранилище в конце дороги. */}
      <g aria-label="Хранилище Эликсира">
        <rect x="333" y="36" width="22" height="26" rx="3" fill="#6b5a45" stroke={DARK} strokeWidth="2" />
        <path d="M 338 62 v -12 a 6 6 0 0 1 12 0 v 12" fill={DARK} />
      </g>
      {/* Герой: фигурка в плаще над текущей главой. */}
      <g
        className="hero-walk"
        style={{ transform: `translate(${xs[current - 1] + 13}px, ${ys[current - 1] - 20}px)` }}
        aria-label="Герой здесь"
        data-testid="hero"
      >
        <rect x="2" y="0" width="6" height="4" fill="#5a4128" />
        <rect x="1" y="4" width="8" height="10" fill="#5a4128" />
        <rect x="3" y="2" width="4" height="3" fill="#f1c9a0" />
        <rect x="0" y="14" width="3" height="2" fill={DARK} />
        <rect x="7" y="14" width="3" height="2" fill={DARK} />
        {/* Летописец идёт следом: лиловый балахон, седая борода, под мышкой свиток. */}
        <g transform="translate(12 2)" aria-label="Летописец" data-testid="road-chronicler">
          <rect x="2" y="0" width="6" height="2" fill="#d9d4c5" />
          <rect x="2" y="2" width="6" height="3" fill="#e0ad84" />
          <rect x="2" y="4" width="6" height="3" fill="#d9d4c5" />
          <rect x="1" y="6" width="8" height="8" fill="#6b4f8a" />
          <rect x="7" y="8" width="4" height="3" fill="#f1dfb0" />
          <rect x="1" y="14" width="3" height="2" fill={DARK} />
          <rect x="6" y="14" width="3" height="2" fill={DARK} />
        </g>
      </g>
    </svg>
  );
}

function missingText(p: PlaceState, level: number): string {
  if (p.got) return 'Обрывок получен';
  if (p.words === 0) return 'Слова этой главы ещё пишутся';
  if (p.ready) return 'Обрывок готов: он появится после ближайшего урока';
  const parts: string[] = [];
  if (!level) parts.push('место ещё не открыто');
  if (p.wordsLeft) parts.push(`осталось выучить ${p.wordsLeft} ${plural(p.wordsLeft, ['слово', 'слова', 'слов'])} главы`);
  // Миссия и испытание идут после слов: пока слова не выучены — «потом», иначе — что осталось пройти.
  const rest = [p.missing.includes('mission') ? 'сюжетная миссия жителя' : '', p.missing.includes('trial') ? 'испытание места' : ''].filter(Boolean).join(' и ');
  if (rest) parts.push(p.wordsLeft ? `потом ${rest}` : `осталось пройти: ${rest}`);
  return parts.join(', ');
}

export function JourneyMapScreen() {
  // Подписки, от которых зависит состояние пути.
  const fragments = useJourney((s) => s.fragments);
  const seals = useJourney((s) => s.seals);
  const opened = useJourney((s) => s.opened);
  const cards = useProgress((s) => s.cards);
  const grammar = useProgress((s) => s.grammar);
  const buildings = useCity((s) => s.buildings);
  const missions = useMissions((s) => s.records);
  const trials = useTrials((s) => s.records);
  const journey = useMemo(() => currentJourney(), [fragments, seals, opened, cards, grammar, missions, trials]);
  const [shown, setShown] = useState<ChapterId>(journey.current);
  const [picked, setPicked] = useState<number | 'seal' | null>(null);
  const ch = journey.chapters[shown - 1];
  const got = ch.places.filter((p) => p.got).length;
  const art = LAND_IMAGES[shown];
  const seal = art?.seal ?? SEAL;
  const guardian = guardianOf(shown);

  const pick = (id: ChapterId) => {
    setShown(id);
    setPicked(null);
  };

  return (
    <Screen>
      <TopBar title="Карта странствий" />
      <div className="flex flex-col gap-3 px-4 pb-6">
        <Road state={journey.chapters} current={journey.current} shown={shown} opened={opened} onPick={pick} />

        <section className="rounded-2xl bg-white p-3 shadow-sm">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-bold">
              Глава {ch.chapter.roman}. {ch.chapter.land}
            </h2>
            <span className="text-sm text-stone-500 tabular-nums" data-testid="fragments-count">
              {got} / {ch.places.length}
            </span>
          </div>
          <p className="text-xs text-stone-500">
            Уровень {ch.chapter.cefr}. {shown > opened ? 'Глава ещё закрыта.' : 'Каждое место отдаёт обрывок, когда выучены его слова этой главы.'}
          </p>

          <svg viewBox={`-4 -4 ${MAP_W + 8} ${MAP_H + 8}`} className="mt-2 w-full" data-testid="land-map">
            <defs>
              <clipPath id="got-cells">
                {ch.places.map((p, i) => {
                  if (!p.got) return null;
                  const { col, row } = cellOf(i);
                  return <polygon key={i} points={cellPolygon(col, row)} />;
                })}
              </clipPath>
            </defs>
            <rect x="-4" y="-4" width={MAP_W + 8} height={MAP_H + 8} rx="6" fill={DARK} />
            {art && <image href={art.closed} width={MAP_W} height={MAP_H} preserveAspectRatio="none" />}
            <g clipPath="url(#got-cells)">
              {art ? <image href={art.open} width={MAP_W} height={MAP_H} preserveAspectRatio="none" /> : <LandArt chapter={shown} />}
            </g>
            {ch.places.map((p, i) => {
              const { col, row } = cellOf(i);
              const [cx, cy0] = cellCenter(col, row);
              // Значки двух мест у печати сдвинуты, чтобы печать их не закрывала.
              const cy = cy0 + (i === 7 ? -14 : i === 12 ? 14 : 0);
              const meta = LOCATIONS.find((l) => l.id === p.location)!;
              const sel = picked === i;
              return (
                <g
                  key={p.location}
                  role="button"
                  tabIndex={0}
                  aria-label={`${meta.ru}: ${p.got ? 'обрывок получен' : 'обрывка нет'}`}
                  data-got={p.got ? '1' : '0'}
                  onClick={() => setPicked(i)}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setPicked(i)}
                  className="cursor-pointer outline-none"
                >
                  {art ? (
                    // На рисунке места уже нарисованы: только контур обрывка.
                    <polygon
                      points={cellPolygon(col, row)}
                      fill="transparent"
                      stroke={sel ? '#e0b43c' : p.got ? 'none' : '#d9c49a'}
                      strokeOpacity={sel ? 1 : 0.45}
                      strokeWidth={sel ? 3 : 1}
                      strokeDasharray={sel ? undefined : '4 3'}
                    />
                  ) : (
                    <>
                      <polygon
                        points={cellPolygon(col, row)}
                        fill={p.got ? 'transparent' : '#3d2e1f'}
                        stroke={sel ? '#e0b43c' : p.got ? INK : '#7a6448'}
                        strokeWidth={sel ? 3 : 1.2}
                        strokeDasharray={p.got ? undefined : '4 3'}
                      />
                      <text x={cx} y={cy + 7} textAnchor="middle" fontSize="20" opacity={p.got ? 0.95 : 0.45}>
                        {meta.emoji}
                      </text>
                    </>
                  )}
                </g>
              );
            })}
            {guardian && shown <= opened && !ch.seal.got && (
              // Страж стоит у печати, которую охраняет.
              <g transform={`translate(${seal.x + seal.r - 6} ${seal.y - 30})`} data-testid="guardian-sprite" onClick={() => setPicked('seal')} className="cursor-pointer">
                <NpcPortrait look={guardian.look} size={40} label={`Страж: ${guardian.name}`} pixel />
              </g>
            )}
            <g
              role="button"
              tabIndex={0}
              aria-label={`Печать главы: ${ch.seal.got ? 'получена' : 'нет'}`}
              onClick={() => setPicked('seal')}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setPicked('seal')}
              className="cursor-pointer outline-none"
            >
              {art && !ch.seal.got ? (
                // Замок уже нарисован на карте: поверх только область нажатия.
                <circle cx={seal.x} cy={seal.y} r={seal.r} fill="transparent" stroke={picked === 'seal' ? '#e0b43c' : 'none'} strokeWidth="3" />
              ) : (
                <>
                  <circle
                    cx={seal.x}
                    cy={seal.y}
                    r={seal.r}
                    fill={ch.seal.got ? '#b3261e' : '#2e2216'}
                    stroke={picked === 'seal' ? '#e0b43c' : ch.seal.got ? '#7a1a14' : '#7a6448'}
                    strokeWidth={picked === 'seal' ? 3 : 2}
                    strokeDasharray={ch.seal.got ? undefined : '4 3'}
                  />
                  <text x={seal.x} y={seal.y + 6} textAnchor="middle" fontSize="17" fontWeight="bold" fill={ch.seal.got ? '#f4cfc0' : '#7a6448'}>
                    {ch.seal.got ? ch.chapter.roman : '🔒'}
                  </text>
                </>
              )}
            </g>
          </svg>

          <Details ch={ch} picked={picked} fragmentsAt={fragments} buildings={buildings} opened={opened} />
        </section>

        {shown <= opened && <GuardianPanel ch={ch} />}

        <GatesPanel />

        <ChroniclerPanel opened={opened} />
      </div>
    </Screen>
  );
}

function Details({ ch, picked, fragmentsAt, buildings, opened }: {
  ch: ChapterState;
  picked: number | 'seal' | null;
  fragmentsAt: Record<string, number>;
  buildings: ReturnType<typeof useCity.getState>['buildings'];
  opened: number;
}) {
  const nav = useNavigate();
  if (picked === null) {
    return <p className="mt-2 text-sm text-stone-500">Нажмите на обрывок, чтобы узнать, чего не хватает.</p>;
  }
  if (picked === 'seal') {
    const s = ch.seal;
    return (
      <div className="mt-3 rounded-xl bg-stone-50 p-3" data-testid="map-details">
        <div className="font-semibold">Печать главы {ch.chapter.roman}</div>
        {s.got ? (
          <p className="text-sm text-stone-600">Печать получена.</p>
        ) : (
          <>
            <p className="text-sm text-stone-600">
              {s.lessons === 0
                ? 'Уроки этой главы ещё пишутся.'
                : s.guardian !== 'none'
                  ? `Печать хранит страж: ${guardianOf(ch.chapter.id)?.name ?? 'страж'}. Он проверяет грамматику района ${ch.chapter.districts.join(' и ')}, слова главы и свиток земли. Уроки района пройдены: ${s.lessons - s.lessonsLeft} из ${s.lessons}.`
                  : s.lessonsLeft
                    ? `Пройдите уроки грамматики района ${ch.chapter.districts.join(' и ')}: осталось ${s.lessonsLeft} из ${s.lessons}.`
                    : `Уроки района ${ch.chapter.districts.join(' и ')} пройдены.`}
            </p>
            {s.scroll > 0 && (
              <p className="mt-1 text-sm text-stone-600" data-testid="seal-scroll">
                {s.scrollLeft
                  ? `Свиток земли: осталось выучить ${s.scrollLeft} ${plural(s.scrollLeft, ['слово', 'слова', 'слов'])} из ${s.scroll}, их просит Летописец.`
                  : 'Свиток земли выучен.'}
              </p>
            )}
          </>
        )}
        {!s.got && s.guardian === 'todo' && ch.chapter.id <= opened && (
          <Button className="mt-2 w-full" onClick={() => nav(`/guardian/${ch.chapter.id}`)}>
            К стражу
          </Button>
        )}
        {!s.got && s.lessonsLeft > 0 && (
          <Button variant={s.guardian === 'todo' ? 'secondary' : undefined} className="mt-2 w-full" onClick={() => nav('/grammar')}>
            К грамматике
          </Button>
        )}
      </div>
    );
  }
  const p = ch.places[picked];
  const meta = LOCATIONS.find((l) => l.id === p.location)!;
  const level = buildings[meta.id]?.level ?? 0;
  const at = fragmentsAt[fragmentKey(ch.chapter.id, p.location)];
  return (
    <div className="mt-3 rounded-xl bg-stone-50 p-3" data-testid="map-details">
      <div className="font-semibold">
        {meta.emoji} {meta.ru}
      </div>
      <p className="text-sm text-stone-600">
        {missingText(p, level)}
        {at ? `, ${new Date(at).toLocaleDateString('ru-RU')}` : ''}.
      </p>
      {!p.got && p.words > 0 && (
        <Button className="mt-2 w-full" onClick={() => nav(`/loc/${meta.id}`)}>
          Перейти: {meta.ru}
        </Button>
      )}
    </div>
  );
}

/** Страж главы под картой: портрет, приветствие и дорога к испытанию. Пускает, когда свиток земли выучен. */
/** Врата Хранилища: появляются с печатью главы V (задача 8.2). */
function GatesPanel() {
  const nav = useNavigate();
  const now = useNow();
  const sealed = useJourney((s) => s.seals[String(GATES_CHAPTER)] !== undefined);
  const rec = useSphinx((s) => s.rec);
  if (!sealed) return null;
  const status = sphinxStatus(rec, now);
  const solved = SPHINX_ROUNDS.filter((k) => rec.rounds[k] !== undefined).length;
  return (
    <section className="rounded-2xl bg-white p-3 shadow-sm" data-testid="gates-panel">
      <div className="flex items-center gap-3">
        <SphinxArt size={96} watching={status === 'open'} />
        <div className="min-w-0 flex-1">
          <div className="font-bold">Врата Хранилища</div>
          <p className="text-sm text-stone-600" data-testid="gates-status">
            {status === 'done'
              ? 'Сфинкс пропустил героя: Врата открыты.'
              : status === 'waiting' && rec.waitUntil !== undefined
                ? `Сфинкс ждёт вас снова ${sphinxWaitLabel(rec.waitUntil, now)}.`
                : rec.visited === undefined
                  ? 'У Врат сидит Сфинкс. Он пропускает только того, кто разгадает три загадки.'
                  : `Разгадано загадок: ${solved} из ${SPHINX_ROUNDS.length}. Сердца: ${rec.hearts} из ${SPHINX_HEARTS}.`}
          </p>
        </div>
      </div>
      <Button className="mt-2 w-full" data-testid="gates-go" onClick={() => nav('/sphinx')}>
        {rec.visited === undefined ? 'Подойти к Вратам' : 'К Вратам'}
      </Button>
    </section>
  );
}

function GuardianPanel({ ch }: { ch: ChapterState }) {
  const nav = useNavigate();
  const now = useNow();
  const guardian = guardianOf(ch.chapter.id);
  const rec = useTrials((s) => s.records[guardianId(ch.chapter.id)]);
  if (!guardian || ch.seal.guardian === 'none') return null;
  const status = ch.seal.got && ch.seal.guardian !== 'done' ? null : trialStatus(rec, ch.seal.scrollLeft, now);
  return (
    <section className="rounded-2xl bg-white p-3 shadow-sm" data-testid="guardian-panel">
      <div className="flex items-end gap-3">
        <NpcPortrait look={guardian.look} size={72} />
        <div className="min-w-0 flex-1">
          <div className="font-bold">{guardian.name}</div>
          <div className="text-sm text-stone-500">{guardian.role}</div>
          <div className="mt-1 text-sm font-semibold">{guardian.greeting.es}</div>
          <div className="text-xs text-stone-500">{guardian.greeting.ru}</div>
        </div>
      </div>
      <p className="mt-2 text-sm text-stone-600" data-testid="guardian-status">
        {status === null || status.kind === 'done'
          ? 'Страж пропустил героя: печать главы получена.'
          : status.kind === 'locked'
            ? `Страж пустит, когда выучен свиток земли: осталось ${status.wordsLeft} ${plural(status.wordsLeft, ['слово', 'слова', 'слов'])}.`
            : status.kind === 'wait'
              ? `Страж ждёт вас снова ${waitLabel(status.until, now)}.`
              : 'Страж ждёт: 20 заданий по грамматике, словам главы и свитку, нужно 75%.'}
      </p>
      {status?.kind === 'open' && (
        <Button className="mt-2 w-full" data-testid="guardian-go" onClick={() => nav(`/guardian/${ch.chapter.id}`)}>
          Бросить вызов стражу
        </Button>
      )}
    </section>
  );
}
