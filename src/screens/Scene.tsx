import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { listeningEnabled, speakAs, speakHero } from '../audio/tts';
import { npcFor, speakerOf } from '../content/npcs';
import { loadScene, placeOfScene } from '../content/scenes';
import type { Scene, SceneLine } from '../content/schema';
import { logAnswer } from '../db/answers';
import { seeded, shuffle } from '../domain/generators';
import { plural } from '../domain/medals';
import { sceneChunks, wordTranslation } from '../domain/sceneText';
import { NpcPortrait } from '../components/NpcPortrait';
import { HeroPortrait } from '../components/HeroPortrait';
import { Button, Screen, TopBar } from '../components/ui';

/** Реплика голосом говорящего: житель — своим голосом, герой — голосом выбранного пола. */
export function sayLine(line: SceneLine, place: string) {
  const npc = speakerOf(line.who, place);
  if (npc) speakAs(line.es, npc);
  else speakHero(line.es);
}

/**
 * Сцена: разговор с жителем (задача 4.4). Реплики по одной с озвучкой голосом жителя, перевод слова по нажатию
 * и перевод реплики по кнопке, «Ещё раз» — повторить реплику. После разговора — вопросы на понимание.
 */
export function SceneScreen() {
  const id = decodeURIComponent(useParams().id ?? '');
  // Своё состояние у каждой сцены: переход с одной сцены на другую начинает её заново.
  return <SceneById key={id} id={id} />;
}

function SceneById({ id }: { id: string }) {
  const place = placeOfScene(id);
  const nav = useNavigate();
  const [scene, setScene] = useState<Scene | null | undefined>(undefined);
  const [phase, setPhase] = useState<'talk' | 'questions'>('talk');

  useEffect(() => {
    loadScene(id).then((s) => setScene(s ?? null));
  }, [id]);

  if (scene === undefined) return null;
  if (scene === null) {
    return (
      <Screen>
        <TopBar title="Разговор" />
        <p className="px-5 py-6 text-stone-600">Такой сцены нет.</p>
      </Screen>
    );
  }

  if (scene.mode === 'overhear') return <Whisper scene={scene} place={place} onDone={() => nav(-1)} />;
  const npc = npcFor(place);
  return (
    <Screen>
      <TopBar title={npc ? `Разговор: ${npc.name}` : 'Разговор'} />
      {phase === 'talk' ? (
        <SceneTalk scene={scene} place={place} lastLabel="К вопросам" onDone={() => setPhase('questions')} />
      ) : (
        <SceneQuiz scene={scene} onDone={() => nav(-1)} />
      )}
    </Screen>
  );
}

/** Реплики сцены по одной: голос, перевод слова и реплики, «Ещё раз». Используется и в миссии как вступление. */
export function SceneTalk({ scene, place, lastLabel, onDone }: { scene: Scene; place: string; lastLabel: string; onDone(): void }) {
  const [index, setIndex] = useState(0);
  const [showRu, setShowRu] = useState(false);
  const [word, setWord] = useState<{ word: string; ru?: string } | null>(null);
  const line = scene.lines[index];
  useEffect(() => {
    sayLine(line, place);
    // Новая реплика — в поле зрения: разговор длиннее экрана.
    document.querySelector('[data-testid=scene-current]')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [line, place]);

  const next = () => {
    setWord(null);
    setShowRu(false);
    if (index + 1 >= scene.lines.length) onDone();
    else setIndex(index + 1);
  };

  return (
      <div className="flex flex-1 flex-col gap-3 px-4 pb-6">
        <div className="text-sm text-stone-500 tabular-nums">
          Реплика {index + 1} из {scene.lines.length} · нажмите на слово, чтобы увидеть перевод
        </div>
        <ul className="flex flex-col gap-2" data-testid="scene-lines">
          {scene.lines.slice(0, index + 1).map((l, i) => {
            const hero = l.who === 'hero';
            const speaker = speakerOf(l.who, place);
            const current = i === index;
            return (
              <li key={i} className={`flex items-end gap-2 ${hero ? 'flex-row-reverse' : ''} ${current ? '' : 'opacity-60'}`}>
                {speaker ? <NpcPortrait look={speaker.look} size={40} /> : <HeroPortrait size={40} />}
                <div
                  className={`max-w-[80%] rounded-2xl border-2 px-3 py-2 ${hero ? 'rounded-br-none border-brand bg-orange-50' : 'rounded-bl-none border-stone-300 bg-white'}`}
                  data-testid={current ? 'scene-current' : undefined}
                >
                  <div className="text-xs text-stone-500">{hero ? 'Вы' : speaker?.name}</div>
                  <div className="text-lg leading-snug">
                    {sceneChunks(l.es).map((c, k) =>
                      'words' in c ? (
                        // Слово со знаками вокруг не переносится по частям: «mappa?» не превращается в «mappa» и «?» на новой строке,
                        // «l'» не отрывается от следующего слова.
                        <span key={k} className="whitespace-nowrap">
                          {c.words.map((p, j) => (
                            <span key={j}>
                              {p.pre}
                              <button
                                type="button"
                                className="rounded underline decoration-stone-300 decoration-dotted underline-offset-4 hover:bg-orange-100"
                                onClick={() => setWord({ word: p.word, ru: wordTranslation(p.key, scene.gloss, scene.auto) })}
                              >
                                {p.word}
                              </button>
                              {p.post}
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span key={k}>{c.text}</span>
                      ),
                    )}
                  </div>
                  {(current ? showRu : false) && <div className="mt-1 text-sm text-stone-600" data-testid="scene-ru">{l.ru}</div>}
                </div>
              </li>
            );
          })}
        </ul>
        {word && (
          <div className="rounded-2xl bg-wood px-4 py-3 text-white" data-testid="scene-word" role="status">
            <span className="font-semibold">{word.word}</span> — {word.ru ?? 'это слово из уроков грамматики'}
          </div>
        )}
        <div className="flex-1" />
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => line && sayLine(line, place)} data-testid="scene-again">
            🔊 Ещё раз
          </Button>
          <Button variant="secondary" onClick={() => setShowRu(!showRu)} data-testid="scene-translate">
            {showRu ? 'Скрыть перевод' : 'Перевод'}
          </Button>
        </div>
        <Button className="w-full" onClick={next} data-testid="scene-next">
          {index + 1 >= scene.lines.length ? lastLabel : 'Дальше'}
        </Button>
      </div>
  );
}

/**
 * Вопросы на понимание по-русски: варианты перемешаны, после ответа видно верный. `kind` — вид ответа в журнале,
 * `doneLabel` — кнопка после итога.
 */
function SceneQuiz({ scene, onDone, kind = 'scene-question', doneLabel = 'Готово' }: { scene: Scene; onDone(): void; kind?: string; doneLabel?: string }) {
  const questions = useMemo(() => {
    const rng = seeded(Date.now());
    return scene.questions.map((q) => ({ q: q.q, options: shuffle(q.options.map((o, i) => ({ text: o, right: i === q.answer })), rng) }));
  }, [scene]);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [right, setRight] = useState(0);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div className="flex flex-1 flex-col gap-3 px-5 pb-6">
        <div className="rounded-2xl bg-white p-4 text-center shadow-sm" data-testid="scene-result">
          <div className="text-4xl">💬</div>
          <div className="mt-1 text-lg font-bold">
            Понято: {right} из {questions.length}
          </div>
          <p className="text-sm text-stone-500">
            {right === questions.length ? 'Вы поняли весь разговор.' : `Можно послушать ещё раз: ${questions.length - right} ${plural(questions.length - right, ['вопрос', 'вопроса', 'вопросов'])} с ошибкой.`}
          </p>
        </div>
        <div className="flex-1" />
        <Button className="w-full" onClick={onDone}>
          {doneLabel}
        </Button>
      </div>
    );
  }

  const q = questions[index];
  const pick = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    const ok = q.options[i].right;
    if (ok) setRight((r) => r + 1);
    logAnswer({ itemId: scene.id, kind, verdict: ok ? 'correct' : 'wrong', mode: 'learn', ms: 0 });
  };
  const next = () => {
    setPicked(null);
    if (index + 1 >= questions.length) setDone(true);
    else setIndex(index + 1);
  };

  return (
    <div className="flex flex-1 flex-col gap-3 px-5 pb-6" data-testid="scene-quiz">
      <div className="text-sm text-stone-500 tabular-nums">
        Вопрос {index + 1} из {questions.length}
      </div>
      <div className="text-xl font-bold" data-testid="scene-question">
        {q.q}
      </div>
      <div className="flex flex-col gap-2">
        {q.options.map((o, i) => {
          const tone = picked === null ? 'border-stone-300 bg-white' : o.right ? 'border-ok bg-okbg' : i === picked ? 'border-bad bg-badbg' : 'border-stone-300 bg-white';
          return (
            <button key={i} type="button" disabled={picked !== null} onClick={() => pick(i)} className={`press min-h-14 rounded-2xl border-2 px-4 py-3 text-left text-lg ${tone}`}>
              {o.text}
            </button>
          );
        })}
      </div>
      <div className="flex-1" />
      {picked !== null && (
        <Button className="w-full" onClick={next}>
          {index + 1 >= questions.length ? 'Итог' : 'Дальше'}
        </Button>
      )}
    </div>
  );
}

/**
 * Шёпот (задача 6.2): герой подслушивает разговор жителя места с другим жителем. Реплики звучат двумя голосами,
 * текста не видно, пока не отвечены вопросы о подразумеваемом. Потом — расшифровка с переводом. Если звук недоступен,
 * реплики видны текстом: без звука шёпот иначе не пройти.
 */
function Whisper({ scene, place, onDone }: { scene: Scene; place: string; onDone(): void }) {
  const [phase, setPhase] = useState<'listen' | 'questions' | 'transcript'>('listen');
  const [index, setIndex] = useState(0);
  const [heard] = useState(listeningEnabled);
  const npc = npcFor(place);
  const otherId = scene.lines.find((l) => l.who !== 'npc')?.who ?? 'npc';
  const speakers = [{ who: 'npc', npc }, { who: otherId, npc: speakerOf(otherId, place) }];
  const line = scene.lines[index];

  useEffect(() => {
    if (phase === 'listen') sayLine(line, place);
  }, [line, place, phase]);

  const title = `Шёпот: ${speakers.map((s) => s.npc?.name).join(' и ')}`;
  if (phase === 'questions') {
    return (
      <Screen>
        <TopBar title={title} />
        <SceneQuiz scene={scene} kind="listen-whisper" doneLabel="Расшифровка" onDone={() => setPhase('transcript')} />
      </Screen>
    );
  }
  if (phase === 'transcript') {
    return (
      <Screen>
        <TopBar title={title} />
        <div className="flex flex-1 flex-col gap-3 px-4 pb-6">
          <p className="text-sm text-stone-500">Что было сказано на самом деле. Нажмите на реплику, чтобы услышать её ещё раз.</p>
          <ul className="flex flex-col gap-2" data-testid="whisper-transcript">
            {scene.lines.map((l, i) => {
              const who = speakerOf(l.who, place);
              return (
                <li key={i}>
                  <button type="button" onClick={() => sayLine(l, place)} className="press flex w-full items-start gap-2 rounded-2xl bg-white px-3 py-2 text-left shadow-sm">
                    {who && <NpcPortrait look={who.look} size={40} />}
                    <span className="min-w-0">
                      <span className="block text-xs text-stone-500">{who?.name}</span>
                      <span className="block text-lg leading-snug">{l.es}</span>
                      <span className="block text-sm text-stone-600">{l.ru}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <Button className="w-full" onClick={onDone}>
            Готово
          </Button>
        </div>
      </Screen>
    );
  }

  const next = () => (index + 1 >= scene.lines.length ? setPhase('questions') : setIndex(index + 1));
  return (
    <Screen>
      <TopBar title={title} />
      <div className="flex flex-1 flex-col gap-4 px-4 pb-6" data-testid="whisper-listen">
        <p className="text-stone-600">
          {heard
            ? 'Жители не знают, что вы рядом. Слушайте внимательно: текст откроется после вопросов.'
            : 'Звук сейчас недоступен, поэтому разговор виден текстом. Перевод откроется после вопросов.'}
        </p>
        <div className="grid grid-cols-2 gap-3">
          {speakers.map((s) => {
            const talking = line.who === s.who;
            return (
              <div
                key={s.who}
                data-testid={talking ? 'whisper-speaker' : undefined}
                className={`flex flex-col items-center gap-1 rounded-2xl border-2 px-2 py-3 transition-opacity ${talking ? 'border-gold bg-white' : 'border-transparent opacity-45'}`}
              >
                {s.npc && <NpcPortrait look={s.npc.look} size={96} />}
                <div className="text-center font-semibold leading-tight">{s.npc?.name}</div>
                <div className="h-5 text-sm text-stone-500">{talking ? 'говорит…' : ''}</div>
              </div>
            );
          })}
        </div>
        <div className="text-sm text-stone-500 tabular-nums">
          Реплика {index + 1} из {scene.lines.length}
        </div>
        {!heard && (
          <div className="rounded-2xl border-2 border-stone-300 bg-white px-3 py-2 text-lg leading-snug" data-testid="whisper-text">
            {line.es}
          </div>
        )}
        <div className="flex-1" />
        <Button variant="secondary" className="w-full" onClick={() => sayLine(line, place)} data-testid="scene-again">
          🔊 Ещё раз
        </Button>
        <Button className="w-full" onClick={next} data-testid="scene-next">
          {index + 1 >= scene.lines.length ? 'К вопросам' : 'Дальше'}
        </Button>
      </div>
    </Screen>
  );
}
