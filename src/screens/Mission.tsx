import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { speak } from '../audio/tts';
import { loadMission, placeOfMission } from '../content/missions';
import { npcFor } from '../content/npcs';
import { loadPhrases } from '../content/phrases';
import { loadScene } from '../content/scenes';
import type { Mission, MissionAnswer, Phrase, Scene } from '../content/schema';
import { logAnswer } from '../db/answers';
import { seeded } from '../domain/generators';
import { answerNode, isPassed, MISSION_PASS, MISSION_REWARD, missionOptions, modeForAttempt, type HeroAnswer, type MissionMode } from '../domain/mission';
import { fullPhrase } from '../domain/phrase';
import { makeTiles } from '../domain/phraseSteps';
import type { Rank } from '../domain/reputation';
import { L, LANG } from '../lang';
import { CHAPTERS as PLAN } from '../content/vocabPlan';
import { NpcPortrait } from '../components/NpcPortrait';
import { Button, Screen, TopBar } from '../components/ui';
import { useCity } from '../store/city';
import { useErrands } from '../store/errands';
import { useMissions } from '../store/missions';
import { syncAndEvaluate } from '../store/motivation';
import { useSettings } from '../store/settings';
import { SceneTalk } from './Scene';

type Bubble = { who: 'npc' | 'hero'; es: string; ru?: string; tone?: 'wrong' | 'hint' };

const MODE_LABEL: Record<MissionMode, string> = { choose: 'выбор фразы', tiles: 'сборка из плиток', type: 'ввод своими словами' };

/**
 * Сюжетная миссия (задача 4.5): сцена-вступление, потом диалог, где герой отвечает жителю фразами места.
 * Режим ответа зависит от номера прохождения: выбор, сборка, ввод. Засчитана при 80% верных ответов.
 */
export function MissionScreen() {
  const id = decodeURIComponent(useParams().id ?? '');
  const place = placeOfMission(id);
  const nav = useNavigate();
  const npc = npcFor(place);
  const [data, setData] = useState<{ mission: Mission; scene?: Scene; phrases: Record<string, Phrase>; pool: Phrase[] } | null | undefined>(undefined);
  const [attempt, setAttempt] = useState(0);
  const [phase, setPhase] = useState<'scene' | 'dialog' | 'result'>('scene');
  const [result, setResult] = useState<{ correct: number; answered: number; first: boolean; rankUp: Rank | null } | null>(null);
  const started = useRef(false);

  useEffect(() => {
    // Прохождение считается один раз, даже если эффект запущен дважды (строгий режим React).
    if (started.current) return;
    started.current = true;
    (async () => {
      const mission = await loadMission(id);
      if (!mission) return setData(null);
      const all = await loadPhrases(place);
      const scene = mission.scene ? await loadScene(mission.scene) : undefined;
      setAttempt(useMissions.getState().start(id));
      setData({ mission, scene, phrases: Object.fromEntries(all.map((p) => [p.id, p])), pool: all.filter((p) => p.level <= Math.max(...(PLAN[mission.chapter - 1]?.levels ?? [1]))) });
      if (!scene) setPhase('dialog');
    })();
  }, [id, place]);

  if (data === undefined) return null;
  if (data === null) {
    return (
      <Screen>
        <TopBar title="Миссия" />
        <p className="px-5 py-6 text-stone-600">Такой миссии нет.</p>
      </Screen>
    );
  }

  const mode = modeForAttempt(attempt);
  const title = npc ? `Миссия: ${npc.name}` : 'Миссия';

  if (phase === 'result' && result) {
    const share = result.answered ? result.correct / result.answered : 0;
    const passed = isPassed(result.correct, result.answered);
    return (
      <Screen>
        <TopBar title={title} back={false} />
        <div className="flex flex-1 flex-col gap-3 px-5 pb-6">
          <div className="rounded-2xl bg-white p-4 text-center shadow-sm" data-testid="mission-result">
            <div className="text-4xl">{passed ? '⭐' : '💬'}</div>
            <div className="mt-1 text-lg font-bold">{passed ? 'Миссия выполнена' : 'Пока не получилось'}</div>
            <p className="text-stone-600 tabular-nums">
              Верных ответов: {result.correct} из {result.answered} ({Math.round(share * 100)}%)
            </p>
            {!passed && <p className="mt-1 text-sm text-stone-500">Нужно {Math.round(MISSION_PASS * 100)}%. В следующий раз ответы будут {MODE_LABEL[modeForAttempt(attempt + 1)]}.</p>}
            {result.first && (
              <p className="mt-2 font-semibold text-amber-700" data-testid="mission-reward">
                +{MISSION_REWARD.coins} 🪙 · отношения с {npc?.name ?? 'жителем'} +{MISSION_REWARD.rep}
              </p>
            )}
            {result.rankUp && <p className="mt-1 text-sm font-semibold text-ok">Отношения стали ближе: {result.rankUp.ru}</p>}
          </div>
          <div className="flex-1" />
          {!passed && (
            <Button variant="secondary" className="w-full" onClick={() => location.reload()} data-testid="mission-retry">
              Ещё раз
            </Button>
          )}
          <Button className="w-full" onClick={() => nav(`/loc/${place}`, { replace: true })}>
            Готово
          </Button>
        </div>
      </Screen>
    );
  }

  return (
    <Screen>
      <TopBar title={title} />
      {phase === 'scene' && data.scene ? (
        <SceneTalk scene={data.scene} place={place} lastLabel="Ответить жителю" onDone={() => setPhase('dialog')} />
      ) : (
        <MissionDialog
          mission={data.mission}
          phrases={data.phrases}
          pool={data.pool}
          mode={mode}
          place={place}
          onDone={(correct, answered) => {
            const passed = isPassed(correct, answered);
            const first = useMissions.getState().finish(id, answered ? correct / answered : 0, passed);
            let rankUp: Rank | null = null;
            if (first) {
              useCity.getState().addCoins(MISSION_REWARD.coins);
              if (npc) rankUp = useErrands.getState().addRep(npc.id, MISSION_REWARD.rep);
            }
            // Миссия — условие обрывка карты: путь и медали пересчитываются сразу.
            syncAndEvaluate(Date.now(), {});
            setResult({ correct, answered, first, rankUp });
            setPhase('result');
          }}
        />
      )}
    </Screen>
  );
}

function MissionDialog({ mission, phrases, pool, mode, place, onDone }: {
  mission: Mission;
  phrases: Record<string, Phrase>;
  pool: Phrase[];
  mode: MissionMode;
  place: string;
  onDone(correct: number, answered: number): void;
}) {
  const npc = npcFor(place);
  const [nodeId, setNodeId] = useState<string | undefined>(mission.start);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [score, setScore] = useState({ correct: 0, answered: 0 });
  const [pending, setPending] = useState<string | undefined>(undefined);
  const node = nodeId ? mission.nodes[nodeId] : undefined;
  const endRef = useRef<HTMLDivElement>(null);
  const say = (es: string) => (npc ? speak(es, useSettings.getState().speechRate * npc.voice.rate, npc.voice.pitch) : speak(es));

  const shown = useRef<string | undefined>(undefined);
  // Реплика жителя: в ленту и голосом, по одному разу на узел.
  useEffect(() => {
    if (node?.kind === 'say' && shown.current !== nodeId) {
      shown.current = nodeId;
      setBubbles((b) => [...b, { who: 'npc', es: node.es, ru: node.ru }]);
      say(node.es);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId]);
  useEffect(() => endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }), [bubbles, pending]);

  const advance = (next: string | undefined) => {
    setPending(undefined);
    if (next) setNodeId(next);
    else onDone(score.correct, score.answered);
  };

  const answer = (a: HeroAnswer, said: string) => {
    if (!node || node.kind !== 'answer') return;
    const r = answerNode(node, a, phrases);
    const ok = r.verdict !== 'wrong';
    logAnswer({ itemId: mission.id, kind: `mission-${mode}`, verdict: r.verdict, mode: 'learn', ms: 0 });
    setScore((s) => ({ correct: s.correct + (ok ? 1 : 0), answered: s.answered + 1 }));
    const heroLine = ok ? fullPhrase(phrases[r.phrase].es) : said;
    const next: Bubble[] = [{ who: 'hero', es: heroLine, tone: ok ? undefined : 'wrong' }];
    if (!ok) {
      next.push({ who: 'npc', es: node.wrong.es, ru: node.wrong.ru });
      next.push({ who: 'hero', es: `Правильно: ${fullPhrase(phrases[r.phrase].es)}`, tone: 'hint' });
      say(node.wrong.es);
    } else {
      speak(heroLine);
    }
    setBubbles((b) => [...b, ...next]);
    // После ошибки даём прочитать реакцию, после верного ответа диалог идёт сам.
    if (ok) advance(r.next);
    else setPending(r.next);
  };

  return (
    <div className="flex flex-1 flex-col gap-3 px-4 pb-6">
      <div className="text-sm text-stone-500">Ответы: {MODE_LABEL[mode]} · верных нужно {Math.round(MISSION_PASS * 100)}%</div>
      <ul className="flex flex-col gap-2" data-testid="mission-lines">
        {bubbles.map((b, i) => (
          <MissionBubble key={i} bubble={b} npcLook={npc?.look} npcName={npc?.name} />
        ))}
      </ul>
      <div ref={endRef} />
      <div className="flex-1" />
      {pending !== undefined || node?.kind === 'say' ? (
        <Button className="w-full" onClick={() => advance(pending !== undefined ? pending : node?.kind === 'say' ? node.next : undefined)} data-testid="mission-next">
          {pending === undefined && node?.kind === 'say' && !node.next ? 'Завершить' : 'Дальше'}
        </Button>
      ) : node?.kind === 'answer' ? (
        <HeroTurn key={nodeId} node={node} phrases={phrases} pool={pool} mode={mode} onAnswer={answer} />
      ) : null}
    </div>
  );
}

function MissionBubble({ bubble, npcLook, npcName }: { bubble: Bubble; npcLook?: Parameters<typeof NpcPortrait>[0]['look']; npcName?: string }) {
  const [ru, setRu] = useState(false);
  const hero = bubble.who === 'hero';
  const tone = bubble.tone === 'wrong' ? 'border-bad bg-badbg' : bubble.tone === 'hint' ? 'border-ok bg-okbg' : hero ? 'border-brand bg-orange-50' : 'border-stone-300 bg-white';
  return (
    <li className={`flex items-end gap-2 ${hero ? 'flex-row-reverse' : ''}`} data-testid={hero ? 'hero-line' : 'npc-line'}>
      {hero ? <span className="w-10 shrink-0 text-center text-2xl" aria-hidden>🧭</span> : npcLook && <NpcPortrait look={npcLook} size={40} />}
      <button
        type="button"
        disabled={!bubble.ru}
        onClick={() => setRu(!ru)}
        className={`max-w-[80%] rounded-2xl border-2 px-3 py-2 text-left ${hero ? 'rounded-br-none' : 'rounded-bl-none'} ${tone}`}
      >
        <div className="text-xs text-stone-500">{hero ? 'Вы' : npcName}</div>
        <div className={`text-lg leading-snug ${bubble.tone === 'wrong' ? 'line-through decoration-bad/60' : ''}`}>{bubble.es}</div>
        {ru && bubble.ru && <div className="mt-1 text-sm text-stone-600">{bubble.ru}</div>}
      </button>
    </li>
  );
}

/** Ход героя: задача по-русски и ответ в режиме прохождения. */
function HeroTurn({ node, phrases, pool, mode, onAnswer }: {
  node: MissionAnswer;
  phrases: Record<string, Phrase>;
  pool: Phrase[];
  mode: MissionMode;
  onAnswer(a: HeroAnswer, said: string): void;
}) {
  const rng = useMemo(() => seeded(Date.now()), []);
  const options = useMemo(() => missionOptions(node, pool, rng), [node, pool, rng]);
  const tiles = useMemo(() => makeTiles(phrases[node.branches[0].phrase], pool, rng), [node, phrases, pool, rng]);
  const [chosen, setChosen] = useState<number[]>([]);
  const [text, setText] = useState('');
  return (
    <div className="rounded-2xl bg-white p-3 shadow-sm" data-testid="hero-turn">
      <div className="text-sm text-stone-500">Ваш ответ</div>
      <div className="font-semibold" data-testid="hero-task">
        {node.task}
      </div>
      {mode === 'choose' && (
        <div className="mt-2 flex flex-col gap-2">
          {options.map((pid) => (
            <button
              key={pid}
              type="button"
              onClick={() => onAnswer({ kind: 'pick', phrase: pid }, fullPhrase(phrases[pid].es))}
              className="press min-h-12 rounded-xl border-2 border-stone-300 bg-white px-3 py-2 text-left text-lg"
            >
              {fullPhrase(phrases[pid].es)}
            </button>
          ))}
        </div>
      )}
      {mode === 'tiles' && (
        <>
          <div className="mt-2 flex min-h-12 flex-wrap gap-2 rounded-xl border-2 border-dashed border-stone-300 p-2">
            {chosen.map((idx, pos) => (
              <button key={idx} type="button" onClick={() => setChosen(chosen.filter((_, p) => p !== pos))} className="press h-10 rounded-lg bg-orange-50 px-2 text-lg">
                {tiles[idx]}
              </button>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-2" data-testid="mission-tiles">
            {tiles.map((t, idx) => (
              <button
                key={idx}
                type="button"
                disabled={chosen.includes(idx)}
                onClick={() => setChosen([...chosen, idx])}
                className={`press h-10 rounded-lg border-2 border-stone-300 bg-white px-2 text-lg ${chosen.includes(idx) ? 'opacity-0' : ''}`}
              >
                {t}
              </button>
            ))}
          </div>
          <Button
            className="mt-2 w-full"
            disabled={!chosen.length}
            onClick={() => {
              const said = chosen.map((i) => tiles[i]).join(' ');
              onAnswer({ kind: 'text', text: said }, said);
            }}
          >
            Сказать
          </Button>
        </>
      )}
      {mode === 'type' && (
        <form
          className="mt-2 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) onAnswer({ kind: 'text', text }, text.trim());
          }}
        >
          <input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            lang={LANG}
            autoCapitalize="sentences"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            className="h-12 rounded-xl border-2 border-stone-300 bg-white px-3 text-lg outline-none focus:border-brand"
            placeholder={`Ответ ${L.adverb}`}
          />
          <Button type="submit" disabled={!text.trim()} className="w-full">
            Сказать
          </Button>
        </form>
      )}
    </div>
  );
}

