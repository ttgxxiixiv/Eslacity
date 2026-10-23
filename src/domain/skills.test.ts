import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LANG_IDS } from '../lang';
import { chapterSkills, proofHint, SKILLS, skillDone, type SkillInput } from './skills';

const CONTENT = join(import.meta.dirname, '..', 'content');
const none: SkillInput = { missionDone: () => false, guardianDone: () => false, letterIds: [], booksRead: [], sphinxHear: false };

describe('«Что я умею» (задача 21.3)', () => {
  it('у каждой главы три-четыре умения, id не повторяются', () => {
    for (const ch of [1, 2, 3, 4, 5]) expect(SKILLS.filter((s) => s.chapter === ch).length).toBeGreaterThanOrEqual(3);
    expect(new Set(SKILLS.map((s) => s.id)).size).toBe(SKILLS.length);
  });

  it('доказательства есть во всех курсах: миссии, книги глав, записки и письма', () => {
    for (const lang of LANG_IDS) {
      const dir = join(CONTENT, lang);
      const missions = new Set(
        readdirSync(join(dir, 'missions')).flatMap((f) => (JSON.parse(readFileSync(join(dir, 'missions', f), 'utf8')).missions as { id: string }[]).map((m) => m.id)),
      );
      const letters = JSON.parse(readFileSync(join(dir, 'letters.json'), 'utf8')) as { letters: unknown[]; notes?: unknown[] };
      for (const s of SKILLS) {
        const p = s.proof;
        if (p.kind === 'mission') expect(missions.has(p.id), `${lang} ${p.id}`).toBe(true);
        if (p.kind === 'book') expect(existsSync(join(dir, 'books', `${p.chapter}.json`)), `${lang} книги ${p.chapter}`).toBe(true);
        if (p.kind === 'note') expect(letters.notes?.length, `${lang} записки`).toBeGreaterThan(0);
        if (p.kind === 'letter') expect(letters.letters.length, `${lang} письма`).toBeGreaterThan(0);
      }
    }
  });

  it('умение отмечено по своему доказательству', () => {
    const input: SkillInput = {
      missionDone: (id) => id === 'ms:cafe.1',
      guardianDone: (ch) => ch === 2,
      letterIds: ['nt:cafe'],
      booksRead: ['book:3.2'],
      sphinxHear: true,
    };
    const done = SKILLS.filter((s) => skillDone(s, input)).map((s) => s.id);
    expect(done).toEqual(['c1.order', 'c2.note', 'c2.everyday', 'c3.read', 'c5.hear']);
    expect(chapterSkills(1, none).every((x) => !x.done)).toBe(true);
    expect(proofHint({ kind: 'mission', id: 'ms:market.1' }, () => 'Рынок')).toBe('Миссия: Рынок, глава I');
    expect(proofHint({ kind: 'guardian', chapter: 4 }, String)).toBe('Страж главы IV');
  });
});
