/**
 * Произношение для озвучки (задача 15.4). У слова, примера, фразы и реплики может быть поле `say`: что произносить
 * вместо написанного («el DNI» → «el de ene i», «llame al 112» → «llame al uno uno dos»). Синтез речи читает
 * аббревиатуры и числа как получится, а так — как сказал бы житель.
 *
 * Из `say` строится словарь (`buildSayIndex`, при сборке — виртуальный модуль `virtual:say-index`): текст целиком
 * и, у слов, сама изменённая часть («DNI» → «de ene i»). Поэтому аббревиатура слова звучит верно и в любой фразе,
 * где она встречается («Aquí tiene mi DNI»).
 */

export interface SayIndex {
  /** Текст целиком → что произносить. */
  whole: Record<string, string>;
  /** Части слов: написанное → произносимое, длинные раньше. */
  tokens: [string, string][];
}

export const EMPTY_SAY: SayIndex = { whole: {}, tokens: [] };

/**
 * Изменённая часть слова: общие слова в начале и в конце снимаются («el DNI» / «el de ene i» → «DNI» / «de ene i»).
 * null — менять нечего или изменилось всё (тогда хватает текста целиком).
 */
export function sayToken(es: string, say: string): [string, string] | null {
  const a = es.split(/\s+/);
  const b = say.split(/\s+/);
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head++;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail++;
  const from = a.slice(head, a.length - tail).join(' ');
  const to = b.slice(head, b.length - tail).join(' ');
  if (!from || from === es) return null;
  return [from, to];
}

/** Записи контента с `es` и `say`: `word` — запись слова (у неё берётся и изменённая часть). */
export function buildSayIndex(records: { es: string; say: string; word: boolean }[]): SayIndex {
  const whole: Record<string, string> = {};
  const tokens = new Map<string, string>();
  for (const r of records) {
    whole[r.es] = r.say;
    const t = r.word ? sayToken(r.es, r.say) : null;
    if (t) tokens.set(t[0], t[1]);
  }
  return { whole, tokens: [...tokens].sort((x, y) => y[0].length - x[0].length) };
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Что произносить: текст целиком из словаря, иначе с заменой частей слов (только целыми словами). */
export function spokenText(text: string, index: SayIndex): string {
  const whole = index.whole[text];
  if (whole !== undefined) return whole;
  let out = text;
  for (const [from, to] of index.tokens) {
    if (!out.includes(from)) continue;
    out = out.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escape(from)}(?![\\p{L}\\p{N}])`, 'gu'), to);
  }
  return out;
}

/** Обход файла контента: объекты с `es` и `say`. Запись слова узнаётся по части речи `pos`. */
export function sayRecords(data: unknown): { es: string; say: string; word: boolean }[] {
  const out: { es: string; say: string; word: boolean }[] = [];
  const visit = (x: unknown) => {
    if (Array.isArray(x)) return x.forEach(visit);
    if (!x || typeof x !== 'object') return;
    const o = x as Record<string, unknown>;
    if (typeof o.es === 'string' && typeof o.say === 'string') out.push({ es: o.es, say: o.say, word: typeof o.pos === 'string' });
    Object.values(o).forEach(visit);
  };
  visit(data);
  return out;
}

/** Похоже на то, что синтез прочтёт не так: аббревиатура заглавными или цифры (для `npm run say`). */
export function sayCandidates(text: string): string[] {
  return [...new Set(text.match(/(?<![\p{L}\p{N}])(?:\p{Lu}{2,}|\p{L}*\p{N}+\p{L}*)(?![\p{L}\p{N}])/gu) ?? [])];
}

/**
 * Замечания к полю `say`: пустое или такое же, как текст; у записи с женской формой `fem.es` путница услышала бы
 * текст без `say`, поэтому нужен и `fem.say`.
 */
export function sayIssues(data: unknown): { where: string; msg: string }[] {
  const out: { where: string; msg: string }[] = [];
  const visit = (x: unknown, path: string) => {
    if (Array.isArray(x)) return x.forEach((v, i) => visit(v, `${path}[${i}]`));
    if (!x || typeof x !== 'object') return;
    const o = x as Record<string, unknown>;
    // В прологе `say` — реплика жителя (объект), это другое поле: проверяем только рядом с текстом `es`.
    if (o.say !== undefined && typeof o.es === 'string') {
      if (typeof o.say !== 'string' || !o.say.trim()) out.push({ where: path, msg: 'пустое поле say' });
      else if (o.say === o.es) out.push({ where: path, msg: 'say совпадает с текстом' });
      const fem = o.fem as { es?: string; say?: string } | undefined;
      if (fem?.es && fem.say === undefined) out.push({ where: path, msg: 'у реплики с fem.es нет fem.say: путница услышит текст без say' });
    }
    for (const [k, v] of Object.entries(o)) visit(v, path ? `${path}.${k}` : k);
  };
  visit(data, '');
  return out;
}
