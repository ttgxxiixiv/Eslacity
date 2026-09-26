import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { LANGS, openApp } from './fixtures';

const CONTENT = join(import.meta.dirname, '..', '..', 'src', 'content');
const WORDS = { es: { greet: 'Hola', greetRu: 'привет', verb: 'quieres', verbRu: 'хотеть' }, it: { greet: 'Ciao', greetRu: 'привет', verb: 'prendi', verbRu: 'брать' } };

for (const lang of LANGS) {
  test.describe(lang, () => {
    const scene = JSON.parse(readFileSync(join(CONTENT, lang, 'scenes', 'cafe.json'), 'utf8')).scenes[0] as {
      lines: { es: string; ru: string }[];
      questions: { q: string; options: string[]; answer: number }[];
    };
    const said = (page: import('@playwright/test').Page) => page.evaluate(() => (window as unknown as { __said: string[] }).__said);

    test('сцена в кафе: реплики голосом, перевод слова и реплики, вопросы на понимание', async ({ page }) => {
      await openApp(page, lang, '/loc/cafe');
      await page.getByTestId('scene-link').click();
      await expect(page).toHaveURL(/#\/scene\/sc%3Acafe\.1$/);
      const current = page.getByTestId('scene-current');
      await expect(current).toContainText(scene.lines[0].es);
      await expect.poll(() => said(page)).toContain(scene.lines[0].es);

      // Перевод слова: из gloss автора сцены и из словаря курса.
      const w = WORDS[lang];
      await current.getByRole('button', { name: w.greet, exact: true }).click();
      await expect(page.getByTestId('scene-word')).toContainText(`${w.greet} — ${w.greetRu}`);
      await current.getByRole('button', { name: w.verb, exact: true }).click();
      await expect(page.getByTestId('scene-word')).toContainText(w.verbRu);

      // «Ещё раз» повторяет реплику, «Перевод» показывает её по-русски.
      const before = (await said(page)).length;
      await page.getByTestId('scene-again').click();
      await expect.poll(async () => (await said(page)).length).toBe(before + 1);
      await page.getByTestId('scene-translate').click();
      await expect(page.getByTestId('scene-ru')).toHaveText(scene.lines[0].ru);

      for (let i = 1; i < scene.lines.length; i++) {
        await page.getByTestId('scene-next').click();
        await expect(current).toContainText(scene.lines[i].es);
      }
      await expect(page.getByTestId('scene-next')).toHaveText('К вопросам');
      await page.getByTestId('scene-next').click();

      for (const q of scene.questions) {
        await expect(page.getByTestId('scene-question')).toHaveText(q.q);
        await page.getByRole('button', { name: q.options[q.answer], exact: true }).click();
        await page.getByRole('button', { name: /дальше|итог/i }).click();
      }
      await expect(page.getByTestId('scene-result')).toContainText(`Понято: ${scene.questions.length} из ${scene.questions.length}`);
      await page.getByRole('button', { name: 'Готово' }).click();
      await expect(page).toHaveURL(/#\/loc\/cafe$/);
    });

    test('все сцены контента: реплики по порядку и все ответы верные', async ({ page }) => {
      test.setTimeout(240_000);
      await openApp(page, lang);
      const all = readdirSync(join(CONTENT, lang, 'scenes'))
        .filter((f) => f.endsWith('.json'))
        .flatMap((f) => JSON.parse(readFileSync(join(CONTENT, lang, 'scenes', f), 'utf8')).scenes as (typeof scene & { id: string })[]);
      for (const sc of all) {
        const place = sc.id;
        await page.goto(`./#/scene/${encodeURIComponent(sc.id)}`);
        for (let i = 0; i < sc.lines.length; i++) {
          await expect(page.getByTestId('scene-current'), place).toContainText(sc.lines[i].es);
          await page.getByTestId('scene-next').click();
        }
        for (const q of sc.questions) {
          await expect(page.getByTestId('scene-question')).toHaveText(q.q);
          await page.getByRole('button', { name: q.options[q.answer], exact: true }).click();
          await page.getByRole('button', { name: /дальше|итог/i }).click();
        }
        await expect(page.getByTestId('scene-result'), place).toContainText(`Понято: ${sc.questions.length} из ${sc.questions.length}`);
      }
    });
  });
}
