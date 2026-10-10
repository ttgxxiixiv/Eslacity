import { expect, test, type Page } from '@playwright/test';
import { LANGS, loadWords, openApp, readMeta, seedDueCards, wordIdsOf, type Lang } from './fixtures';

const DAY = 86_400_000;
/** Как `dayNumber` и `rumorKind` в приложении: день по местному календарю, вид по кругу. */
const kindOf = (ts: number) => {
  const d = new Date(ts);
  return (['guest', 'cat', 'notice'] as const)[Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY) % 3];
};

/** Ответить на событие дня по данным контента. `wrong` — сначала нарочно ошибиться. */
async function play(page: Page, lang: Lang, wrong = false) {
  const words = loadWords(lang);
  const ev = page.getByTestId('rumor-event');
  const kind = await ev.getAttribute('data-kind');
  const options = page.getByTestId('rumor-option');
  if (kind === 'guest') {
    const said = await page.evaluate(() => (window as unknown as { __said: string[] }).__said);
    const right = words.byEs.get(said.at(-1)!)!.ru;
    if (wrong) {
      await options.filter({ hasNotText: right }).first().click();
      return;
    }
    await options.filter({ hasText: right }).first().click();
  } else if (kind === 'notice') {
    const text = ((await page.getByTestId('rumor-notice').textContent()) ?? '').trim();
    const w = [...words.byId.values()].find((x) => x.example.es === text)!;
    if (wrong) {
      await options.filter({ hasNotText: w.example.ru }).first().click();
      return;
    }
    await options.filter({ hasText: w.example.ru }).first().click();
  } else {
    const ru = ((await page.getByTestId('rumor-ru').textContent()) ?? '').trim();
    const w = words.byRu.get(ru)!;
    // Слово без артикля: «el café» → «café», «l'acqua» → «acqua».
    const core = w.es.split(/[\s']/).at(-1)!.toLowerCase();
    const letters = page.getByTestId('rumor-letters').locator('button:not([disabled])');
    for (const ch of wrong ? [...core].reverse() : core) await letters.filter({ hasText: new RegExp(`^${ch}$`, 'i') }).first().click();
    await page.getByRole('button', { name: 'Отнять у кота' }).click();
  }
}

for (const lang of LANGS) {
  test.describe(lang, () => {
    test('слухи города: событие дня трёх видов, монеты и слухи, раз в день', async ({ page }) => {
      test.setTimeout(120_000);
      const base = new Date(2026, 9, 12, 10).getTime();
      await page.clock.install({ time: base });
      await openApp(page, lang);
      // Мало слов — кнопки нет.
      await expect(page.getByTestId('rumor-button')).toHaveCount(0);
      await seedDueCards(page, lang, wordIdsOf(lang, 'cafe', [1, 2]));

      const kinds = new Set<string>();
      for (let i = 0; i < 3; i++) {
        await page.clock.setSystemTime(base + i * DAY);
        await page.goto('./#/');
        await page.reload();
        await page.getByTestId('rumor-button').click();
        await expect(page).toHaveURL(/#\/rumor$/);
        await expect(page.getByTestId('rumor-event')).toHaveAttribute('data-kind', kindOf(base + i * DAY));
        kinds.add(kindOf(base + i * DAY));
        if (i === 0) {
          // Ошибка: правильный ответ и новое событие того же вида, слух не потерян.
          await play(page, lang, true);
          await expect(page.getByTestId('rumor-wrong')).toBeVisible();
          await page.getByTestId('rumor-retry').click();
        }
        await play(page, lang);
        await expect(page.getByTestId('rumor-reward')).toContainText('+15 🪙');
        await expect(page.getByTestId('rumor-reward').getByTestId('rumor-line')).toHaveAttribute('data-id', `rm:1.${i + 1}`);
        await expect(page.getByTestId('rumor-line')).toHaveCount(2 + i);
        // Сегодня больше нельзя: кнопки на главной нет, экран говорит, что слух уже узнан.
        await page.goto('./#/');
        await expect(page.getByTestId('continue')).toBeVisible();
        await expect(page.getByTestId('rumor-button')).toHaveCount(0);
        await page.goto('./#/rumor');
        await expect(page.getByTestId('rumor-done')).toBeVisible();
      }
      expect(kinds.size).toBe(3);
      expect(await readMeta(page, lang, 'rumors')).toEqual({ day: expect.any(Number), got: ['rm:1.1', 'rm:1.2', 'rm:1.3'] });
      await expect(page.getByTestId('rumor-count')).toContainText('3 из 4');
    });
  });
}
