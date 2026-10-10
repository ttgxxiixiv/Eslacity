import { expect, test } from '@playwright/test';
import { LANGS, openApp, seedDueCards } from './fixtures';

/** Пометки употребления (задача 15.2): метка и пояснение у рискованного слова в «Моих словах». */
const RISKY = {
  es: { id: 'airport.coger_un_avion', es: 'coger un avión', tag: 'региональное', note: 'В Латинской Америке это грубое слово' },
  it: { id: 'school.farsi_segare', es: 'farsi segare', tag: 'сленг', note: 'вне школы фраза звучит пошло' },
} as const;

for (const lang of LANGS) {
  test.describe(lang, () => {
    test('рискованное слово: метка и пояснение в «Моих словах»', async ({ page }) => {
      const r = RISKY[lang];
      await openApp(page, lang);
      await seedDueCards(page, lang, [r.id]);
      await page.goto('./#/words');
      const row = page.getByRole('listitem').filter({ hasText: r.es });
      await expect(row.getByTestId('word-tags')).toContainText(r.tag);
      await expect(row.getByTestId('usage-note')).toContainText(r.note);
    });
  });
}
