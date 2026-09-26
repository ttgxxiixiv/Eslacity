import type { Npc } from '../content/schema';
import { speak } from '../audio/tts';
import { useSettings } from '../store/settings';
import { NpcPortrait } from './NpcPortrait';

/** Житель в шапке места: портрет, имя, приветствие на языке курса его голосом. */
export function NpcCard({ npc }: { npc: Npc }) {
  const say = () => speak(npc.greeting.es, useSettings.getState().speechRate * npc.voice.rate, npc.voice.pitch);
  return (
    <section className="flex items-end gap-3 rounded-3xl bg-white p-3 shadow-sm" data-testid="npc-card">
      <NpcPortrait look={npc.look} size={90} label={`${npc.name}, ${npc.role}`} />
      <div className="min-w-0 flex-1 pb-1">
        <div className="text-sm text-stone-500">
          <span className="font-bold text-stone-800">{npc.name}</span> · {npc.role}
        </div>
        <button
          type="button"
          onClick={say}
          className="press relative mt-1 w-full rounded-2xl rounded-bl-none border-2 border-stone-300 bg-stone-50 px-3 py-2 text-left"
          aria-label={`Послушать: ${npc.greeting.es}`}
        >
          <span className="block font-semibold" data-testid="npc-greeting">
            {npc.greeting.es} <span aria-hidden>🔊</span>
          </span>
          <span className="block text-sm text-stone-500">{npc.greeting.ru}</span>
        </button>
      </div>
    </section>
  );
}
