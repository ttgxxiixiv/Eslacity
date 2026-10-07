import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import type { PrologueFile } from '../../src/content/schema';
import { LANGS, loadWords, openApp, readMeta, type Lang } from './fixtures';

/** Пролог (задача 13.2): ворота, три слова, дорога к кафе, три ответа жителю, обрывок пролога, входной тест. */
const prologueOf = (lang: Lang): PrologueFile =>
  JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', 'src', 'content', lang, 'prologue.json'), 'utf8'));

async function cardIds(page: import('@playwright/test').Page, db: string): Promise<string[]> {
  return page.evaluate(
    (db) =>
      new Promise<string[]>((resolve, reject) => {
        const r = indexedDB.open(db);
        r.onerror = () => reject(r.error);
        r.onsuccess = () => {
          const q = r.result.transaction('cards').objectStore('cards').getAllKeys();
          q.onsuccess = () => resolve(q.result as string[]);
        };
      }),
    db,
  );
}

for (const lang of LANGS) {
  test.describe(lang, () => {
    test('пролог: ворота, три слова, кафе, три ответа, обрывок пролога, потом главная с одним блоком', async ({ page }) => {
      const p = prologueOf(lang);
      const words = loadWords(lang).byId;
      await openApp(page, lang, '', { prologue: true });
      const pro = page.getByTestId('prologue');
      await expect(pro).toHaveAttribute('data-step', 'gate');
      for (let i = 0; i < p.gate.length; i++) await page.getByTestId('prologue-next').click();

      // Три слова: на первое ответим неверно — оно вернётся в конце.
      await expect(pro).toHaveAttribute('data-step', 'words');
      let mistakes = 0;
      for (let guard = 0; guard < 10 && (await pro.getAttribute('data-step')) === 'words'; guard++) {
        const id = (await page.getByTestId('prologue-word').getAttribute('data-word'))!;
        await page.getByTestId('prologue-next').click();
        const right = words.get(id)!.ru;
        const options = page.getByTestId('prologue-meaning');
        if (!mistakes) {
          await options.filter({ hasNotText: right }).first().click();
          await expect(page.getByTestId('prologue-verdict')).toHaveAttribute('data-verdict', 'wrong');
          mistakes++;
        } else {
          await options.filter({ hasText: right }).first().click();
          await expect(page.getByTestId('prologue-verdict')).toHaveAttribute('data-verdict', 'correct');
        }
        await page.getByTestId('prologue-next').click();
      }
      await expect(pro).toHaveAttribute('data-step', 'road');
      for (let i = 0; i < p.road.length; i++) await page.getByTestId('prologue-next').click();

      // Три ответа жителю кафе: сначала неверный — житель отвечает, потом верный.
      await expect(pro).toHaveAttribute('data-step', 'mission');
      for (let i = 0; i < 3; i++) {
        await expect(page.getByTestId('prologue-mission')).toContainText(p.mission[i].say.es);
        await page.locator('[data-testid="prologue-option"][data-right="false"]').first().click();
        await expect(page.getByTestId('prologue-mission')).toContainText(p.mission[i].wrong.es);
        await page.locator('[data-testid="prologue-option"][data-right="true"]').click();
        await page.getByTestId('prologue-next').click();
      }

      await expect(pro).toHaveAttribute('data-step', 'shard');
      await expect(page.getByTestId('prologue-shard')).toContainText('Обрывок пролога');
      expect((await cardIds(page, lang === 'es' ? 'eslacity' : 'eslacity-it')).sort()).toEqual([...p.words].sort());
      const rec = await readMeta<{ done?: number; shard?: number }>(page, lang, 'prologue');
      expect(rec?.shard).toBeGreaterThan(0);
      await expect(page.getByTestId('prologue-placement')).toContainText('Летописец расспросит');

      // Главная: «Продолжить», путь и повторение (есть три слова), без грамматики и блица; тест ещё предлагается.
      await page.getByTestId('prologue-home').click();
      await expect(page.getByTestId('continue')).toBeVisible();
      await expect(page.getByTestId('journey-line')).toBeVisible();
      await expect(page.getByTestId('review-card')).toBeVisible();
      await expect(page.getByTestId('placement-offer')).toBeVisible();
      await expect(page.getByRole('link', { name: /Блиц/ })).toHaveCount(0);
      await page.reload();
      await expect(page.getByTestId('continue')).toBeVisible();
      await page.goto('./#/journey-map');
      await expect(page.getByTestId('prologue-shard-map')).toBeVisible();
    });

    test('пролог можно пропустить: обрывка нет, главная только с «Продолжить»', async ({ page }) => {
      await openApp(page, lang, '', { prologue: true });
      await page.getByTestId('prologue-skip').click();
      await expect(page.getByTestId('continue')).toBeVisible();
      await expect(page.getByTestId('review-card')).toHaveCount(0);
      await expect(page.getByTestId('journey-line')).toHaveCount(0);
      const rec = await readMeta<{ skipped?: number; shard?: number }>(page, lang, 'prologue');
      expect(rec?.skipped).toBeGreaterThan(0);
      expect(rec?.shard).toBeUndefined();
      await page.reload();
      await expect(page.getByTestId('continue')).toBeVisible();
    });
  });
}
