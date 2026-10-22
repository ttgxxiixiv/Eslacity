import { expect, test, type Page } from '@playwright/test';
import { openCourse } from './fixtures';

/**
 * Голос не того варианта языка (задача 20.5): в телефоне есть только европейский португальский или американский
 * английский — курс говорит им, но в разделе «Звук и озвучка» предупреждает и подсказывает, как поставить нужный.
 */
async function withVoices(page: Page, langs: string[]) {
  await page.addInitScript((langs) => {
    const voices = langs.map((lang) => ({ name: `${lang.toLowerCase()}-x-test-local`, lang, voiceURI: lang, localService: true, default: false }));
    Object.defineProperty(speechSynthesis, 'getVoices', { value: () => voices });
  }, langs);
}

const CASES = [
  { lang: 'pt', wrong: 'pt-PT', right: 'pt-BR', hint: 'Португальский (Бразилия)' },
  { lang: 'en', wrong: 'en-US', right: 'en-GB', hint: 'Английский (Великобритания)' },
];

for (const c of CASES) {
  test(`${c.lang}: голос ${c.wrong} — предупреждение с подсказкой, голос ${c.right} — без`, async ({ page }) => {
    await openCourse(page, c.lang);
    await withVoices(page, [c.wrong]);
    await page.goto('./#/settings/sound');
    const warn = page.getByTestId('voice-variety');
    await expect(warn).toContainText(`(${c.wrong})`);
    await expect(warn).toContainText(c.right);
    await expect(warn).toContainText(c.hint);
  });

  test(`${c.lang}: есть голос ${c.right} — предупреждения нет`, async ({ page }) => {
    await openCourse(page, c.lang);
    await withVoices(page, [c.wrong, c.right]);
    await page.goto('./#/settings/sound');
    await expect(page.getByText(/Голос: .*-x-test-local/)).toContainText(c.right.toLowerCase());
    await expect(page.getByTestId('voice-variety')).toHaveCount(0);
  });
}
