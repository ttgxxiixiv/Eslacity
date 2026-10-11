import { normalize } from '../../domain/answer';
import type { Lang } from '../../lang';
import { festivalMissionId, festivalPlace, festivalsOf } from '../../domain/festival';
import type { FestivalFile, LocationId } from '../schema';
import { type Issue, empty } from './common';
import { type MissionChecks, validateMissions } from './missions';
import { type PhraseChecks, validatePhrases } from './phrases';
import { checkWord } from './words';

/** Праздники: слова, фразы и миссия праздника. */

/** Слов праздника: не меньше и не больше (два урока слов). */
export const FESTIVAL_WORDS = { min: 10, max: 15 };

/**
 * Праздники (задача 10.5): у каждого праздника языка свой файл; слова с префиксом `fest-<id>.` уровня 1, фразы
 * и одна миссия хозяина — общими проверками фраз и миссий, где праздник — «место» `fest-<id>`.
 */
export function validateFestivals(
  files: { name: string; data: FestivalFile }[],
  lang: Lang,
  checks: { residents: Record<string, string>; phrases: PhraseChecks; missions: Omit<MissionChecks, 'residents' | 'phrases'> },
): Issue[] {
  const out: Issue[] = [];
  const byId = new Map(files.map((f) => [f.data?.id, f]));
  for (const f of festivalsOf(lang)) {
    const file = byId.get(f.id);
    const where = `festivals/${f.id}.json`;
    if (!file) {
      out.push({ level: 'error', where, msg: 'нет файла праздника' });
      continue;
    }
    if (file.name !== `${f.id}.json`) out.push({ level: 'error', where, msg: `имя файла не совпадает с id "${f.id}"` });
    const host = checks.residents[f.host];
    if (!host) out.push({ level: 'error', where, msg: `у здания хозяина "${f.host}" нет жителя` });
    const { data } = file;
    if (empty(data.intro?.es) || empty(data.intro?.ru)) out.push({ level: 'error', where, msg: 'нет приглашения хозяина (intro)' });
    if (empty(data.about)) out.push({ level: 'error', where, msg: 'нет рассказа о празднике (about)' });
    const place = festivalPlace(f.id);
    const words = data.words ?? [];
    if (words.length < FESTIVAL_WORDS.min || words.length > FESTIVAL_WORDS.max) {
      out.push({ level: 'error', where, msg: `${words.length} слов, нужно ${FESTIVAL_WORDS.min}–${FESTIVAL_WORDS.max}` });
    }
    const ids = new Set<string>();
    words.forEach((w, i) => {
      const at = `${where} слово #${i} ${w.id ?? '?'}`;
      checkWord(w, at, lang, out);
      if (!w.id?.startsWith(`${place}.`)) out.push({ level: 'error', where: at, msg: `id должен начинаться с "${place}."` });
      if (w.level !== 1) out.push({ level: 'error', where: at, msg: 'у слова праздника level всегда 1' });
      if (ids.has(w.id)) out.push({ level: 'error', where: at, msg: 'дубль id' });
      ids.add(w.id);
    });
    const tag = (list: Issue[]) => list.map((x) => ({ ...x, where: `festivals/${f.id} ${x.where}` }));
    // Имена собственные праздника (Fermín, Ferragosto) знакомы: в словаре их нет, но учить их не нужно.
    const names = new Set((data.names ?? []).map((n) => normalize(n)));
    const known = (t: string) => !names.has(normalize(t));
    const uncovered = checks.phrases.uncovered;
    const phraseChecks: PhraseChecks = { ...checks.phrases, places: [place], uncovered: uncovered && ((text, level) => uncovered(text, level).filter(known)) };
    out.push(...tag(validatePhrases([{ name: `${place}.json`, data: { location: place as LocationId, phrases: data.phrases ?? [] } }], phraseChecks)));
    const missions = data.missions ?? [];
    if (missions.length !== 1 || missions[0]?.id !== festivalMissionId(f.id)) {
      out.push({ level: 'error', where, msg: `нужна одна миссия "${festivalMissionId(f.id)}"` });
    }
    out.push(
      ...tag(
        validateMissions([{ name: `${place}.json`, data: { location: place as LocationId, missions } }], {
          ...checks.missions,
          coverage:
            checks.missions.coverage &&
            ((text, level) => {
              const c = checks.missions.coverage!(text, level);
              return { total: c.total, unknown: c.unknown.filter(known) };
            }),
          places: [place],
          residents: { [place]: host ?? '' },
          phrases: { [place]: data.phrases ?? [] },
        }),
      ),
    );
  }
  for (const f of files) {
    if (!festivalsOf(lang).some((x) => `${x.id}.json` === f.name)) out.push({ level: 'error', where: `festivals/${f.name}`, msg: 'праздника нет в FESTIVALS этого языка' });
  }
  return out;
}
