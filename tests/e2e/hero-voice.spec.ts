import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { LANGS, loadPhraseData, openApp, phraseFull, readMeta, readSpoken } from './fixtures';

const CONTENT = join(import.meta.dirname, '..', '..', 'src', 'content');
type Answer = { kind: 'answer'; task: string; branches: { phrase: string }[] };

/** Первый ответ героя в миссии кафе главы I: задание и верная фраза. */
function firstAnswer(lang: (typeof LANGS)[number]) {
  const m = (JSON.parse(readFileSync(join(CONTENT, lang, 'missions', 'cafe.json'), 'utf8')).missions as { id: string; nodes: Record<string, Answer> }[]).find((x) => x.id === 'ms:cafe.1')!;
  const phrases = new Map(loadPhraseData(lang, 'cafe').map((p) => [p.id, p.es]));
  return Object.values(m.nodes)
    .filter((n) => n.kind === 'answer')
    .map((n) => ({ task: n.task, right: phraseFull(phrases.get(n.branches[0].phrase)!) }));
}

for (const lang of LANGS) {
  test.describe(lang, () => {
    test('пол путника в настройках: реплики героя в миссии звучат голосом этого пола', async ({ page }) => {
      await openApp(page, lang);
      // В браузере тестов голосов нет: основной голос считается женским, мужской путник звучит ниже.
      await page.goto('./#/settings');
      await expect(page.getByTestId('hero-gender-m')).toHaveAttribute('aria-checked', 'true');
      await page.getByRole('button', { name: /Голос путника/ }).click();
      expect((await readSpoken(page)).at(-1)!.pitch).toBeLessThan(1);

      await page.getByTestId('hero-gender-f').click();
      await expect(page.getByTestId('hero-gender-f')).toHaveAttribute('aria-checked', 'true');
      await expect.poll(async () => (await readMeta<{ heroGender: string }>(page, lang, 'settings'))?.heroGender).toBe('f');
      await page.getByRole('button', { name: /Голос путника/ }).click();
      expect((await readSpoken(page)).at(-1)!.pitch).toBe(1);

      // Выбор переживает перезагрузку; путница отвечает в миссии своим голосом, житель — своим.
      await page.reload();
      await page.goto('./#/settings');
      await expect(page.getByTestId('hero-gender-f')).toHaveAttribute('aria-checked', 'true');
      await page.getByTestId('hero-gender-m').click();

      await page.goto('./#/mission/ms:cafe.1');
      while (!(await page.getByText('Ответить жителю').count())) await page.getByTestId('scene-next').click();
      await page.getByTestId('scene-next').click();
      const turn = page.getByTestId('hero-turn');
      // Реплики жителя до первого ответа героя.
      for (let i = 0; i < 20 && !(await turn.count()); i++) await page.getByTestId('mission-next').click();
      const task = ((await page.getByTestId('hero-task').textContent()) ?? '').trim();
      const { right } = firstAnswer(lang).find((a) => a.task === task)!;
      await turn.getByRole('button', { name: right, exact: true }).click();
      await expect(page.getByTestId('hero-line').last()).toContainText(right);
      await expect.poll(async () => (await readSpoken(page)).find((s) => s.text === right)?.pitch).toBeLessThan(1);
      // Бариста — женщина: её голос не опускается.
      expect((await readSpoken(page)).some((s) => s.pitch > 1)).toBe(true);
    });
  });
}
