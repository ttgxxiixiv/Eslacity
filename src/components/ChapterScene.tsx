import { useEffect, useMemo, useState } from 'react';
import { chapterById, completedChapters, sceneToShow, type ChapterId } from '../domain/chapters';
import { LandArt, LAND_IMAGES, Road } from '../screens/JourneyMap';
import { currentJourney, useJourney } from '../store/journey';
import { useProgress } from '../store/progress';
import { cellOf, cellPolygon, MAP_H, MAP_W } from './journeyArt';
import { Button } from './ui';

/** Куда разлетаются обрывки перед сборкой: одинаково при каждом показе. */
function scatter(i: number): string {
  const a = Math.sin(i * 91.7) * 1000;
  const b = Math.sin(i * 57.3 + 4) * 1000;
  const dx = ((a - Math.floor(a)) - 0.5) * 360;
  const dy = ((b - Math.floor(b)) - 0.5) * 300;
  const rot = ((a - Math.floor(a)) - 0.5) * 70;
  return `translate(${dx.toFixed(0)}px, ${dy.toFixed(0)}px) rotate(${rot.toFixed(0)}deg)`;
}

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

type Phase = 'scatter' | 'assemble' | 'walk' | 'title';

/**
 * Сцена перехода в новую главу: обрывки складываются в карту, герой проходит по дороге к следующей земле,
 * затем новый титул. Показывается один раз для каждой главы, отметка хранится в пути (`celebrated`).
 */
export function ChapterScene() {
  const fragments = useJourney((s) => s.fragments);
  const seals = useJourney((s) => s.seals);
  const celebrated = useJourney((s) => s.celebrated);
  const cards = useProgress((s) => s.cards);
  const grammar = useProgress((s) => s.grammar);
  const journey = useMemo(() => currentJourney(), [fragments, seals, cards, grammar]);
  const chapter = sceneToShow(completedChapters(journey), celebrated);
  if (!chapter) return null;
  return <Scene key={chapter} chapter={chapter} journey={journey} />;
}

function Scene({ chapter, journey }: { chapter: ChapterId; journey: ReturnType<typeof currentJourney> }) {
  const [phase, setPhase] = useState<Phase>(() => (reduced() ? 'title' : 'scatter'));
  const ch = chapterById(chapter)!;
  const next = chapterById(chapter + 1);
  const art = LAND_IMAGES[chapter];

  useEffect(() => {
    if (phase === 'title') return;
    const steps: [Phase, number][] = [['assemble', 60], ['walk', 2200], ['title', 3800]];
    const timers = steps.map(([p, ms]) => setTimeout(() => setPhase(p), ms));
    return () => timers.forEach(clearTimeout);
    // Таймеры ставятся один раз при появлении сцены.
  }, []);

  const walked = phase === 'walk' || phase === 'title';
  const hero = (walked && next ? next.id : chapter) as ChapterId;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-wood/95 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Карта главы ${ch.roman} собрана`}
      data-testid="chapter-scene"
      onClick={() => phase !== 'title' && setPhase('title')}
    >
      <div className="w-full max-w-md">
        <div className="text-center font-pixel text-sm tracking-widest text-gold uppercase">Глава {ch.roman}. {ch.land}</div>
        <svg viewBox={`-4 -4 ${MAP_W + 8} ${MAP_H + 8}`} className="mt-3 w-full overflow-visible" aria-hidden>
          <defs>
            {Array.from({ length: 20 }, (_, i) => {
              const { col, row } = cellOf(i);
              return (
                <clipPath key={i} id={`scene-cell-${i}`}>
                  <polygon points={cellPolygon(col, row)} />
                </clipPath>
              );
            })}
          </defs>
          {Array.from({ length: 20 }, (_, i) => {
            const { col, row } = cellOf(i);
            const home = phase !== 'scatter';
            return (
              <g
                key={i}
                className="scene-piece"
                style={{
                  transform: home ? 'none' : scatter(i),
                  opacity: home ? 1 : 0,
                  transitionDelay: `${i * 70}ms`,
                  transformBox: 'fill-box',
                  transformOrigin: 'center',
                }}
              >
                <g clipPath={`url(#scene-cell-${i})`}>
                  {art ? <image href={art.open} width={MAP_W} height={MAP_H} preserveAspectRatio="none" /> : <LandArt chapter={chapter} />}
                </g>
                <polygon points={cellPolygon(col, row)} fill="none" stroke="#5c452d" strokeWidth="0.8" strokeOpacity="0.5" />
              </g>
            );
          })}
        </svg>

        <div className="mt-4">
          <Road state={journey.chapters} current={hero} shown={hero} opened={Math.max(journey.current, next?.id ?? chapter)} />
        </div>

        {phase === 'title' && (
          <div className="scene-fade mt-4 rounded-2xl border-2 border-gold bg-stone-50 p-4 text-center" data-testid="scene-title">
            <div className="text-sm text-stone-500">Карта главы {ch.roman} собрана. Новый титул</div>
            <div className="mt-1 font-pixel text-3xl text-wood">{ch.title}</div>
            {next ? (
              <p className="mt-2 text-sm text-stone-600">
                Дорога ведёт дальше: открыта глава {next.roman}, {next.land}. Новые слова мест и район грамматики {next.districts.join(' и ')}.
              </p>
            ) : (
              <p className="mt-2 text-sm text-stone-600">Впереди Врата Хранилища.</p>
            )}
            <Button className="mt-3 w-full" onClick={() => useJourney.getState().celebrate(chapter)}>
              В путь
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
