import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { XP } from '../config';
import { listeningEnabled, speak } from '../audio/tts';
import { CHRONICLER, NPC_BY_ID } from '../content/npcs';
import type { Example, SphinxFile, SphinxLine } from '../content/schema';
import { loadSphinx } from '../content/sphinx';
import { seeded } from '../domain/generators';
import { sceneChunks, sceneWords } from '../domain/sceneText';
import {
  GATES_CHAPTER, nextRound, setIndex, SPHINX_HEARTS, SPHINX_PASS, SPHINX_ROUNDS, sphinxItems, sphinxStatus, sphinxWaitLabel,
  type RoundResult, type SphinxRound,
} from '../domain/sphinx';
import type { TrialItem } from '../domain/trial';
import { useNow } from '../lib/useNow';
import { NpcPortrait } from '../components/NpcPortrait';
import { SphinxArt } from '../components/SphinxArt';
import { TrialPlayer } from '../components/TrialPlayer';
import { Button, Screen, TopBar } from '../components/ui';
import { useJourney } from '../store/journey';
import { syncAndEvaluate } from '../store/motivation';
import { useProgress } from '../store/progress';
import { useSettings } from '../store/settings';
import { useSphinx } from '../store/sphinx';

const ROUND_TITLE: Record<SphinxRound, string> = { hear: 'Загадка слуха', word: 'Загадка слова', wisdom: 'Загадка мудрости' };
const ROUND_TEXT: Record<SphinxRound, string> = {
  hear: 'Монолог и спор двух жителей, потом 8 вопросов: что сказано, как говорящий к этому относится, что он имел в виду.',
  word: '10 заданий с вводом: пересказ с ключевым словом, пропуски в тексте, поиск ошибки, устойчивые выражения.',
  wisdom: 'Длинный текст и 5 вопросов к нему, потом одну мысль нужно сказать Сфинксу официально и по-дружески.',
};

/** Говорящий загадки слуха: житель или Летописец. */
const voiceOf = (who: string) => (who === CHRONICLER.id ? CHRONICLER : NPC_BY_ID[who]);

type Phase = 'gate' | 'intro' | 'listen' | 'read' | 'run' | 'result';

/**
 * Врата Хранилища (задача 8.2): Сфинкс загадывает три загадки — слух, слово, мудрость. Три сердца на всю встречу,
 * раунд засчитан при 80%, проваленный раунд стоит сердце и повторяется по другому набору. Сердца кончились —
 * Сфинкс ждёт три дня. Времени на ответ нет. Открывается печатью главы V.
 */
export function SphinxScreen() {
  const nav = useNavigate();
  const sealed = useJourney((s) => s.seals[String(GATES_CHAPTER)] !== undefined);
  const rec = useSphinx((s) => s.rec);
  const now = useNow();
  const [file, setFile] = useState<SphinxFile | null>(null);
  const [phase, setPhase] = useState<Phase>('gate');
  const [round, setRound] = useState<SphinxRound>('hear');
  const [set, setSet] = useState(0);
  const [items, setItems] = useState<TrialItem[]>([]);
  const [result, setResult] = useState<(RoundResult & { good: number; total: number }) | null>(null);
  const [firstVisit] = useState(() => useSphinx.getState().rec.visited === undefined);
  const [showText, setShowText] = useState(false);

  useEffect(() => {
    loadSphinx().then((f) => setFile(f ?? null));
  }, []);
  useEffect(() => {
    if (!sealed) return;
    // Первый приход к Вратам — тайная медаль «Взгляд Сфинкса».
    useSphinx.getState().arrive();
    syncAndEvaluate(Date.now(), {});
  }, [sealed]);

  if (!sealed) {
    return (
      <Screen>
        <TopBar title="Врата Хранилища" />
        <p className="px-5 py-6 text-stone-600" data-testid="sphinx-closed">
          Врата откроются, когда будет получена печать главы V.
        </p>
      </Screen>
    );
  }
  if (!file) return null;
  const sp = file.sphinx;
  const say = (text: string) => speak(text, useSettings.getState().speechRate * sp.voice.rate, sp.voice.pitch);

  const start = () => {
    useSphinx.getState().arrive();
    const r = useSphinx.getState().rec;
    const k = nextRound(r);
    if (!k || sphinxStatus(r, Date.now()) !== 'open') return;
    setRound(k);
    setSet(setIndex(r, k));
    setPhase('intro');
    say(sp.speech[k].es);
  };
  const begin = () => {
    setItems(sphinxItems(file, round, set, seeded(Date.now())));
    setPhase(round === 'hear' ? 'listen' : round === 'wisdom' ? 'read' : 'run');
  };

  if (phase === 'intro') {
    return (
      <Screen>
        <TopBar title={ROUND_TITLE[round]} />
        <div className="flex flex-1 flex-col gap-3 px-5 pb-6" data-testid="sphinx-intro">
          <div className="flex justify-center pt-2">
            <SphinxArt size={180} watching />
          </div>
          <SphinxSays line={sp.speech[round]} gloss={sp.gloss} onSpeak={say} testId="sphinx-round-line" />
          <p className="leading-relaxed text-stone-700">{ROUND_TEXT[round]}</p>
          <p className="text-sm text-stone-500">Нужно {Math.round(SPHINX_PASS * 100)}% верных. Время не ограничено.</p>
          <div className="flex-1" />
          <Button className="w-full" onClick={begin} data-testid="sphinx-begin">
            {round === 'hear' ? 'Слушать' : round === 'wisdom' ? 'Читать' : 'Начать'}
          </Button>
        </div>
      </Screen>
    );
  }

  if (phase === 'listen') {
    const s = file.hear[set];
    const lines = [...s.monologue.lines.map((l) => ({ ...l, who: s.monologue.who })), ...s.dispute];
    return <Listen lines={lines} monologue={s.monologue.lines.length} onDone={() => setPhase('run')} />;
  }

  if (phase === 'read') {
    return (
      <Screen>
        <TopBar title={ROUND_TITLE.wisdom} />
        <div className="flex flex-1 flex-col gap-3 px-5 pb-6" data-testid="sphinx-read">
          <WisdomText title={file.wisdom[set].title} text={file.wisdom[set].text} gloss={file.wisdom[set].gloss} />
          <p className="text-sm text-stone-500">Текст можно перечитать и во время вопросов: кнопка «Текст» над заданием.</p>
          <Button className="w-full" onClick={() => setPhase('run')} data-testid="sphinx-questions">
            К вопросам
          </Button>
        </div>
      </Screen>
    );
  }

  if (phase === 'run') {
    const w = file.wisdom[set];
    return (
      <>
        <TrialPlayer
          items={items}
          words={{}}
          label={ROUND_TITLE[round]}
          mode="sphinx"
          aside={
            round === 'wisdom' ? (
              <button type="button" onClick={() => setShowText(true)} className="press rounded-full bg-wood/10 px-3 py-1 text-sm" data-testid="sphinx-text">
                📜 Текст
              </button>
            ) : undefined
          }
          onExit={() => setPhase('gate')}
          onFinish={(sc) => {
            const good = sc.correct + sc.almost;
            const total = sc.correct + sc.almost + sc.wrong;
            const res = useSphinx.getState().finish(round, good, total);
            useProgress.getState().addXp(sc.correct * XP.correct + sc.almost * XP.almost);
            syncAndEvaluate(Date.now(), {});
            setResult({ ...res, good, total });
            setPhase('result');
            say(sp.speech[res.victory ? 'victory' : res.passed ? 'pass' : res.exhausted ? 'rest' : 'fail'].es);
          }}
        />
        {showText && (
          <div className="fixed inset-0 z-30 overflow-y-auto bg-stone-50 px-5 pb-6" role="dialog" aria-label="Текст загадки" data-testid="sphinx-text-sheet">
            <div className="mx-auto flex max-w-md flex-col gap-3 pt-4">
              <WisdomText title={w.title} text={w.text} gloss={w.gloss} />
              <Button className="w-full" onClick={() => setShowText(false)}>
                К заданию
              </Button>
            </div>
          </div>
        )}
      </>
    );
  }

  if (phase === 'result' && result) {
    const line: SphinxLine = result.victory ? 'victory' : result.passed ? 'pass' : result.exhausted ? 'rest' : 'fail';
    const more = !result.victory && !result.exhausted;
    return (
      <Screen>
        <TopBar title={ROUND_TITLE[round]} back={false} />
        <div className="flex flex-1 flex-col gap-3 px-5 pb-6">
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-white p-4 text-center shadow-sm" data-testid="sphinx-result">
            <SphinxArt size={150} watching={!result.passed} />
            <div className="text-lg font-bold">{result.victory ? 'Все загадки разгаданы' : result.passed ? 'Загадка разгадана' : 'Сфинкс не принял ответ'}</div>
            <p className="text-stone-600 tabular-nums">
              Верно: {result.good} из {result.total} ({Math.round((result.good / Math.max(1, result.total)) * 100)}%)
            </p>
            <Hearts n={result.rec.hearts} />
          </div>
          <SphinxSays line={sp.speech[line]} gloss={sp.gloss} onSpeak={say} testId="sphinx-verdict" />
          {!result.passed && !result.exhausted && <p className="text-sm text-stone-500">Следующая попытка — по другим вопросам.</p>}
          {result.exhausted && <p className="text-sm text-stone-500">Сердца кончились. Сфинкс ждёт вас через три дня, вопросы будут другими.</p>}
          <div className="flex-1" />
          {more && (
            <Button className="w-full" onClick={start} data-testid="sphinx-next">
              {result.passed ? `Дальше: ${ROUND_TITLE[nextRound(result.rec) ?? 'wisdom'].toLowerCase()}` : 'Ещё раз'}
            </Button>
          )}
          <Button variant={more ? 'secondary' : 'primary'} className="w-full" onClick={() => setPhase('gate')} data-testid="sphinx-back">
            К Вратам
          </Button>
        </div>
      </Screen>
    );
  }

  const status = sphinxStatus(rec, now);
  const current = nextRound(rec);
  const greeting: SphinxLine = status === 'done' ? 'victory' : status === 'waiting' ? 'waiting' : firstVisit ? 'greeting' : 'again';
  return (
    <Screen>
      <TopBar title="Врата Хранилища" />
      <div className="flex flex-1 flex-col gap-3 px-5 pb-6" data-testid="sphinx-gate">
        <div className="flex flex-col items-center rounded-2xl bg-white p-4 shadow-sm">
          <SphinxArt size={200} watching={status === 'open'} />
          <div className="mt-1 text-lg font-bold capitalize">{sp.name}</div>
          <Hearts n={status === 'waiting' ? 0 : rec.hearts} />
        </div>
        <SphinxSays line={sp.speech[greeting]} gloss={sp.gloss} onSpeak={say} testId="sphinx-greeting" />
        <ol className="flex flex-col gap-2" data-testid="sphinx-rounds">
          {SPHINX_ROUNDS.map((k, i) => {
            const done = rec.rounds[k] !== undefined;
            return (
              <li
                key={k}
                data-state={done ? 'done' : k === current ? 'current' : 'locked'}
                className={`flex items-center gap-3 rounded-2xl border-2 px-3 py-2 ${done ? 'border-ok bg-okbg' : k === current ? 'border-gold bg-white' : 'border-stone-200 bg-white opacity-60'}`}
              >
                <span className="font-pixel w-5 text-center text-amber-700">{done ? '✓' : i + 1}</span>
                <span className="flex-1 font-semibold">{ROUND_TITLE[k]}</span>
              </li>
            );
          })}
        </ol>
        <p className="text-sm leading-relaxed text-stone-500">
          {SPHINX_HEARTS} сердца на всю встречу. Загадка разгадана при {Math.round(SPHINX_PASS * 100)}% верных ответов, время не ограничено.
          Ошибка стоит сердце, и Сфинкс спрашивает о другом. Сердца кончились — он ждёт три дня. Разгаданное не отнимается.
        </p>
        <div className="flex-1" />
        {status === 'done' && (
          <p className="rounded-2xl bg-okbg px-4 py-3 text-center font-semibold text-ok" data-testid="sphinx-state">
            ✓ Загадки разгаданы, Врата открыты
          </p>
        )}
        {status === 'waiting' && rec.waitUntil !== undefined && (
          <p className="rounded-2xl bg-orange-50 px-4 py-3 text-center text-stone-600" data-testid="sphinx-state">
            Сфинкс ждёт вас снова {sphinxWaitLabel(rec.waitUntil, now)}.
          </p>
        )}
        {status === 'open' && current && (
          <Button className="w-full" onClick={start} data-testid="sphinx-start">
            {ROUND_TITLE[current]}
          </Button>
        )}
        <Button variant="secondary" className="w-full" onClick={() => nav('/journey-map')}>
          На карту странствий
        </Button>
      </div>
    </Screen>
  );
}

function Hearts({ n }: { n: number }) {
  return (
    <div className="text-2xl tracking-widest" role="img" aria-label={`Сердца: ${n} из ${SPHINX_HEARTS}`} data-testid="sphinx-hearts" data-hearts={n}>
      {Array.from({ length: SPHINX_HEARTS }, (_, i) => (i < n ? '❤️' : '🖤')).join('')}
    </div>
  );
}

/** Реплика Сфинкса на изучаемом языке: перевод по нажатию, слова из `gloss` тоже нажимаются. */
function SphinxSays({ line, gloss, onSpeak, testId }: { line: Example; gloss?: Record<string, string>; onSpeak(text: string): void; testId: string }) {
  const [ru, setRu] = useState(false);
  return (
    <div className="flex items-start gap-2 rounded-xl bg-orange-50 px-3 py-2">
      <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setRu(!ru)} data-testid={testId}>
        <span className="block font-semibold italic">{line.es}</span>
        {ru ? (
          <span className="block text-sm text-stone-600" data-testid={`${testId}-ru`}>
            {line.ru}
            <GlossList text={line.es} gloss={gloss} />
          </span>
        ) : (
          <span className="block text-xs text-stone-400">Нажмите, чтобы увидеть перевод</span>
        )}
      </button>
      <button
        type="button"
        aria-label="Озвучить"
        onClick={() => onSpeak(line.es)}
        className="press inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100 text-lg text-brand shadow-sm"
      >
        🔊
      </button>
    </div>
  );
}

/** Переводы слов реплики из `gloss`: «bóveda — хранилище». */
function GlossList({ text, gloss }: { text: string; gloss?: Record<string, string> }) {
  const keys = new Set(sceneWords(text).flatMap((p) => ('key' in p ? [p.key] : [])));
  const found = Object.entries(gloss ?? {}).filter(([k]) => keys.has(k));
  if (!found.length) return null;
  return <span className="mt-1 block text-xs text-stone-500">{found.map(([k, v]) => `${k} — ${v}`).join(', ')}</span>;
}

/** Текст загадки мудрости: заголовок и абзацы, слова из `gloss` подчёркнуты и переводятся по нажатию. */
function WisdomText({ title, text, gloss }: { title: string; text: Example[]; gloss?: Record<string, string> }) {
  const [word, setWord] = useState<{ word: string; ru: string } | null>(null);
  return (
    <article className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm" data-testid="sphinx-wisdom-text">
      <h2 className="text-xl font-bold">{title}</h2>
      {text.map((p, i) => (
        <p key={i} className="text-lg leading-relaxed">
          {sceneChunks(p.es).map((c, k) =>
            'words' in c ? (
              <span key={k} className="whitespace-nowrap">
                {c.words.map((w, j) => {
                  const ru = gloss?.[w.key];
                  return (
                    <span key={j}>
                      {w.pre}
                      {ru ? (
                        <button type="button" className="rounded underline decoration-amber-600 decoration-dotted underline-offset-4" onClick={() => setWord({ word: w.word, ru })}>
                          {w.word}
                        </button>
                      ) : (
                        w.word
                      )}
                      {w.post}
                    </span>
                  );
                })}
              </span>
            ) : (
              <span key={k}>{c.text}</span>
            ),
          )}
        </p>
      ))}
      {word && (
        <div className="sticky bottom-2 rounded-2xl bg-wood px-4 py-3 text-white" role="status" data-testid="sphinx-word">
          <span className="font-semibold">{word.word}</span> — {word.ru}
        </div>
      )}
    </article>
  );
}

/**
 * Загадка слуха: реплики по одной голосом говорящего, текст скрыт, пока есть звук. Сначала монолог, потом спор.
 */
function Listen({ lines, monologue, onDone }: { lines: { who: string; es: string; ru: string }[]; monologue: number; onDone(): void }) {
  const [index, setIndex] = useState(0);
  const [heard] = useState(listeningEnabled);
  const line = lines[index];
  const npc = voiceOf(line.who);
  const sayLine = () => {
    const rate = useSettings.getState().speechRate;
    if (npc) speak(line.es, rate * npc.voice.rate, npc.voice.pitch);
    else speak(line.es, rate);
  };
  // Новая реплика звучит сразу.
  useEffect(() => sayLine(), [index]);

  const last = index + 1 >= lines.length;
  return (
    <Screen>
      <TopBar title={ROUND_TITLE.hear} />
      <div className="flex flex-1 flex-col gap-4 px-5 pb-6" data-testid="sphinx-listen">
        <div className="font-pixel text-xs tracking-widest text-amber-700 uppercase">{index < monologue ? 'Монолог' : 'Спор'}</div>
        <p className="text-stone-600">
          {heard
            ? 'Слушайте внимательно: текста не будет, вопросы — после.'
            : 'Звук сейчас недоступен, поэтому речь видна текстом. Перевода не будет, вопросы — после.'}
        </p>
        <div className="flex flex-col items-center gap-1 rounded-2xl border-2 border-gold bg-white px-2 py-3" data-testid="sphinx-speaker">
          {npc && <NpcPortrait look={npc.look} size={110} />}
          <div className="text-center font-semibold">{npc?.name}</div>
          <div className="text-sm text-stone-500">говорит…</div>
        </div>
        <div className="text-sm text-stone-500 tabular-nums">
          Реплика {index + 1} из {lines.length}
        </div>
        {!heard && (
          <div className="rounded-2xl border-2 border-stone-300 bg-white px-3 py-2 text-lg leading-snug" data-testid="sphinx-line-text">
            {line.es}
          </div>
        )}
        <div className="flex-1" />
        <Button variant="secondary" className="w-full" onClick={sayLine} data-testid="sphinx-again">
          🔊 Ещё раз
        </Button>
        <Button className="w-full" onClick={() => (last ? onDone() : setIndex(index + 1))} data-testid="sphinx-line-next">
          {last ? 'К вопросам' : 'Дальше'}
        </Button>
      </div>
    </Screen>
  );
}
