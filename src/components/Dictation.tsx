import { useEffect, useRef, useState } from 'react';
import { listeningEnabled, speakAs } from '../audio/tts';
import { npcFor } from '../content/npcs';
import { loadScenes } from '../content/scenes';
import { logAnswer } from '../db/answers';
import { EXAM_KEYS } from '../domain/answer';
import { answerMs } from '../domain/answerLog';
import { checkDictation, dictationId, dictationLines, pickDictation, SLOW_RATE, type DictationLine, type DictationResult } from '../domain/dictation';
import { hash } from '../domain/errands';
import { LANG } from '../lang';
import { useDiary } from '../store/diary';
import { addressed } from '../store/settings';
import { AccentBar } from './AccentBar';
import { NpcPortrait } from './NpcPortrait';
import { Button, Loading } from './ui';

const VERDICT_TEXT = { correct: 'Верно, слово в слово.', almost: 'Почти.', wrong: 'Не совсем.' } as const;

/** Итог диктанта: вердикт и что не так — слова или только ударения и буквы. */
function verdictText(r: DictationResult): string {
  if (r.verdict === 'correct') return VERDICT_TEXT.correct;
  const missed = r.words.some((w) => !w.ok);
  return `${VERDICT_TEXT[r.verdict]} ${missed ? 'Пропущенные и неверные слова подчёркнуты.' : 'Проверьте ударения и буквы.'}`;
}

/**
 * Диктант в начале поручения (задача 21.5): житель говорит реплику из дослушанного разговора, герой записывает её.
 * `seed` выбирает реплику (одна и та же весь день). Без звука или без подходящих реплик сразу `onDone`.
 */
export function Dictation({ location, seed, onDone }: { location: string; seed: string; onDone(): void }) {
  const [item, setItem] = useState<DictationLine | null | undefined>(undefined);
  const npc = npcFor(location);

  useEffect(() => {
    let alive = true;
    if (!listeningEnabled() || !npc) {
      setItem(null);
      return;
    }
    loadScenes(location).then((scenes) => {
      if (alive) setItem(pickDictation(dictationLines(scenes, new Set(useDiary.getState().rec.scenes)), hash(seed)) ?? null);
    });
    return () => {
      alive = false;
    };
  }, [location, seed, npc]);
  useEffect(() => {
    if (item === null) onDone();
  }, [item, onDone]);

  if (!item || !npc) return <Loading />;
  return <DictationTask item={item} npc={npc} onDone={onDone} />;
}

function DictationTask({ item, npc, onDone }: { item: DictationLine; npc: NonNullable<ReturnType<typeof npcFor>>; onDone(): void }) {
  const text = addressed(item.line.es);
  const [value, setValue] = useState('');
  const [result, setResult] = useState<DictationResult | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const shownAt = useRef(Date.now());
  const say = (pace = 1) => speakAs(text, npc, pace);

  useEffect(() => {
    speakAs(text, npc);
  }, [text, npc]);

  const insert = (ch: string) => {
    const el = input.current;
    if (!el) return;
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    setValue(value.slice(0, start) + ch + value.slice(end));
    requestAnimationFrame(() => el.setSelectionRange(start + ch.length, start + ch.length));
  };
  const backspace = () => {
    const el = input.current;
    if (!el) return;
    const end = el.selectionEnd ?? value.length;
    const start = el.selectionStart ?? value.length;
    const from = start === end ? Math.max(0, start - 1) : start;
    setValue(value.slice(0, from) + value.slice(end));
    requestAnimationFrame(() => el.setSelectionRange(from, from));
  };
  const check = () => {
    if (result || !value.trim()) return;
    const r = checkDictation(value, text);
    setResult(r);
    const now = Date.now();
    logAnswer({ itemId: dictationId(item), kind: 'listen-dictation', verdict: r.verdict, mode: 'dictation', ms: answerMs(shownAt.current, now) }, now);
  };

  return (
    <div className="flex min-h-dvh flex-col gap-4 px-4 py-6" data-testid="dictation">
      <div className="flex items-end gap-3">
        <NpcPortrait look={npc.look} size={72} />
        <div className="flex-1 rounded-2xl rounded-bl-none border-2 border-stone-300 bg-white px-3 py-2">
          <div className="text-xs text-stone-500">{npc.name} · ✍️ Диктант</div>
          <div className="leading-snug">Запиши, что я сказал{npc.gender === 'f' ? 'а' : ''}, слово в слово. Можно послушать ещё раз.</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={() => say()} data-testid="dictation-again">
          🔊 Ещё раз
        </Button>
        <Button variant="secondary" onClick={() => say(SLOW_RATE)} data-testid="dictation-slow">
          Медленнее
        </Button>
      </div>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          check();
        }}
      >
        <AccentBar keys={EXAM_KEYS[LANG]} onKey={insert} onBackspace={backspace} disabled={!!result} />
        <input
          ref={input}
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          readOnly={!!result}
          lang={LANG}
          autoCapitalize="sentences"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="done"
          className={`h-14 rounded-2xl border-2 bg-white px-4 text-xl outline-none focus:border-brand ${result ? (result.verdict === 'correct' ? 'border-ok' : result.verdict === 'almost' ? 'border-almost' : 'border-bad') : 'border-stone-300'}`}
          placeholder="Реплика целиком"
          data-testid="dictation-input"
        />
        {!result && (
          <Button type="submit" disabled={!value.trim()} data-testid="dictation-check">
            Проверить
          </Button>
        )}
      </form>
      {result && (
        <div className="flex flex-col gap-2 rounded-2xl bg-white p-3 shadow-sm" data-testid="dictation-result" data-verdict={result.verdict}>
          <div className={`font-semibold ${result.verdict === 'correct' ? 'text-ok' : result.verdict === 'almost' ? 'text-almost' : 'text-bad'}`}>{verdictText(result)}</div>
          <div className="text-lg leading-snug">
            {result.words.map((w, i) => (
              <span key={i}>
                {i > 0 && ' '}
                <span data-testid="dictation-word" data-ok={w.ok} className={w.ok ? '' : 'rounded bg-orange-50 font-semibold text-bad underline decoration-2 underline-offset-4'}>
                  {w.text}
                </span>
              </span>
            ))}
          </div>
          <div className="text-sm text-stone-600">{addressed(item.line.ru, 'ru')}</div>
          <Button className="mt-1 w-full" onClick={onDone} data-testid="dictation-next">
            Дальше
          </Button>
        </div>
      )}
    </div>
  );
}
