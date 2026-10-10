import { WordTags } from '../components/WordTags';
import { isExpression } from '../domain/expression';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { LOCATION_BY_ID } from '../content/locations';
import { loadLocation } from '../content';
import type { Letter, LocationId, Mission, Note, Phrase, Scene, Word } from '../content/schema';
import { loadLetters, loadNotes } from '../content/letters';
import { useLetters } from '../store/letters';
import { loadPhrases } from '../content/phrases';
import { loadScenes } from '../content/scenes';
import { loadMissions } from '../content/missions';
import { useMissions } from '../store/missions';
import { useTrials } from '../store/trials';
import { trialId, trialStatus, waitLabel } from '../domain/trial';
import { missionOpen } from '../domain/reputation';
import { modeForAttempt } from '../domain/mission';
import { fullPhrase } from '../domain/phrase';
import { ECONOMY } from '../config';
import { incomeRate, isFull, pendingIncome, upgradeCost } from '../domain/economy';
import { useNow } from '../lib/useNow';
import { isLearned, isWordLevelOpen, learnedCount, lessonParts, levelWords, MAX_BUILDING_LEVEL, maxContentLevel } from '../domain/levels';
import { CHAPTERS, chapterById, chapterOfLevel, isLevelOpen } from '../domain/chapters';
import { useJourney } from '../store/journey';
import { NPC_BY_LOCATION, speakerOf } from '../content/npcs';
import { NpcCard } from '../components/NpcCard';
import { useErrands } from '../store/errands';
import { discountedCost } from '../domain/reputation';
import { plural } from '../domain/medals';
import { dayNumber } from '../domain/srs';
import { useCity } from '../store/city';
import { useProgress } from '../store/progress';
import { useMotivation } from '../store/motivation';
import { Button, SpeakButton, TopBar, Screen } from '../components/ui';

/** Как герой будет отвечать в следующем прохождении миссии. */
const MODE_WORD = { choose: 'выбор', tiles: 'сборка', type: 'ввод' } as const;

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

/** Кто разговаривает в шёпоте: житель места и его собеседник. */
function whisperPair(sc: Scene, place: LocationId): string {
  const other = sc.lines.find((l) => l.who !== 'npc')?.who ?? 'npc';
  return [speakerOf('npc', place), speakerOf(other, place)].map((n) => n?.name).join(' и ');
}

export function LocationScreen() {
  const id = useParams().id as LocationId;
  const meta = LOCATION_BY_ID[id];
  const [words, setWords] = useState<Word[] | null>(null);
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [letter, setLetter] = useState<Letter | undefined>(undefined);
  const [note, setNote] = useState<Note | undefined>(undefined);
  const letterEntries = useLetters((s) => s.entries);
  const missionRecords = useMissions((s) => s.records);
  const trialRecords = useTrials((s) => s.records);
  const cards = useProgress((s) => s.cards);
  const level = useCity((s) => s.buildings[id]?.level ?? 0);
  const coins = useCity((s) => s.coins);
  const upgrade = useCity((s) => s.upgrade);
  const building = useCity((s) => s.buildings[id]);
  const opened = useJourney((s) => s.opened);
  const npc = NPC_BY_LOCATION[id];
  const rep = useErrands((s) => (npc ? (s.rep[npc.id] ?? 0) : 0));
  const now = useNow();
  // При улучшении накопленный доход здания собирается автоматически, поэтому он тоже в счёт.
  const available = coins + (building ? pendingIncome(building, now) : 0);

  useEffect(() => {
    loadLocation(id).then(setWords);
    loadPhrases(id).then(setPhrases);
    loadScenes(id).then(setScenes);
    loadMissions(id).then(setMissions);
    loadLetters().then((list) => setLetter(list.find((l) => l.location === id)));
    loadNotes().then((list) => setNote(list.find((l) => l.location === id)));
  }, [id]);

  if (!meta) return <div className="p-6">Нет такой локации</div>;

  const maxLevel = words ? maxContentLevel(words) : 0;
  // Пять уровней здания и уровни слов выше, если они есть в месте (6 — глава IV).
  const levels = Array.from({ length: Math.max(MAX_BUILDING_LEVEL, maxLevel) }, (_, i) => i + 1);

  return (
    <Screen>
      <TopBar title={`${meta.emoji} ${meta.ru}`} right={<span className="pr-3 font-semibold">🪙 {coins}</span>} />
      {!words ? null : (
        <div className="flex flex-col gap-4 px-5 pb-6">
          {npc && <NpcCard npc={npc} rep={rep} />}
          {npc && level > 0 &&
            scenes
              .filter((sc) => sc.chapter <= opened && sc.mode !== 'overhear')
              .map((sc) => (
                <Link
                  key={sc.id}
                  to={`/scene/${encodeURIComponent(sc.id)}`}
                  data-testid="scene-link"
                  className="press flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm"
                >
                  <span className="font-semibold">💬 Разговор: {npc.name}</span>
                  <span className="text-sm text-stone-500">глава {chapterById(sc.chapter)?.roman} →</span>
                </Link>
              ))}
          {npc && level > 0 &&
            scenes
              .filter((sc) => sc.chapter <= opened && sc.mode === 'overhear')
              .map((sc) => (
                <Link
                  key={sc.id}
                  to={`/scene/${encodeURIComponent(sc.id)}`}
                  data-testid="whisper-link"
                  className="press flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm"
                >
                  <span className="shrink-0 font-semibold">🌲 Шёпот</span>
                  <span className="text-right text-sm text-stone-500">
                    {whisperPair(sc, id)} · глава {chapterById(sc.chapter)?.roman} →
                  </span>
                </Link>
              ))}
          {npc && level > 0 &&
            missions
              .filter((m) => m.chapter <= opened)
              .map((m) => {
                const rec = missionRecords[m.id];
                const open = missionOpen(rep, m.chapter);
                const state = rec?.done ? '✓ выполнена' : open ? (rec?.attempts ? `ответы: ${MODE_WORD[modeForAttempt(rec.attempts + 1)]}` : 'новая') : 'нужны отношения «Приятель»';
                // У места по миссии на главу: глава в подписи, как у разговоров.
                const status = `глава ${chapterById(m.chapter)?.roman} · ${state}`;
                const cls = 'flex items-center justify-between gap-3 rounded-2xl px-4 py-3 shadow-sm';
                return open ? (
                  <Link key={m.id} to={`/mission/${encodeURIComponent(m.id)}`} data-testid="mission-link" className={`press ${cls} ${rec?.done ? 'bg-okbg' : 'bg-orange-50'}`}>
                    <span className="shrink-0 font-semibold">⭐ Миссия: {npc.name}</span>
                    <span className="text-right text-sm text-stone-500">{status} →</span>
                  </Link>
                ) : (
                  <div key={m.id} data-testid="mission-link" className={`${cls} border-2 border-dashed border-stone-300`}>
                    <span className="shrink-0 font-semibold text-stone-500">⭐ Миссия: {npc.name}</span>
                    <span className="text-right text-sm text-stone-500">{status}</span>
                  </div>
                );
              })}
          {npc && level > 0 && note && note.chapter <= opened && (() => {
            const sent = letterEntries.filter((e) => e.letterId === note.id);
            const full = sent.some((e) => e.checks.length === note.must.length);
            return (
              <Link
                to={`/note/${encodeURIComponent(note.id)}`}
                data-testid="note-link"
                className={`press flex items-center justify-between gap-3 rounded-2xl px-4 py-3 shadow-sm ${full ? 'bg-okbg' : 'bg-orange-50'}`}
              >
                <span className="shrink-0 font-semibold">📝 Записка</span>
                <span className="text-right text-sm text-stone-500">
                  {note.title} · {full ? '✓ в дневнике' : sent.length ? 'можно лучше' : 'новое'} →
                </span>
              </Link>
            );
          })()}
          {npc && level > 0 && letter && letter.chapter <= opened && (() => {
            const written = letterEntries.filter((e) => e.letterId === letter.id).length;
            return (
              <Link
                to={`/letter/${encodeURIComponent(letter.id)}`}
                data-testid="letter-link"
                className={`press flex items-center justify-between gap-3 rounded-2xl px-4 py-3 shadow-sm ${written ? 'bg-okbg' : 'bg-orange-50'}`}
              >
                <span className="shrink-0 font-semibold">✉️ Письмо</span>
                <span className="text-right text-sm text-stone-500">
                  {letter.title} · {written ? `✓ в дневнике${written > 1 ? ` (${written})` : ''}` : 'новое'} →
                </span>
              </Link>
            );
          })()}
          {level > 0 &&
            CHAPTERS.filter((ch) => ch.id <= opened).map((ch) => {
              const cw = words.filter((w) => ch.levels.includes(w.level));
              if (!cw.length) return null;
              const tid = trialId(id, ch.id);
              const st = trialStatus(trialRecords[tid], cw.filter((w) => !(w.id in cards)).length, now);
              const state =
                st.kind === 'done' ? '✓ пройдено'
                  : st.kind === 'open' ? 'можно проходить'
                    : st.kind === 'wait' ? `снова ${waitLabel(st.until, now)}`
                      : `осталось ${st.wordsLeft} ${plural(st.wordsLeft, ['слово', 'слова', 'слов'])}`;
              const tone = st.kind === 'done' ? 'bg-okbg' : st.kind === 'open' ? 'bg-orange-50' : 'border-2 border-dashed border-stone-300';
              return (
                <Link
                  key={tid}
                  to={`/trial/${encodeURIComponent(tid)}`}
                  data-testid="trial-link"
                  className={`press flex items-center justify-between gap-3 rounded-2xl px-4 py-3 shadow-sm ${tone}`}
                >
                  <span className={`shrink-0 font-semibold ${st.kind === 'locked' ? 'text-stone-500' : ''}`}>🏆 Испытание</span>
                  <span className="text-right text-sm text-stone-500">глава {ch.roman} · {state} →</span>
                </Link>
              );
            })}
          <IncomeCard id={id} level={level} />
          {levels.map((lvl) => {
            const lw = levelWords(words, lvl);
            const chapterOpen = isLevelOpen(lvl, opened);
            const open = isWordLevelOpen(lvl, level, words, cards) && chapterOpen;
            const prevDone = lvl === 1 || isLearned(levelWords(words, lvl - 1), cards);
            // Улучшить можно только до 5-го уровня, выше уровни слов открываются без покупки.
            const isNext = lvl === level + 1 && lvl <= MAX_BUILDING_LEVEL;
            const fullCost = isNext ? (lvl === 1 ? meta.unlockCost : upgradeCost(meta, lvl)) : 0;
            const cost = isNext && lvl > 1 ? discountedCost(fullCost, rep) : fullCost;

            if (!open) {
              return (
                <section key={lvl} className="rounded-3xl border-2 border-dashed border-stone-300 p-4">
                  <div className="flex items-center justify-between">
                    <h2 className="font-bold text-stone-500">Уровень {lvl}</h2>
                    {lvl > maxLevel && <span className="text-sm text-stone-500">скоро</span>}
                  </div>
                  {lvl <= maxLevel && !chapterOpen && (
                    <p className="mt-1 text-sm text-stone-500" data-testid="chapter-lock">
                      Откроется в главе {chapterOfLevel(lvl)?.roman}: сначала соберите карту главы {chapterById((chapterOfLevel(lvl)?.id ?? 2) - 1)?.roman}.
                    </p>
                  )}
                  {lvl > MAX_BUILDING_LEVEL && chapterOpen && (
                    <p className="mt-1 text-sm text-stone-500" data-testid="level-wait">
                      {level < MAX_BUILDING_LEVEL
                        ? `Откроется, когда здание будет ${MAX_BUILDING_LEVEL}-го уровня и выучен уровень ${lvl - 1}.`
                        : `Откроется, когда выучены все слова уровня ${lvl - 1}.`}
                    </p>
                  )}
                  {isNext && lvl <= maxLevel && chapterOpen && (
                    <>
                      {!prevDone && (
                        <p className="mt-1 text-sm text-stone-500">Сначала пройдите все уроки уровня {lvl - 1}.</p>
                      )}
                      <Button
                        className="mt-3 w-full"
                        disabled={!prevDone || available < cost}
                        onClick={() => upgrade(id, Date.now(), rep) && useMotivation.getState().evaluate()}
                      >
                        {lvl === 1 ? 'Открыть' : 'Улучшить'} за 🪙 {cost}
                      </Button>
                      {cost < fullCost && (
                        <p className="mt-1 text-center text-sm text-amber-700" data-testid="rep-discount">
                          Скидка от {npc?.name}: вместо {fullCost} — {cost}
                        </p>
                      )}
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
            const fresh = lw.filter((w) => !(w.id in cards)).length;
            return (
              <section key={lvl} className="rounded-3xl bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold">Уровень {lvl}</h2>
                  <span className="text-sm text-stone-500">
                    {learnedCount(lw, cards)}/{lw.length} {lw.some(isExpression) ? 'слов и выражений' : 'слов'}
                  </span>
                </div>
                {fresh > 0 && npc && (
                  <p className="mt-1 text-sm text-amber-700" data-testid="learn-request">
                    {npc.name} просит выучить {fresh} {plural(fresh, ['новое слово', 'новых слова', 'новых слов'])}
                  </p>
                )}
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
                <PhraseBlock place={id} level={lvl} phrases={phrases.filter((p) => p.level === lvl)} wordsDone={done} npcName={npc?.name} cards={cards} />
                <ul className="mt-3 divide-y divide-stone-100">
                  {lw.map((w) => (
                    <li key={w.id} className="flex items-center gap-3 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold">
                          {w.es}
                          <WordTags word={w} className="ml-2 align-middle" />
                        </div>
                        <div className="truncate text-sm text-stone-500">{w.ru}</div>
                      </div>
                      {cards[w.id] && (
                        <span className="text-xs text-stone-500">{dueLabel(cards[w.id].due)}</span>
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

/** Фразы уровня: житель учит, как здесь говорят. Открываются, когда выучены слова уровня. */
function PhraseBlock({ place, level, phrases, wordsDone, npcName, cards }: {
  place: LocationId;
  level: number;
  phrases: Phrase[];
  wordsDone: boolean;
  npcName?: string;
  cards: Record<string, { due: number }>;
}) {
  if (!phrases.length) return null;
  const learned = phrases.filter((p) => p.id in cards).length;
  const fresh = phrases.length - learned;
  return (
    <div className="mt-3 rounded-2xl bg-orange-50 p-3" data-testid="phrase-block">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">💬 Как здесь говорят</h3>
        <span className="text-sm text-stone-500 tabular-nums">
          {learned}/{phrases.length} фраз
        </span>
      </div>
      {!wordsDone ? (
        <p className="mt-1 text-sm text-stone-500">Фразы откроются, когда выучены слова уровня.</p>
      ) : (
        <>
          <Link
            to={`/phrases/${place}/${level}`}
            data-testid="phrase-lesson"
            className={`press mt-2 block rounded-2xl px-3 py-3 text-center font-semibold ${fresh ? 'bg-brand text-white' : 'border border-stone-300'}`}
          >
            {fresh ? `${npcName ? `${npcName} учит` : 'Выучить'}: ${fresh} ${plural(fresh, ['фраза', 'фразы', 'фраз'])}` : 'Повторить фразы уровня'}
          </Link>
          {learned > 0 && (
            <ul className="mt-2 divide-y divide-orange-100">
              {phrases.filter((p) => p.id in cards).map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{p.es}</div>
                    <div className="text-sm text-stone-500">{p.ru}</div>
                  </div>
                  <span className="text-xs text-stone-500">{dueLabel(cards[p.id].due)}</span>
                  <SpeakButton text={fullPhrase(p.es)} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
