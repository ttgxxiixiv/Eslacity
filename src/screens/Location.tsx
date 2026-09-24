import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { LOCATION_BY_ID } from '../content/locations';
import { loadLocation } from '../content';
import type { LocationId, Word } from '../content/schema';
import { ECONOMY } from '../config';
import { incomeRate, isFull, pendingIncome, upgradeCost } from '../domain/economy';
import { useNow } from '../lib/useNow';
import { isLearned, learnedCount, lessonParts, levelWords, maxContentLevel } from '../domain/levels';
import { dayNumber } from '../domain/srs';
import { useCity } from '../store/city';
import { useProgress } from '../store/progress';
import { useMotivation } from '../store/motivation';
import { Button, SpeakButton, TopBar, Screen } from '../components/ui';

function dueLabel(due: number) {
  const d = due - dayNumber(Date.now());
  if (d <= 0) return 'повторить сегодня';
  if (d === 1) return 'завтра';
  return `через ${d} дн.`;
}

function IncomeCard({ id, level }: { id: LocationId; level: number }) {
  const now = useNow();
  const b = useCity((s) => s.buildings[id]);
  const collect = useCity((s) => s.collect);
  if (!b || !level) {
    return (
      <p className="rounded-2xl bg-orange-50 px-4 py-3 text-sm text-stone-600">
        Открытое здание приносит {incomeRate(1)} 🪙 в час, копится до {ECONOMY.incomeCapHours} часов.
      </p>
    );
  }
  const pending = pendingIncome(b, now);
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm">
      <div className="flex-1 text-sm">
        <div className="font-semibold">Доход: {incomeRate(level)} 🪙 в час</div>
        <div className="text-stone-500">
          {isFull(b, now) ? 'Хранилище полное, соберите монеты' : `Копится до ${ECONOMY.incomeCapHours} часов`}
        </div>
      </div>
      <Button variant="secondary" className="!px-4 !py-2" disabled={!pending} onClick={() => collect(id)}>
        +{pending} 🪙
      </Button>
    </div>
  );
}

export function LocationScreen() {
  const id = useParams().id as LocationId;
  const meta = LOCATION_BY_ID[id];
  const [words, setWords] = useState<Word[] | null>(null);
  const cards = useProgress((s) => s.cards);
  const level = useCity((s) => s.buildings[id]?.level ?? 0);
  const coins = useCity((s) => s.coins);
  const upgrade = useCity((s) => s.upgrade);

  useEffect(() => {
    loadLocation(id).then(setWords);
  }, [id]);

  if (!meta) return <div className="p-6">Нет такой локации</div>;

  const maxLevel = words ? maxContentLevel(words) : 0;
  const levels = [1, 2, 3, 4, 5];

  return (
    <Screen>
      <TopBar title={`${meta.emoji} ${meta.ru}`} right={<span className="pr-3 font-semibold">🪙 {coins}</span>} />
      {!words ? null : (
        <div className="flex flex-col gap-4 px-5 pb-6">
          <IncomeCard id={id} level={level} />
          {levels.map((lvl) => {
            const lw = levelWords(words, lvl);
            const open = lvl <= level;
            const prevDone = lvl === 1 || isLearned(levelWords(words, lvl - 1), cards);
            const isNext = lvl === level + 1;
            const cost = isNext ? (lvl === 1 ? meta.unlockCost : upgradeCost(meta, lvl)) : 0;

            if (!open) {
              return (
                <section key={lvl} className="rounded-3xl border-2 border-dashed border-stone-300 p-4">
                  <div className="flex items-center justify-between">
                    <h2 className="font-bold text-stone-500">Уровень {lvl}</h2>
                    {lvl > maxLevel && <span className="text-sm text-stone-400">скоро</span>}
                  </div>
                  {isNext && lvl <= maxLevel && (
                    <>
                      {!prevDone && (
                        <p className="mt-1 text-sm text-stone-500">Сначала пройдите все уроки уровня {lvl - 1}.</p>
                      )}
                      <Button
                        className="mt-3 w-full"
                        disabled={!prevDone || coins < cost}
                        onClick={() => upgrade(id) && useMotivation.getState().evaluate()}
                      >
                        {lvl === 1 ? 'Открыть' : 'Улучшить'} за 🪙 {cost}
                      </Button>
                      {lw.length > 0 && (
                        <p className="mt-3 text-sm leading-relaxed text-stone-500">
                          {lw.length} слов: {lw.map((w) => w.es).join(', ')}
                        </p>
                      )}
                    </>
                  )}
                </section>
              );
            }

            const parts = lessonParts(lw);
            const done = isLearned(lw, cards);
            return (
              <section key={lvl} className="rounded-3xl bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold">Уровень {lvl}</h2>
                  <span className="text-sm text-stone-500">
                    {learnedCount(lw, cards)}/{lw.length} слов
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {parts.map((p, i) => {
                    const pDone = isLearned(p, cards);
                    return (
                      <Link
                        key={i}
                        to={`/learn/${id}/${lvl}/${i}`}
                        className={`press rounded-2xl px-3 py-3 text-center font-semibold ${
                          pDone ? 'bg-okbg text-ok' : 'bg-brand text-white'
                        }`}
                      >
                        {pDone ? '✓ ' : ''}Урок {i + 1}
                        <div className="text-xs font-normal opacity-80">{p.length} слов</div>
                      </Link>
                    );
                  })}
                </div>
                {done && (
                  <Link
                    to={`/practice/${id}/${lvl}`}
                    className="press mt-2 block rounded-2xl border border-stone-300 py-2.5 text-center font-medium"
                  >
                    Тренировка уровня
                  </Link>
                )}
                <ul className="mt-3 divide-y divide-stone-100">
                  {lw.map((w) => (
                    <li key={w.id} className="flex items-center gap-3 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold">{w.es}</div>
                        <div className="truncate text-sm text-stone-500">{w.ru}</div>
                      </div>
                      {cards[w.id] && (
                        <span className="text-xs text-stone-400">{dueLabel(cards[w.id].due)}</span>
                      )}
                      <SpeakButton text={w.es} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </Screen>
  );
}
