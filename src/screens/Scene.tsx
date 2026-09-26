import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { speak } from '../audio/tts';
import { npcFor } from '../content/npcs';
import { loadScene, placeOfScene } from '../content/scenes';
import type { Scene, SceneLine } from '../content/schema';
import { logAnswer } from '../db/answers';
import { seeded, shuffle } from '../domain/generators';
import { plural } from '../domain/medals';
import { sceneWords, wordTranslation } from '../domain/sceneText';
import { NpcPortrait } from '../components/NpcPortrait';
import { Button, Screen, TopBar } from '../components/ui';
import { useSettings } from '../store/settings';

/** Реплика голосом говорящего: житель — своим голосом, герой — обычным. */
function sayLine(line: SceneLine, place: string) {
  const rate = useSettings.getState().speechRate;
  const npc = line.who === 'hero' ? undefined : line.who === 'npc' ? npcFor(place) : undefined;
  if (npc) speak(line.es, rate * npc.voice.rate, npc.voice.pitch);
  else speak(line.es, rate);
}

/**
 * Сцена: разговор с жителем (задача 4.4). Реплики по одной с озвучкой голосом жителя, перевод слова по нажатию
 * и перевод реплики по кнопке, «Ещё раз» — повторить реплику. После разговора — вопросы на понимание.
 */
export function SceneScreen() {
  const id = decodeURIComponent(useParams().id ?? '');
  const place = placeOfScene(id);
  const nav = useNavigate();
  const [scene, setScene] = useState<Scene | null | undefined>(undefined);
  const [index, setIndex] = useState(0);
  const [showRu, setShowRu] = useState(false);
  const [word, setWord] = useState<{ word: string; ru?: string } | null>(null);
  const [phase, setPhase] = useState<'talk' | 'questions' | 'done'>('talk');

  useEffect(() => {
    loadScene(id).then((s) => setScene(s ?? null));
  }, [id]);

  const line = scene?.lines[index];
  useEffect(() => {
    if (line && phase === 'talk') sayLine(line, place);
    // Новая реплика — в поле зрения: разговор длиннее экрана.
    document.querySelector('[data-testid=scene-current]')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [line, phase, place]);

  if (scene === undefined) return null;
  if (scene === null) {
    return (
      <Screen>
        <TopBar title="Разговор" />
        <p className="px-5 py-6 text-stone-600">Такой сцены нет.</p>
      </Screen>
    );
  }

  const npc = npcFor(place);
  const title = npc ? `Разговор: ${npc.name}` : 'Разговор';

  if (phase !== 'talk') {
    return (
      <Screen>
        <TopBar title={title} />
        <SceneQuiz scene={scene} onDone={() => nav(-1)} />
      </Screen>
    );
  }

  const next = () => {
    setWord(null);
    setShowRu(false);
    if (index + 1 >= scene.lines.length) setPhase('questions');
    else setIndex(index + 1);
  };

  return (
    <Screen>
      <TopBar title={title} />
      <div className="flex flex-1 flex-col gap-3 px-4 pb-6">
        <div className="text-sm text-stone-500 tabular-nums">
          Реплика {index + 1} из {scene.lines.length} · нажмите на слово, чтобы увидеть перевод
        </div>
        <ul className="flex flex-col gap-2" data-testid="scene-lines">
          {scene.lines.slice(0, index + 1).map((l, i) => {
            const hero = l.who === 'hero';
            const speaker = hero ? undefined : l.who === 'npc' ? npc : npcFor(l.who);
            const current = i === index;
            return (
              <li key={i} className={`flex items-end gap-2 ${hero ? 'flex-row-reverse' : ''} ${current ? '' : 'opacity-60'}`}>
                {speaker ? <NpcPortrait look={speaker.look} size={40} /> : <span className="w-10 shrink-0 text-center text-2xl" aria-hidden>🧭</span>}
                <div
                  className={`max-w-[80%] rounded-2xl border-2 px-3 py-2 ${hero ? 'rounded-br-none border-brand bg-orange-50' : 'rounded-bl-none border-stone-300 bg-white'}`}
                  data-testid={current ? 'scene-current' : undefined}
                >
                  <div className="text-xs text-stone-500">{hero ? 'Вы' : speaker?.name}</div>
                  <div className="text-lg leading-snug">
                    {sceneWords(l.es).map((p, k) =>
                      'word' in p ? (
                        <button
                          key={k}
                          type="button"
                          className="rounded underline decoration-stone-300 decoration-dotted underline-offset-4 hover:bg-orange-100"
                          onClick={() => setWord({ word: p.word, ru: wordTranslation(p.key, scene.gloss, scene.auto) })}
                        >
                          {p.word}
                        </button>
                      ) : (
                        <span key={k}>{p.text}</span>
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
          {index + 1 >= scene.lines.length ? 'К вопросам' : 'Дальше'}
        </Button>
      </div>
    </Screen>
  );
}

/** Вопросы на понимание по-русски: варианты перемешаны, после ответа видно верный. */
function SceneQuiz({ scene, onDone }: { scene: Scene; onDone(): void }) {
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
          Готово
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
    logAnswer({ itemId: scene.id, kind: 'scene-question', verdict: ok ? 'correct' : 'wrong', mode: 'learn', ms: 0 });
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
