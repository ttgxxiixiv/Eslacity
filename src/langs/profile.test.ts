import { describe, expect, it } from 'vitest';
import { LANG_IDS, LANGS, RELEASED_LANGS } from '../lang';
import { loader, loaders } from '../content/registry';
import { checkWord } from '../content/validate';
import type { Issue } from '../content/validate';
import type { Word } from '../content/schema';
import { PROFILES } from '.';

const DISTRICTS = ['A1', 'A2', 'B1.1', 'B1.2', 'B2', 'C1'] as const;

describe.each(LANG_IDS)('профиль языка %s полный (задача 16.6)', (lang) => {
  const p = PROFILES[lang];

  it('id совпадает с ключом, строки и списки заполнены', () => {
    expect(p.id).toBe(lang);
    for (const k of ['name', 'variety', 'flag', 'adverb', 'genitive', 'voicePrefix', 'locale', 'db', 'heroKey', 'voiceHint'] as const) {
      expect(p[k].trim(), k).not.toBe('');
    }
    for (const k of ['voices', 'pairKinds'] as const) expect(p[k].length, k).toBeGreaterThan(0);
    // Артикли бывают не у всех языков (у турецкого их нет), но язык с родом без определённого артикля не бывает.
    if (p.gender) for (const k of ['singular', 'plural'] as const) expect(p[k].length, k).toBeGreaterThan(0);
    // Клавиши испытаний нужны языку с буквами с диакритикой; возвратное окончание — языку с возвратными глаголами.
    if (p.letters) expect(p.examKeys.length).toBeGreaterThan(0);
    if (p.gender) expect(p.reflexive).not.toBe('');
    expect(p.thanks.es && p.thanks.ru && p.samples.voice && p.samples.hero).toBeTruthy();
    expect(p.infinitiveEnd).toBeGreaterThan(0);
    for (const d of DISTRICTS) expect(p.districts[d]?.trim(), d).toBeTruthy();
  });

  it('база, ключ путника и номера уведомлений свои у каждого языка', () => {
    for (const other of LANG_IDS.filter((x) => x !== lang)) {
      expect(LANGS[other].db).not.toBe(p.db);
      expect(LANGS[other].heroKey).not.toBe(p.heroKey);
      expect(LANGS[other].reminderBase).not.toBe(p.reminderBase);
    }
  });

  it('род: есть — артикли сверяются; клавиши испытания — буквы языка', () => {
    if (p.gender) expect(p.articleIssue).toBeTypeOf('function');
    for (const c of p.letters) expect(c.normalize('NFD').length, c).toBeGreaterThan(1);
    for (const k of p.examKeys) expect(p.letters.includes(k) || (p.distinct ?? '').includes(k) || k === "'", k).toBe(true);
    for (const [re] of p.answerRules) expect(re.global).toBe(true);
  });

  it('обращение к путнику и проверка «ты/вы»', () => {
    expect(p.hero.words.length).toBeGreaterThan(0);
    for (const [m, f] of p.hero.words) expect(m && f).toBeTruthy();
    for (const re of [p.you.ty, p.you.formal, p.you.plural]) expect(re).toBeInstanceOf(RegExp);
  });

  it('кузница: шесть лиц, времена с названием', () => {
    expect(p.verbs.persons).toHaveLength(6);
    expect(p.verbs.tenses.length).toBeGreaterThan(0);
    for (const t of p.verbs.tenses) expect(t.ru.trim() && t.lesson.trim(), t.id).toBeTruthy();
  });

  // Контент закрытого курса ещё пишется: его полноту проверяем с выпуском (released).
  it.runIf(p.released)('кузница: у каждого времени урок, генератор строит шесть форм каждого глагола', async () => {
    const v = p.verbs;
    const lessons = new Set([...loaders('grammar', lang).keys()].map((k) => k.replace('/', '.')));
    for (const t of v.tenses) {
      expect(t.ru.trim(), t.id).not.toBe('');
      expect(lessons.has(t.lesson), `${t.id}: урок ${t.lesson}`).toBe(true);
    }
    const file = await loader('verbs', '', lang)!();
    for (const verb of file.verbs) {
      expect(v.infinitive.test(verb.inf), verb.inf).toBe(true);
      for (const t of v.tenses) {
        const forms = v.conjugate(verb, t.id);
        expect(forms.length === 6 && forms.every((f) => f.trim() !== ''), `${verb.inf} ${t.id}`).toBe(true);
      }
    }
  });

  it.runIf(p.released)('у каждого праздника есть файл контента и неделя', () => {
    const files = loaders('festivals', lang);
    for (const f of p.festivals) {
      expect(files.has(f.id), f.id).toBe(true);
      const { start, end } = f.week(2027);
      expect(start.getTime()).toBeLessThanOrEqual(end.getTime());
      expect(end.getTime() - start.getTime()).toBeLessThan(10 * 86_400_000);
    }
    expect(files.size).toBe(p.festivals.length);
  });

  it.runIf(p.released)('у языка есть контент и противопоставления Звонницы своих видов', async () => {
    expect(loaders('words', lang).size).toBeGreaterThan(0);
    const pairs = await loader('pairs', '', lang)!();
    for (const c of pairs.contrasts) expect(p.pairKinds).toContain(c.kind);
  });
});

describe('род существительного по профилю', () => {
  const noun: Word = { id: 'cafe.x', es: 'el café', ru: 'кофе', pos: 'noun', level: 1, cefr: 'A1', example: { es: 'Un café, por favor.', ru: 'Кофе, пожалуйста.' } } as Word;
  const issues = (w: Word) => {
    const out: Issue[] = [];
    checkWord(w, 'x', 'es', out);
    return out.map((i) => i.msg);
  };

  it('язык с родом: род обязателен', () => {
    expect(issues(noun)).toContain('у существительного нет рода');
    expect(issues({ ...noun, gender: 'm' })).toEqual([]);
  });

  it('язык без рода: род не нужен, а указанный — ошибка', () => {
    const p = LANGS.es;
    p.gender = false;
    try {
      expect(issues(noun)).toEqual([]);
      expect(issues({ ...noun, gender: 'm' })).toEqual(['род у существительного: у испанского рода нет']);
    } finally {
      p.gender = true;
    }
  });
});

describe('открытые курсы', () => {
  it('открыты испанский, итальянский и английский (с 2.185.0), турецкий пока закрыт', () => {
    expect(RELEASED_LANGS).toEqual(['es', 'it', 'en']);
    expect(LANG_IDS).toContain('tr');
  });
});

describe('праздники всех профилей', () => {
  it('id праздников не повторяются между языками', () => {
    const ids = Object.values(PROFILES).flatMap((p) => p.festivals.map((f) => f.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
