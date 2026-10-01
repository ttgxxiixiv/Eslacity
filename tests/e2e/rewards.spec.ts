import { expect, test } from '@playwright/test';
import { LANGS, loadWords, openApp, playWords, readAnswers, readMeta, seedDueCards, seedXp } from './fixtures';

/** Опыт к началу уровня героя: переход n → n+1 стоит 100·n^1.5, округлено до 10. */
const xpFor = (level: number) => {
  let xp = 0;
  for (let l = 1; l < level; l++) xp += Math.round((100 * l ** 1.5) / 10) * 10;
  return xp;
};

type Rewards = { level: number; hints: number; blitz: string[]; cloaks: string[]; cloak: string; blitzBest: Record<string, number> };

for (const lang of LANGS) {
  test.describe(lang, () => {
    test('награды выдаются задним числом за набранный уровень; плащ выбирается в профиле', async ({ page }) => {
      await openApp(page, lang);
      await seedXp(page, lang, xpFor(7));
      await expect.poll(async () => (await readMeta<Rewards>(page, lang, 'rewards'))?.level).toBe(7);
      const r = (await readMeta<Rewards>(page, lang, 'rewards'))!;
      expect(r.hints).toBe(11);
      expect(r.blitz).toEqual(['classic', 'listen', 'survival']);
      expect(r.cloaks).toEqual(['moss', 'crimson', 'indigo']);

      await page.goto('./#/profile');
      await expect(page.getByTestId('hint-count')).toContainText('11');
      await expect(page.getByTestId('cloak-night')).toBeDisabled();
      await expect(page.getByTestId('cloak-night')).toContainText('ур. 10');
      await page.getByTestId('cloak-indigo').click();
      await expect(page.getByTestId('cloak-indigo')).toHaveAttribute('aria-checked', 'true');
      await page.goto('./#/');
      await expect(page.getByTestId('road-walker')).toHaveAttribute('data-cloak', 'indigo');
      await page.reload();
      await expect(page.getByTestId('road-walker')).toHaveAttribute('data-cloak', 'indigo');
    });

    test('новый уровень показывает награду; жетон подсказки открывает первую букву, ответ — «почти»', async ({ page }) => {
      await openApp(page, lang);
      await seedXp(page, lang, xpFor(2) - 5);
      await page.goto('./#/learn/cafe/1/1');
      // Урок переводит на 2-й уровень: 3 жетона приходят посреди урока, на ближайшем вводе берём один.
      // Поздравление с уровнем держится несколько секунд: ждём его параллельно с уроком.
      const toast = page.getByTestId('level-reward').first().textContent({ timeout: 60_000 });
      const res = await playWords(page, lang, /урок пройден/i, { hint: true });
      expect(await toast).toContain('3 жетона подсказки');
      expect(res.hinted).toBeDefined();
      const { es, prefix } = res.hinted!;
      expect(es.startsWith(prefix)).toBe(true);
      expect(prefix.length).toBeLessThan(es.length);
      const word = loadWords(lang).byEs.get(es)!;
      const log = (await readAnswers(page, lang)).filter((a) => a.itemId === word.id && a.kind === 'type');
      expect(log.map((a) => a.verdict)).toContain('almost');
      await expect.poll(async () => (await readMeta<Rewards>(page, lang, 'rewards'))?.hints).toBe(2);
    });

    test('режимы блица: закрыты до уровня, «На слух» без текста, «Без права на ошибку» до трёх ошибок', async ({ page }) => {
      await openApp(page, lang);
      const ids = [...loadWords(lang).byEs.values()].filter((w) => w.id.startsWith('cafe.')).slice(0, 10).map((w) => w.id);
      await seedDueCards(page, lang, ids);
      await page.goto('./#/blitz');
      await expect(page.getByTestId('blitz-listen')).toBeDisabled();
      await expect(page.getByTestId('blitz-listen')).toContainText('Откроется на 3-м уровне героя');
      await expect(page.getByTestId('blitz-survival')).toContainText('Откроется на 6-м уровне героя');

      await page.goto('./#/');
      await seedXp(page, lang, xpFor(6));
      await page.goto('./#/blitz');
      await page.getByTestId('blitz-listen').click();
      await expect(page.locator('button.min-h-14').first()).toBeVisible();
      await expect(page.getByTestId('blitz-word')).toHaveCount(0);
      const said = await page.evaluate(() => (window as unknown as { __said: string[] }).__said.at(-1) ?? '');
      expect(loadWords(lang).byEs.has(said)).toBe(true);
      await page.getByRole('button', { name: 'Закончить' }).click();
      await expect(page.getByText('Ещё раз')).toBeVisible();

      // Тот же адрес не открывает экран заново: через главную.
      await page.goto('./#/');
      await page.goto('./#/blitz');
      await page.getByTestId('blitz-survival').click();
      await expect(page.getByTestId('blitz-lives')).toBeVisible();
      // Отвечаем, пока блиц не кончится: без таймера его заканчивают только три ошибки.
      for (let i = 0; i < 60 && !(await page.getByText('Ещё раз').count()); i++) {
        const word = (await page.getByTestId('blitz-word').textContent({ timeout: 2000 }).catch(() => null)) ?? '';
        const w = loadWords(lang).byEs.get(word) ?? loadWords(lang).byRu.get(word);
        const right = w ? (loadWords(lang).byEs.has(word) ? w.ru : w.es) : '';
        await page.locator('button.min-h-14').filter({ hasNotText: right }).first().click();
        await page.waitForTimeout(800);
      }
      await expect(page.getByText('Ещё раз')).toBeVisible();
      await expect(page.getByText(/Без права на ошибку/)).toBeVisible();
      const misses = (await readAnswers(page, lang)).filter((a) => a.mode === 'blitz' && a.verdict === 'wrong');
      expect(misses.length).toBeGreaterThanOrEqual(3);
    });
  });
}
