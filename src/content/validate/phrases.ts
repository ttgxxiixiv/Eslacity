import { normalize } from '../../domain/answer';
import { PLACE_LEVEL_MAX } from '../vocabPlan';
import { REGISTERS } from '../../domain/expression';
import { expandOptional, fullPhrase, optionalError, PHRASE_MAX_WORDS, PHRASE_PREFIX, phraseWords } from '../../domain/phrase';
import { LOCATION_IDS, type LocationPhrases } from '../schema';
import { type Issue, empty } from './common';

/** Фразы мест: слова фразы из словаря мест того же уровня или ниже. */

export interface PhraseChecks {
  /** Места кроме мест города: праздники (`fest-<id>`). */
  places?: readonly string[];
  /** id уроков грамматики языка: поле grammar должно ссылаться на существующий урок. */
  lessons?: ReadonlySet<string>;
  /** Слова фразы, которых нет в словаре мест того же или более низкого уровня и в грамматике. */
  uncovered?: (text: string, level: number) => string[];
}

/**
 * Фразы мест: `phrases/<место>.json`. id `ph:<место>.<slug>` уникален, форма фразы (с любым набором необязательных
 * слов) не повторяется в курсе, не длиннее 12 слов, скобки размечены верно, уровень 1–7, урок грамматики существует.
 * Слова, не покрытые словарём, — предупреждение: фразу можно сказать, только зная её слова.
 */
export function validatePhrases(files: { name: string; data: LocationPhrases }[], checks: PhraseChecks = {}): Issue[] {
  const out: Issue[] = [];
  const ids = new Set<string>();
  const forms = new Map<string, string>();
  for (const { name, data } of files) {
    if (!LOCATION_IDS.includes(data.location) && !checks.places?.includes(data.location)) out.push({ level: 'error', where: name, msg: `неизвестное место "${data.location}"` });
    if (`${data.location}.json` !== name) out.push({ level: 'error', where: name, msg: `имя файла не совпадает с location "${data.location}"` });
    if (!Array.isArray(data.phrases) || !data.phrases.length) {
      out.push({ level: 'error', where: name, msg: 'нет фраз' });
      continue;
    }
    const prefix = `${PHRASE_PREFIX}${data.location}.`;
    const ruSeen = new Map<string, string>();
    data.phrases.forEach((p, i) => {
      const at = `phrases/${name}#${i} ${p.id ?? '?'}`;
      for (const f of ['id', 'es', 'ru'] as const) if (empty(p[f])) out.push({ level: 'error', where: at, msg: `пустое поле ${f}` });
      if (!Number.isInteger(p.level) || !(p.level in PLACE_LEVEL_MAX)) out.push({ level: 'error', where: at, msg: `уровень ${p.level}` });
      if (p.register !== undefined && !REGISTERS.includes(p.register)) out.push({ level: 'error', where: at, msg: `регистр "${p.register}"` });
      if (p.note !== undefined && empty(p.note)) out.push({ level: 'error', where: at, msg: 'пустое пояснение note' });
      if (p.grammar !== undefined && checks.lessons && !checks.lessons.has(p.grammar)) {
        out.push({ level: 'error', where: at, msg: `нет урока грамматики "${p.grammar}"` });
      }
      if (empty(p.id) || empty(p.es)) return;
      if (!p.id.startsWith(prefix)) out.push({ level: 'error', where: at, msg: `id должен начинаться с "${prefix}"` });
      if (ids.has(p.id)) out.push({ level: 'error', where: at, msg: 'дубль id' });
      ids.add(p.id);

      for (const [text, what] of [[p.es, 'es'], ...(p.alt ?? []).map((a) => [a, 'alt'] as const)] as const) {
        if (empty(text)) {
          out.push({ level: 'error', where: at, msg: `пустой ${what}` });
          continue;
        }
        if (text !== text.trim() || /\s{2,}/.test(text)) out.push({ level: 'error', where: at, msg: `лишние пробелы в ${what}` });
        const bad = optionalError(text);
        if (bad) {
          out.push({ level: 'error', where: at, msg: `${what}: ${bad}` });
          continue;
        }
        const n = phraseWords(text);
        if (n > PHRASE_MAX_WORDS) out.push({ level: 'error', where: at, msg: `${what}: ${n} слов, не больше ${PHRASE_MAX_WORDS}` });
        // Любой вариант фразы узнаётся ответом: одинаковые варианты у двух фраз путают проверку.
        for (const v of expandOptional(text)) {
          const key = normalize(v);
          const other = forms.get(key);
          if (other && other !== p.id) out.push({ level: 'error', where: at, msg: `вариант «${v}» уже есть у ${other}` });
          else forms.set(key, p.id);
        }
        const miss = checks.uncovered?.(fullPhrase(text), p.level) ?? [];
        if (miss.length) out.push({ level: 'warning', where: at, msg: `${what}: нет в словаре уровня ${p.level} и ниже: ${miss.join(', ')}` });
      }
      if (!empty(p.ru)) {
        const rk = `${p.level}:${p.ru.trim().toLowerCase()}`;
        if (ruSeen.has(rk)) out.push({ level: 'warning', where: at, msg: `тот же перевод «${p.ru}», что у ${ruSeen.get(rk)}` });
        else ruSeen.set(rk, p.id);
      }
    });
  }
  return out;
}
