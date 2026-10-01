import { expect, test } from '@playwright/test';
import { DB, LANGS, loadWords, openApp, playWords, readAnswers, readMeta, seedDueCards, seedXp } from './fixtures';

/** Опыт к началу уровня героя: переход n → n+1 стоит 100·n^1.5, округлено до 10. */
const xpFor = (level: number) => {
  let xp = 0;
  for (let l = 1; l < level; l++) xp += Math.round((100 * l ** 1.5) / 10) * 10;
  return xp;
};

type Rewards = { level: number; hints: number; blitz: string[]; cloaks: string[]; cloak: string; blitzBest: Record<string, number> };

for (const lang of LANGS) {
  test.describe(lang, () => {
    test('награды выдаются задним числом за набранный уровень; накидка выбирается в профиле', async ({ page }) => {
      await openApp(page, lang);
      await seedXp(page, lang, xpFor(9));
      await expect.poll(async () => (await readMeta<Rewards>(page, lang, 'rewards'))?.level).toBe(9);
      const r = (await readMeta<Rewards>(page, lang, 'rewards'))!;
      expect(r.hints).toBe(12);
      expect(r.blitz).toEqual(['classic', 'listen', 'survival']);
      expect(r.cloaks).toEqual(['sackcloth', 'homespun', 'linen']);

      await page.goto('./#/profile');
      await expect(page.getByTestId('hint-count')).toContainText('12');
      await expect(page.getByTestId('cloak-broadcloth')).toBeDisabled();
      await expect(page.getByTestId('cloak-broadcloth')).toContainText('ур. 13');
      await expect(page.getByTestId('cloak-brocade')).toContainText('ур. 26');
      await page.getByTestId('cloak-linen').click();
      await expect(page.getByTestId('cloak-linen')).toHaveAttribute('aria-checked', 'true');
      await page.goto('./#/');
      await expect(page.getByTestId('road-walker')).toHaveAttribute('data-cloak', 'linen');
      await page.reload();
      await expect(page.getByTestId('road-walker')).toHaveAttribute('data-cloak', 'linen');
    });

    test('плащи цветов из 2.108.0 заменяются накидками по набранному уровню', async ({ page }) => {
      await openApp(page, lang);
      await page.evaluate(
        ({ db, xp }) =>
          new Promise<void>((resolve) => {
            const r = indexedDB.open(db);
            r.onsuccess = () => {
              const tx = r.result.transaction('meta', 'readwrite');
              tx.objectStore('meta').put({ key: 'xpTotal', value: xp });
              tx.objectStore('meta').put({
                key: 'rewards',
                value: { level: 7, hints: 4, blitz: ['classic', 'listen', 'survival'], cloaks: ['moss', 'crimson', 'indigo'], cloak: 'indigo', blitzBest: { listen: 9 } },
              });
              tx.oncomplete = () => resolve();
            };
          }),
        { db: DB[lang], xp: xpFor(7) },
      );
      await page.reload();
      await expect(page.getByTestId('road-walker')).toHaveAttribute('data-cloak', 'homespun');
      await page.goto('./#/profile');
      await expect(page.getByTestId('cloak-homespun')).toHaveAttribute('aria-checked', 'true');
      // Жетоны и рекорды остались.
      await expect(page.getByTestId('hint-count')).toContainText('4');
      await expect.poll(async () => (await readMeta<Rewards>(page, lang, 'rewards'))?.blitzBest.listen).toBe(9);
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
