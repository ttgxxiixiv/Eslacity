import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { LOCATION_BY_ID } from '../content/locations';
import { npcFor } from '../content/npcs';
import type { LocationId } from '../content/schema';
import { speakAs } from '../audio/tts';
import { NpcPortrait } from '../components/NpcPortrait';
import { Button, Screen, TopBar } from '../components/ui';
import { ECHO_TEXTS, errandReward, errandText, type Errand } from '../domain/errands';
import { isPhraseId, isRuleId, isWordId, splitCards } from '../domain/itemId';
import { plural } from '../domain/medals';
import { dueCards } from '../domain/srs';
import { L } from '../lang';
import { useErrands } from '../store/errands';
import { useProgress } from '../store/progress';
import { ReviewRun } from './Review';

/** Текст просьбы жителя по поручению. */
export function errandRequest(e: Errand): string {
  if (e.kind === 'echo') return errandText(ECHO_TEXTS[e.phrase % ECHO_TEXTS.length], e.items.length);
  const npc = npcFor(e.location);
  const t = npc?.errands[e.phrase % npc.errands.length] ?? 'Помоги мне: {n} {слов}.';
  return errandText(t, e.items.length);
}

/** Поручения жителей: ячейка «Повтор» нижнего меню ведёт сюда. */
export function ErrandsScreen() {
  const active = useErrands((s) => s.active);
  const cards = useProgress((s) => s.cards);
  useEffect(() => {
    useErrands.getState().refresh();
  }, []);
  const due = useMemo(() => splitCards(dueCards(Object.values(cards), Date.now())), [cards]);
  const dueTotal = due.words.length + due.rules.length + due.phrases.length;

  return (
    <Screen>
      <TopBar title="Поручения" back={false} />
      <div className="flex flex-col gap-3 px-4 pb-6">
        <p className="text-sm text-stone-500">Жители просят помочь им вспомнить слова. Поручения не сгорают: невыполненные дождутся завтра.</p>
        {active.map((e) => {
          const npc = npcFor(e.location);
          const place = LOCATION_BY_ID[e.location as LocationId];
          const reward = errandReward(e);
          return (
            <Link
              key={e.id}
              to={`/errand/${encodeURIComponent(e.id)}`}
              className="press flex gap-3 rounded-2xl bg-white p-3 shadow-sm"
              data-testid="errand-card"
            >
              {npc && <NpcPortrait look={npc.look} size={72} />}
              <div className="min-w-0 flex-1">
                <div className="text-sm text-stone-500">
                  <span className="font-bold text-stone-800">{npc?.name}</span> · {place ? `${place.emoji} ${place.ru}` : '📜 свиток земли'}
                  {e.kind === 'echo' && (
                    <span className="ml-1 rounded bg-violet-100 px-1.5 py-0.5 text-xs font-semibold text-violet-800" data-testid="echo-tag">
                      🔁 Эхо
                    </span>
                  )}
                </div>
                <p className="mt-1 leading-snug" data-testid="errand-text">
                  {errandRequest(e)}
                </p>
                <div className="mt-1 text-xs text-stone-500 tabular-nums">
                  {e.items.length} {plural(e.items.length, ['задание', 'задания', 'заданий'])} · награда 🪙 {reward.coins} и репутация
                </div>
              </div>
            </Link>
          );
        })}
        {!active.length && (
          <div className="rounded-2xl bg-white p-4 text-center shadow-sm" data-testid="errands-empty">
            <div className="text-4xl">📭</div>
            <div className="mt-1 font-semibold">На сегодня поручений нет</div>
            <p className="text-sm text-stone-500">Новые появятся завтра. Выучите слова в городе — жителям будет о чём просить.</p>
          </div>
        )}
        <Link to="/review" className="press flex items-center justify-between rounded-2xl border-2 border-dashed border-stone-300 px-4 py-3">
          <span className="font-semibold">Повторить всё, что пора</span>
          <span className="text-sm text-stone-500 tabular-nums">{dueTotal}</span>
        </Link>
      </div>
    </Screen>
  );
}

/** Прохождение поручения: его карточки, как в повторении, в конце — спасибо жителя и награда. */
export function ErrandScreen() {
  const id = decodeURIComponent(useParams().id ?? '');
  const nav = useNavigate();
  // Поручение фиксируется при входе: после выполнения оно пропадает из списка, а итог должен остаться.
  const [snapshot] = useState(() => useErrands.getState().active.find((e) => e.id === id));
  if (!snapshot) {
    return (
      <Screen>
        <TopBar title="Поручение" />
        <p className="px-5 py-6 text-stone-600">Это поручение уже выполнено.</p>
        <div className="px-5">
          <Button className="w-full" onClick={() => nav('/errands', { replace: true })}>
            К поручениям
          </Button>
        </div>
      </Screen>
    );
  }
  const npc = npcFor(snapshot.location);
  return (
    <ReviewRun
      title="Поручение выполнено"
      typeExpressions
      pick={() =>
        snapshot.kind === 'echo'
          ? { words: [], rules: [], echo: snapshot.items }
          : { words: snapshot.items.filter(isWordId), rules: snapshot.items.filter(isRuleId), phrases: snapshot.items.filter(isPhraseId) }
      }
      onComplete={() => {
        const reward = useErrands.getState().complete(snapshot.id);
        if (npc) speakAs(L.thanks.es, npc);
        return (
          <div className="mt-4 flex items-end gap-3 rounded-2xl bg-white p-3 shadow-sm" data-testid="errand-thanks">
            {npc && <NpcPortrait look={npc.look} size={72} />}
            <div className="flex-1 pb-1">
              <div className="text-sm text-stone-500">{npc?.name}</div>
              <div className="font-semibold">{L.thanks.es}</div>
              <div className="text-sm text-stone-500">{L.thanks.ru}</div>
              {reward && (
                <div className="mt-1 text-sm font-semibold text-amber-700">
                  +{reward.coins} 🪙 · репутация +{reward.rep}
                </div>
              )}
              {reward?.rankUp && (
                <div className="mt-1 text-sm font-semibold text-ok" data-testid="rank-up">
                  Отношения стали ближе: {reward.rankUp.ru}
                  {reward.rankUp.discount > 0 ? `, скидка ${Math.round(reward.rankUp.discount * 100)}% на улучшение здания` : ''}
                </div>
              )}
            </div>
          </div>
        );
      }}
    />
  );
}
