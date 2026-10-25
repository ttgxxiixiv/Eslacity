import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import type { LocationScenes, LocationWords } from '../../src/content/schema';
import { openApp, readSpoken, type Lang } from './fixtures';

/**
 * Диктант и темп речи (задача 21.5): с главы II поручение жителя, чей разговор дослушан, начинается с диктанта —
 * реплика из этого разговора, ввод целиком, подсветка пропущенных слов, журнал `dictation`. В разговоре и диктанте
 * кнопка «Медленнее» говорит ту же реплику в темпе 0,7.
 */
const CONTENT = join(import.meta.dirname, '..', '..', 'src', 'content');
const COURSES = ['es', 'it', 'en', 'tr', 'pt'] as const;
type Course = (typeof COURSES)[number];
const DBS: Record<Course, string> = { es: 'eslacity', it: 'eslacity-it', en: 'eslacity-en', tr: 'eslacity-tr', pt: 'eslacity-pt' };
const read = <T,>(lang: Course, ...p: string[]): T => JSON.parse(readFileSync(join(CONTENT, lang, ...p), 'utf8'));

/** Глава II открыта, у кафе здание, разговор кафе главы I дослушан, слова кафе пора повторить. */
async function seed(page: Page, lang: Course, words: string[], heard: string[]) {
  await page.evaluate(
    ({ db, words, heard }) =>
      new Promise<void>((resolve) => {
        const r = indexedDB.open(db);
        r.onsuccess = () => {
          const tx = r.result.transaction(['cards', 'buildings', 'meta'], 'readwrite');
          for (const id of words) tx.objectStore('cards').put({ wordId: id, ef: 2.5, interval: 1, reps: 1, due: 0, lapses: 0, learnedAt: 1, lastReviewedAt: 1 });
          tx.objectStore('buildings').put({ locationId: 'cafe', level: 1, lastCollectedAt: Date.now() });
          tx.objectStore('meta').put({ key: 'journey', value: { fragments: {}, seals: {}, openedChapter: 2, celebrated: 2 } });
          tx.objectStore('meta').put({ key: 'diary', value: { scenes: heard } });
          tx.objectStore('meta').put({ key: 'errands', value: { day: 0, active: [], last: {}, done: 0, rep: {} } });
          tx.oncomplete = () => resolve();
        };
      }),
    { db: DBS[lang], words, heard },
  );
  await page.reload();
  await expect(page.getByTestId('continue')).toBeVisible();
}

function dictationRows(page: Page, lang: Course) {
  return page.evaluate(
    (db) =>
      new Promise<{ itemId: string; kind: string; verdict: string }[]>((resolve) => {
        const r = indexedDB.open(db);
        r.onsuccess = () => {
          const q = r.result.transaction('answers').objectStore('answers').getAll();
          q.onsuccess = () => resolve((q.result as { itemId: string; kind: string; verdict: string; mode: string }[]).filter((a) => a.mode === 'dictation'));
        };
      }),
    DBS[lang],
  );
}

for (const lang of COURSES) {
  test(`${lang}: диктант в поручении и «Медленнее» в разговоре`, async ({ page }) => {
    const scene = read<LocationScenes>(lang, 'scenes', 'cafe.json').scenes.find((s) => s.id === 'sc:cafe.1')!;
    const words = read<LocationWords>(lang, 'words', 'cafe.json').words.filter((w) => w.level === 1).slice(0, 8).map((w) => w.id);
    await openApp(page, lang as Lang);

    // Разговор: «Медленнее» — та же реплика, темп 0,7 от обычного.
    await page.goto(`./#/scene/${encodeURIComponent(scene.id)}`);
    await expect(page.getByTestId('scene-current')).toBeVisible();
    await page.getByTestId('scene-again').click();
    const normal = (await readSpoken(page)).at(-1)!;
    await page.getByTestId('scene-slow').click();
    const slow = (await readSpoken(page)).at(-1)!;
    expect(slow.text).toBe(normal.text);
    expect(slow.rate).toBeCloseTo(normal.rate * 0.7, 5);

    await page.goto('./#/');
    await seed(page, lang, words, [scene.id]);
    await page.goto('./#/errands');
    const card = page.getByTestId('errand-card').filter({ has: page.getByTestId('dictation-tag') });
    await expect(card).toHaveCount(1);
    await card.click();

    // Житель сам говорит реплику из своего разговора.
    await expect(page.getByTestId('dictation')).toBeVisible();
    await expect.poll(async () => (await readSpoken(page)).length).toBeGreaterThan(0);
    const said = (await readSpoken(page)).at(-1)!;
    const line = scene.lines.find((l) => l.es === said.text);
    expect(line, said.text).toBeTruthy();
    expect(line!.who === 'npc' || line!.who === scene.npc).toBe(true);
    await page.getByTestId('dictation-slow').click();
    expect((await readSpoken(page)).at(-1)!.rate).toBeCloseTo(said.rate * 0.7, 5);

    // Ответ без первого слова: не засчитан как верный (короткое слово в длинной реплике — «почти»), первое слово подсвечено.
    const parts = line!.es.split(/\s+/);
    await page.getByTestId('dictation-input').fill(parts.slice(1).join(' '));
    await page.getByTestId('dictation-check').click();
    const result = page.getByTestId('dictation-result');
    await expect(result).toHaveAttribute('data-verdict', /^(wrong|almost)$/);
    await expect(result).toContainText('Пропущенные и неверные слова подчёркнуты');
    await expect(page.locator('[data-testid=dictation-word][data-ok=false]').first()).toHaveText(parts[0]);
    await expect(result).toContainText(line!.ru.slice(0, 10));
    const rows = await dictationRows(page, lang);
    expect(rows).toHaveLength(1);
    expect(rows[0].itemId).toBe(`${scene.id}#${scene.lines.indexOf(line!)}`);
    expect(rows[0].kind).toBe('listen-dictation');
    expect(rows[0].verdict).not.toBe('correct');

    // Дальше — обычное поручение словами.
    await page.getByTestId('dictation-next').click();
    await expect(page.getByTestId('dictation')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /понятно|проверить|дальше/i }).or(page.locator('button.min-h-14')).first()).toBeVisible();
  });
}
