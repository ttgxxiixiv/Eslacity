import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { speakAs, speakHero } from '../audio/tts';
import { HeroPortrait } from '../components/HeroPortrait';
import { NpcPortrait } from '../components/NpcPortrait';
import { Button, Screen, SpeakButton } from '../components/ui';
import { XP } from '../config';
import { wordsByIds } from '../content/index';
import { npcFor } from '../content/npcs';
import { PROLOGUE } from '../content/prologue';
import type { PrologueAsk, PrologueLine, Word } from '../content/schema';
import { normalize } from '../domain/answer';
import { placementOffered } from '../domain/placement';
import { PROLOGUE_STEPS, type PrologueStep } from '../domain/prologue';
import { wordIds } from '../domain/itemId';
import { LANG } from '../lang';
import { usePlacement } from '../store/placement';
import { useProgress } from '../store/progress';
import { usePrologue } from '../store/prologue';
import { heroText, useSettings } from '../store/settings';

/**
 * Пролог (задача 13.2): путник у ворот, Привратник учит трём словам и ведёт к кафе, житель кафе ждёт три ответа
 * выбором, в конце — обрывок пролога и приглашение на входной тест. Его можно пропустить на любом шаге.
 */
export function PrologueScreen() {
  const nav = useNavigate();
  const [step, setStep] = useState<PrologueStep>('gate');
  const next = () => setStep(PROLOGUE_STEPS[PROLOGUE_STEPS.indexOf(step) + 1]);
  const skip = () => {
    usePrologue.getState().skip();
    nav('/', { replace: true });
  };
  return (
    <Screen>
      <div className="flex min-h-full flex-col px-4 pt-4 pb-6" data-testid="prologue" data-step={step}>
        <div className="flex items-center justify-between">
          <div className="font-pixel text-lg text-wood">Пролог · {PROLOGUE_STEPS.indexOf(step) + 1} из {PROLOGUE_STEPS.length}</div>
          {step !== 'shard' && (
            <button type="button" onClick={skip} className="press px-2 py-1 text-sm text-stone-500 underline" data-testid="prologue-skip">
              Пропустить
            </button>
          )}
        </div>
        {step === 'gate' && <Dialogue key="gate" lines={PROLOGUE.gate} intro="Путник стоит у городских ворот. Навстречу выходит привратник." onDone={next} />}
        {step === 'words' && <WordsStep onDone={next} />}
        {step === 'road' && <Dialogue key="road" lines={PROLOGUE.road} intro="Слова выучены. Привратник показывает дорогу." onDone={next} />}
        {step === 'mission' && <MissionStep onDone={next} />}
        {step === 'shard' && <ShardStep />}
      </div>
    </Screen>
  );
}

const resident = () => npcFor('cafe');

/** Кто говорит: портрет, имя и голос. */
function Speaker({ who }: { who: PrologueLine['who'] }) {
  const npc = who === 'gatekeeper' ? PROLOGUE.gatekeeper : who === 'resident' ? resident() : null;
  return (
    <div className="flex w-20 shrink-0 flex-col items-center">
      {npc ? <NpcPortrait look={npc.look} size={72} /> : <HeroPortrait size={72} mirror />}
      <div className="mt-1 text-center text-xs text-stone-500">{npc ? npc.name : 'Вы'}</div>
    </div>
  );
}

function say(who: PrologueLine['who'], es: string) {
  if (who === 'hero') speakHero(es);
  else {
    const npc = who === 'gatekeeper' ? PROLOGUE.gatekeeper : resident();
    if (npc) speakAs(es, npc);
  }
}

/** Реплика: текст на языке курса, перевод, голос. */
function Bubble({ who, line }: { who: PrologueLine['who']; line: { es: string; ru: string } }) {
  const t = heroText(line);
  return (
    <div className={`flex items-end gap-3 ${who === 'hero' ? 'flex-row-reverse' : ''}`} data-testid="prologue-line">
      <Speaker who={who} />
      <div className={`min-w-0 flex-1 rounded-2xl px-4 py-3 shadow-sm ${who === 'hero' ? 'bg-amber-50' : 'bg-white'}`}>
        <div className="flex items-start gap-2">
          <div className="flex-1 text-lg font-semibold" lang={LANG}>
            {t.es}
          </div>
          <SpeakButton text={t.es} />
        </div>
        {t.ru && <div className="mt-1 text-stone-600">{t.ru}</div>}
      </div>
    </div>
  );
}

function Dialogue({ lines, intro, onDone }: { lines: PrologueLine[]; intro: string; onDone: () => void }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    say(lines[i].who, heroText(lines[i]).es);
  }, [i, lines]);
  return (
    <div className="mt-4 flex flex-1 flex-col gap-4">
      <p className="text-stone-600 italic">{intro}</p>
      {lines.slice(0, i + 1).map((l, k) => (
        <Bubble key={k} who={l.who} line={l} />
      ))}
      <div className="mt-auto">
        <Button className="w-full" onClick={() => (i + 1 < lines.length ? setI(i + 1) : onDone())} data-testid="prologue-next">
          Дальше
        </Button>
      </div>
    </div>
  );
}

/**
 * Три слова у ворот: слово, перевод и голос, потом «Что значит…?» из трёх переводов. Неверно — слово вернётся
 * в конце. Когда все названы, слова становятся карточками, как после урока.
 */
function WordsStep({ onDone }: { onDone: () => void }) {
  const [words, setWords] = useState<Word[] | null>(null);
  const [queue, setQueue] = useState<string[]>([]);
  const [phase, setPhase] = useState<'intro' | 'quiz'>('intro');
  const [picked, setPicked] = useState<string | null>(null);
  useEffect(() => {
    wordsByIds(PROLOGUE.words).then((ws) => {
      const byId = new Map(ws.map((w) => [w.id, w]));
      setWords(PROLOGUE.words.map((id) => byId.get(id)!).filter(Boolean));
      setQueue([...PROLOGUE.words]);
    });
  }, []);
  const word = words?.find((w) => w.id === queue[0]);
  useEffect(() => {
    if (word && phase === 'intro') speakAs(word.es, PROLOGUE.gatekeeper);
  }, [word, phase]);
  if (!words || !word) return null;
  const finish = () => {
    const p = useProgress.getState();
    const { newWords } = p.applyGrades(Object.fromEntries(words.map((w) => [w.id, 4 as const])));
    p.bumpDay({ newWords });
    p.addXp(XP.correct * words.length);
    onDone();
  };
  const answer = (ru: string) => {
    if (picked) return;
    setPicked(ru);
  };
  const go = () => {
    const right = picked === word.ru;
    const rest = right ? queue.slice(1) : [...queue.slice(1), queue[0]];
    setPicked(null);
    setPhase('intro');
    if (!rest.length) finish();
    else setQueue(rest);
  };
  const done = words.length - new Set(queue).size;
  return (
    <div className="mt-4 flex flex-1 flex-col gap-4" data-testid="prologue-words">
      <p className="text-stone-600 italic">
        Привратник учит трём словам: без них в городе не обойтись. Выучено {done} из {words.length}.
      </p>
      {phase === 'intro' ? (
        <>
          <div className="rounded-2xl bg-white p-5 text-center shadow-sm" data-testid="prologue-word" data-word={word.id}>
            <div className="flex items-center justify-center gap-3">
              <div className="text-3xl font-bold" lang={LANG}>
                {word.es}
              </div>
              <SpeakButton text={word.es} size="lg" />
            </div>
            <div className="mt-2 text-xl text-stone-600">{word.ru}</div>
          </div>
          <div className="mt-auto">
            <Button className="w-full" onClick={() => setPhase('quiz')} data-testid="prologue-next">
              Запомнил{useSettings.getState().heroGender === 'f' ? 'а' : ''}
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="text-xl font-bold">
            Что значит «<span lang={LANG}>{word.es}</span>»?
          </div>
          <div className="grid gap-3">
            {words.map((w) => {
              const right = w.ru === word.ru;
              const cls =
                picked === null ? 'border-stone-300 bg-white' : right ? 'border-ok bg-okbg text-ok' : picked === w.ru ? 'border-bad bg-badbg text-bad' : 'border-stone-200 bg-white opacity-60';
              return (
                <button key={w.id} type="button" onClick={() => answer(w.ru)} className={`press min-h-14 rounded-2xl border-2 px-4 py-3 text-left text-lg ${cls}`} data-testid="prologue-meaning">
                  {w.ru}
                </button>
              );
            })}
          </div>
          {picked !== null && (
            <div className="mt-auto">
              <p className="mb-2 text-stone-600" data-testid="prologue-verdict" data-verdict={picked === word.ru ? 'correct' : 'wrong'}>
                {picked === word.ru ? 'Верно!' : `Не то: «${word.es}» — это «${word.ru}». Слово вернётся ещё раз.`}
              </p>
              <Button className="w-full" onClick={go} data-testid="prologue-next">
                Дальше
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Первая миссия: житель кафе говорит, путник отвечает одним из трёх слов. Ошибиться не страшно: можно ещё раз. */
function MissionStep({ onDone }: { onDone: () => void }) {
  const npc = resident();
  const [i, setI] = useState(0);
  const [wrong, setWrong] = useState<PrologueAsk['wrong'] | null>(null);
  const [right, setRight] = useState(false);
  const ask = PROLOGUE.mission[i];
  useEffect(() => {
    if (npc) speakAs(heroText(ask.say).es, npc);
  }, [ask, npc]);
  const pick = (k: number) => {
    if (right) return;
    if (k === ask.answer) {
      setRight(true);
      setWrong(null);
      speakHero(ask.options[k]);
      return;
    }
    setWrong(ask.wrong);
    if (npc) speakAs(heroText(ask.wrong).es, npc);
  };
  const next = () => {
    setRight(false);
    if (i + 1 < PROLOGUE.mission.length) setI(i + 1);
    else onDone();
  };
  return (
    <div className="mt-4 flex flex-1 flex-col gap-4" data-testid="prologue-mission">
      <p className="text-stone-600 italic">
        Кафе. За стойкой {npc?.name ?? 'хозяйка'}. Ответ {i + 1} из {PROLOGUE.mission.length}.
      </p>
      <Bubble who="resident" line={ask.say} />
      {wrong && <Bubble who="resident" line={wrong} />}
      {right && <Bubble who="hero" line={{ es: ask.options[ask.answer], ru: '' }} />}
      <div className="mt-auto grid gap-3">
        {!right &&
          ask.options.map((o, k) => (
            <button
              key={o}
              type="button"
              onClick={() => pick(k)}
              className="press min-h-14 rounded-2xl border-2 border-stone-300 bg-white px-4 py-3 text-left text-lg font-semibold"
              lang={LANG}
              data-testid="prologue-option"
              data-right={normalize(o) === normalize(ask.options[ask.answer])}
            >
              {o}
            </button>
          ))}
        {right && (
          <Button className="w-full" onClick={next} data-testid="prologue-next">
            Дальше
          </Button>
        )}
      </div>
    </div>
  );
}

/** Обрывок пролога: первая находка на пути к Хранилищу. Потом — город или расспросы Летописца. */
function ShardStep() {
  const placement = usePlacement((s) => s.rec);
  const cards = useProgress((s) => s.cards);
  useEffect(() => {
    usePrologue.getState().finish();
  }, []);
  return (
    <div className="mt-4 flex flex-1 flex-col gap-4" data-testid="prologue-shard">
      {PROLOGUE.finale.map((l, k) => (
        <Bubble key={k} who={l.who} line={l} />
      ))}
      <div className="rounded-2xl border-2 border-gold bg-amber-50 p-4 text-center shadow-sm">
        <div className="text-5xl" aria-hidden>
          📜
        </div>
        <div className="mt-1 font-pixel text-xl text-wood">Обрывок пролога</div>
        <p className="mt-1 text-sm text-stone-600">Ворота города и дорога к кафе. Его место — в начале карты странствий.</p>
      </div>
      <div className="mt-auto flex flex-col gap-3">
        {placementOffered(placement, wordIds(Object.keys(cards)).length) && (
          <Link to="/placement" replace className="press rounded-2xl bg-[#2b4f8f] px-4 py-3 text-center font-semibold text-white" data-testid="prologue-placement">
            Уже знаете язык? Летописец расспросит
          </Link>
        )}
        <Link to="/" replace className="press rounded-2xl bg-wood px-4 py-3 text-center font-semibold text-white" data-testid="prologue-home">
          В город
        </Link>
      </div>
    </div>
  );
}
