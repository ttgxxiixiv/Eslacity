import { loudest, type SfxKind } from '../domain/chiptune';
import { heroLevel } from '../domain/heroLevel';
import { useCity } from '../store/city';
import { useJourney } from '../store/journey';
import { useProgress } from '../store/progress';
import { playSfx } from './sfx';

/**
 * Звуки наград (задача 13.3): монеты, обрывок карты, печать, новый уровень. Слушают хранилища, а не экраны, поэтому
 * звучат, откуда бы награда ни пришла. Награды одного мгновения (конец урока) сливаются в один звук — самый важный.
 * Вызывать после загрузки: начальные значения звука не дают.
 */
export function watchSoundCues(): () => void {
  let pending: SfxKind[] = [];
  let flush: ReturnType<typeof setTimeout> | null = null;
  const cue = (kind: SfxKind) => {
    pending.push(kind);
    flush ??= setTimeout(() => {
      const k = loudest(pending);
      pending = [];
      flush = null;
      if (k) playSfx(k);
    }, 60);
  };
  const offs = [
    useCity.subscribe((s, prev) => s.coins > prev.coins && cue('coins')),
    useJourney.subscribe((s, prev) => {
      if (Object.keys(s.seals).length > Object.keys(prev.seals).length) cue('seal');
      else if (Object.keys(s.fragments).length > Object.keys(prev.fragments).length) cue('shard');
    }),
    useProgress.subscribe((s, prev) => heroLevel(s.xpTotal).level > heroLevel(prev.xpTotal).level && cue('level')),
  ];
  return () => offs.forEach((off) => off());
}
