import { expect, test } from '@playwright/test';
import { LANGS, openApp, readSpoken, seedDueCards } from './fixtures';

/** Произношение для озвучки (задача 15.4): озвучка берёт поле say, написанное на экране не меняется. */
const WORD = {
  es: { id: 'post.dni', es: 'el DNI', say: 'el de ene i' },
  it: { id: 'police.dna', es: 'il DNA', say: 'il di enne a' },
} as const;

for (const lang of LANGS) {
  test.describe(lang, () => {
    test('аббревиатура звучит так, как её произносят', async ({ page }) => {
      const w = WORD[lang];
      await openApp(page, lang);
      await seedDueCards(page, lang, [w.id]);
      await page.goto('./#/words');
      const row = page.getByRole('listitem').filter({ hasText: w.es });
      await expect(row).toContainText(w.es);
      await row.getByRole('button', { name: 'Озвучить' }).click();
      await expect.poll(async () => (await readSpoken(page)).at(-1)?.text).toBe(w.say);
    });
  });
}
