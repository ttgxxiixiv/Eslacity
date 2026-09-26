import type { Chronicler } from '../content/schema';
import type { ReactNode } from 'react';
import { speak } from '../audio/tts';
import { greetingFor, nextRank, rankOf } from '../domain/reputation';
import { plural } from '../domain/medals';
import { useSettings } from '../store/settings';
import { NpcPortrait } from './NpcPortrait';

/**
 * Житель в шапке места: портрет, имя, отношения с героем, приветствие на языке курса его голосом.
 * Им же показан Летописец на карте странствий (у него нет здания, скидки нет).
 */
export function NpcCard({ npc, rep = 0, children }: { npc: Chronicler; rep?: number; children?: ReactNode }) {
  const greeting = greetingFor(npc.greeting, npc.warm, rep);
  const rank = rankOf(rep);
  const next = nextRank(rep);
  const say = () => speak(greeting.es, useSettings.getState().speechRate * npc.voice.rate, npc.voice.pitch);
  return (
    <section className="rounded-3xl bg-white p-3 shadow-sm" data-testid="npc-card">
      <div className="flex items-end gap-3">
        <NpcPortrait look={npc.look} size={90} label={`${npc.name}, ${npc.role}`} />
        <div className="min-w-0 flex-1 pb-1">
          <div className="text-sm text-stone-500">
            <span className="font-bold text-stone-800">{npc.name}</span> · {npc.role}
          </div>
          <button
            type="button"
            onClick={say}
            className="press relative mt-1 w-full rounded-2xl rounded-bl-none border-2 border-stone-300 bg-stone-50 px-3 py-2 text-left"
            aria-label={`Послушать: ${greeting.es}`}
          >
            <span className="block font-semibold" data-testid="npc-greeting">
              {greeting.es} <span aria-hidden>🔊</span>
            </span>
            <span className="block text-sm text-stone-500">{greeting.ru}</span>
          </button>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2 text-sm" data-testid="npc-rank">
        <span className="font-semibold text-amber-700">{rank.ru}</span>
        {next ? (
          <>
            <div
              className="h-2.5 flex-1 overflow-hidden rounded-sm bg-wood p-[2px]"
              role="progressbar"
              aria-label={`Отношения с ${npc.name} до ступени «${next.rank.ru}»`}
              aria-valuemin={0}
              aria-valuemax={next.rank.at}
              aria-valuenow={rep}
            >
              <div className="h-full origin-left rounded-sm bg-gold" style={{ width: `${(rep / next.rank.at) * 100}%` }} />
            </div>
            <span className="text-xs text-stone-500 tabular-nums">
              ещё {next.left} {plural(next.left, ['поручение', 'поручения', 'поручений'])}
            </span>
          </>
        ) : (
          <span className="text-xs text-stone-500">ближе некуда</span>
        )}
      </div>
      {rank.discount > 0 && 'location' in npc && <p className="mt-1 text-xs text-stone-500">Скидка на улучшение здания: {Math.round(rank.discount * 100)}%</p>}
      {children}
    </section>
  );
}
