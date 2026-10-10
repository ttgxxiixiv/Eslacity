import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { wordsByIds } from '../content';
import { lessonsOf, loadLesson } from '../content/grammar';
import { CHRONICLER } from '../content/npcs';
import type { District, Word } from '../content/schema';
import { WORD_LEVELS } from '../content/wordIndex';
import { CHAPTERS, chapterById, type Chapter } from '../domain/chapters';
import { seeded } from '../domain/generators';
import { isWordId } from '../domain/itemId';
import { plural } from '../domain/medals';
import { blockPassed, PLACEMENT_PASS, PLACEMENT_RULES, PLACEMENT_SEAL_MAX, PLACEMENT_WORDS, placementBlock } from '../domain/placement';
import type { TrialItem } from '../domain/trial';
import { NpcPortrait } from '../components/NpcPortrait';
import { TrialPlayer } from '../components/TrialPlayer';
import { Button, Screen, TopBar } from '../components/ui';
import { syncAndEvaluate } from '../store/motivation';
import { usePlacement } from '../store/placement';

const BLOCK = PLACEMENT_WORDS + PLACEMENT_RULES;

type Phase = 'intro' | 'loading' | 'run' | 'between' | 'result';

/** Слова и уроки главы для блока теста. */
async function chapterBlock(ch: Chapter): Promise<{ items: TrialItem[]; words: Record<string, Word> }> {
  const ids = Object.values(WORD_LEVELS).flatMap((levels) => ch.levels.flatMap((l) => levels[l] ?? []));
  const words = await wordsByIds(ids);
  const lessons = await Promise.all(ch.districts.flatMap((d) => lessonsOf(d as District).map((l) => loadLesson(l.id))));
  const items = placementBlock(words, lessons.map((l) => l?.exercises ?? []), seeded(Date.now()));
  return { items, words: Object.fromEntries(words.map((w) => [w.id, w])) };
}

/**
 * Входной тест (задача 9.1): Летописец расспрашивает путника, где тот уже побывал. Главы по порядку, в каждой
 * 10 заданий; засчитанная глава — следующая сложнее, незасчитанная заканчивает тест. Засчитанное выдаётся сразу
 * в конце: обрывки, печати до IV, уровень зданий и карточки названных слов.
 */
export function PlacementScreen() {
  const nav = useNavigate();
  const rec = usePlacement((s) => s.rec);
  const [phase, setPhase] = useState<Phase>('intro');
  const [chapter, setChapter] = useState(1);
  const [block, setBlock] = useState<{ items: TrialItem[]; words: Record<string, Word> } | null>(null);
  const [passed, setPassed] = useState(0);
  const [known, setKnown] = useState<string[]>([]);
  const [blockKnown] = useState<Set<string>>(() => new Set());
  const [last, setLast] = useState<{ good: number; total: number } | null>(null);
  const firstRun = rec.done === undefined && rec.skipped === undefined;

  const start = async (c: number) => {
    setChapter(c);
    setPhase('loading');
    blockKnown.clear();
    setBlock(await chapterBlock(chapterById(c)!));
    setPhase('run');
  };
  const finish = (n: number, ids: string[]) => {
    usePlacement.getState().finish(n, ids);
    syncAndEvaluate(Date.now(), {});
    setPhase('result');
  };

  if (phase === 'run' && block) {
    const ch = chapterById(chapter)!;
    return (
      <TrialPlayer
        key={chapter}
        items={block.items}
        words={block.words}
        label={`Глава ${ch.roman} · ${ch.land}`}
        mode="placement"
        onAnswer={(id, verdict) => {
          if (isWordId(id) && verdict !== 'wrong') blockKnown.add(id);
        }}
        onExit={() => finish(passed, known)}
        onFinish={(sc) => {
          const good = sc.correct + sc.almost;
          const total = sc.correct + sc.almost + sc.wrong;
          setLast({ good, total });
          if (!blockPassed(good, total)) {
            finish(passed, known);
            return;
          }
          const ids = [...known, ...blockKnown];
          setPassed(chapter);
          setKnown(ids);
          if (chapter >= CHAPTERS.length) finish(chapter, ids);
          else setPhase('between');
        }}
      />
    );
  }

  if (phase === 'between') {
    const ch = chapterById(chapter)!;
    const next = chapterById(chapter + 1)!;
    return (
      <Screen>
        <TopBar title="Расспросы Летописца" back={false} />
        <div className="flex flex-1 flex-col gap-3 px-5 pb-6" data-testid="placement-between">
          <div className="rounded-2xl bg-okbg px-4 py-3 text-ok">
            <div className="text-lg font-bold">✓ Глава {ch.roman} засчитана</div>
            <div className="text-sm tabular-nums">
              Верно: {last?.good} из {last?.total}
            </div>
          </div>
          <Chronicler text={`Значит, ${ch.land.toLowerCase()} вам знакомы. А дальше, в краю «${next.land}», вы бывали?`} />
          <div className="flex-1" />
          <Button className="w-full" onClick={() => start(chapter + 1)} data-testid="placement-next">
            Глава {next.roman}: {next.cefr}
          </Button>
          <Button variant="secondary" className="w-full" onClick={() => finish(passed, known)} data-testid="placement-stop">
            Хватит, начать путь
          </Button>
        </div>
      </Screen>
    );
  }

  if (phase === 'result') {
    const n = usePlacement.getState().rec.passed ?? 0;
    const startCh = chapterById(Math.min(passed + 1, CHAPTERS.length))!;
    return (
      <Screen>
        <TopBar title="Расспросы Летописца" back={false} />
        <div className="flex flex-1 flex-col gap-3 px-5 pb-6" data-testid="placement-result">
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="text-lg font-bold" data-testid="placement-passed">
              {passed ? `Засчитано глав: ${passed}` : 'Путь начинается с первой главы'}
            </div>
            {last && !blockPassed(last.good, last.total) && (
              <p className="text-sm text-stone-500 tabular-nums">
                Глава {chapterById(passed + 1)?.roman}: верно {last.good} из {last.total}, нужно {Math.round(PLACEMENT_PASS * 100)}%.
              </p>
            )}
            <ul className="mt-3 flex flex-col gap-1">
              {CHAPTERS.map((c) => (
                <li key={c.id} className={`flex items-center gap-2 ${c.id <= passed ? '' : 'text-stone-500'}`}>
                  <span className="w-5 text-center">{c.id <= passed ? '✓' : '·'}</span>
                  Глава {c.roman}. {c.land}
                </li>
              ))}
            </ul>
          </div>
          {passed > 0 && (
            <p className="text-sm leading-relaxed text-stone-600">
              Обрывки карт засчитанных глав ваши, печати — до главы {chapterById(Math.min(passed, PLACEMENT_SEAL_MAX))?.roman}.
              {passed >= CHAPTERS.length && ' Печать главы V охраняет Хозяин Эха: к Сфинксу ведёт только она.'} Здания выросли,
              {' '}{known.length} {plural(known.length, ['названное слово ушло', 'названных слова ушли', 'названных слов ушли'])} в повторение.
            </p>
          )}
          <Chronicler
            text={passed ? `Запишу: путь продолжается с главы ${startCh.roman}. ${startCh.land} ждёт.` : 'Ничего, все великие путники начинали с первой чашки кофе.'}
          />
          {n > passed && <p className="text-sm text-stone-500">Лучший результат раньше — {n} {plural(n, ['глава', 'главы', 'глав'])}, он сохранён.</p>}
          <div className="flex-1" />
          <Button className="w-full" onClick={() => nav('/', { replace: true })} data-testid="placement-home">
            В город
          </Button>
        </div>
      </Screen>
    );
  }

  return (
    <Screen>
      <TopBar title="Расспросы Летописца" />
      <div className="flex flex-1 flex-col gap-3 px-5 pb-6" data-testid="placement-intro">
        <Chronicler text="Путник, вы здесь впервые? Расскажите, где уже бывали: я проверю по своим записям." />
        <div className="rounded-2xl bg-white p-4 leading-relaxed text-stone-700 shadow-sm">
          <p>
            Это входной тест на 10–15 минут. Главы идут по порядку, от I к V: в каждой {BLOCK} заданий — {PLACEMENT_WORDS} слов и{' '}
            {PLACEMENT_RULES} правила. Ответили верно на {Math.round(PLACEMENT_PASS * 100)}% — глава засчитана и дальше вопросы сложнее.
            Нет — путь начнётся с этой главы.
          </p>
          <p className="mt-2 text-sm text-stone-500">
            За засчитанные главы — их обрывки карты и печати (кроме печати главы V: её охраняет Хозяин Эха), здания нужного уровня
            и названные слова в повторении. Остановиться можно после любой главы, ничего полученного не отнимается.
          </p>
        </div>
        <div className="flex-1" />
        <Button className="w-full" onClick={() => start(1)} disabled={phase === 'loading'} data-testid="placement-start">
          {phase === 'loading' ? 'Летописец листает записи…' : 'Начать'}
        </Button>
        {firstRun && (
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => {
              usePlacement.getState().skip();
              nav('/', { replace: true });
            }}
            data-testid="placement-skip"
          >
            Я здесь впервые, пропустить
          </Button>
        )}
      </div>
    </Screen>
  );
}

function Chronicler({ text }: { text: string }) {
  return (
    <div className="flex items-end gap-3">
      <NpcPortrait look={CHRONICLER.look} size={72} />
      <div className="min-w-0 flex-1 rounded-2xl rounded-bl-none border-2 border-stone-300 bg-white px-3 py-2">
        <div className="text-xs text-stone-500">{CHRONICLER.name}</div>
        <div>{text}</div>
      </div>
    </div>
  );
}
