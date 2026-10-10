import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { LANGS, loadPhraseData, openApp, phraseFull, phraseTiles, readMeta, readSpoken, type Lang } from './fixtures';

const CONTENT = join(import.meta.dirname, '..', '..', 'src', 'content');

/** Узел выбора «яблоки или картошка» в миссии рынка главы I: задание и две верные фразы. */
function buyNode(lang: Lang) {
  const m = (JSON.parse(readFileSync(join(CONTENT, lang, 'missions', 'market.json'), 'utf8')).missions as { id: string; nodes: Record<string, { task: string; branches: { phrase: string }[] }> }[]).find((x) => x.id === 'ms:market.1')!;
  const phrases = new Map(loadPhraseData(lang, 'market').map((p) => [p.id, p]));
  const node = m.nodes.buy;
  return { task: node.task, options: node.branches.map((b) => phrases.get(b.phrase)!) };
}

/** Открыть миссию рынка и дойти до первого ответа героя. */
async function toBuy(page: Page) {
  await page.goto('./#/');
  await page.goto('./#/mission/ms:market.1');
  while (!(await page.getByText('Ответить жителю').count())) await page.getByTestId('scene-next').click();
  await page.getByTestId('scene-next').click();
  for (let i = 0; i < 10 && !(await page.getByTestId('hero-turn').count()); i++) await page.getByTestId('mission-next').click();
}

for (const lang of LANGS) {
  test.describe(lang, () => {
    test('выбор в миссии: после ошибки подсказка с обоими вариантами, в плитках герой сначала выбирает фразу', async ({ page }) => {
      await openApp(page, lang);
      const { task, options } = buyNode(lang);
      await toBuy(page);
      await expect(page.getByTestId('hero-task')).toHaveText(task);
      // Первое прохождение — выбор: ошибка показывает оба верных ответа.
      const own = options.map((p) => phraseFull(p.es));
      const turn = page.getByTestId('hero-turn');
      const texts = (await turn.locator('button').allTextContents()).map((t) => t.trim());
      await turn.getByRole('button', { name: texts.find((t) => !own.includes(t))!, exact: true }).click();
      const hint = page.getByTestId('hero-line').last();
      for (const o of own) await expect(hint).toContainText(o);

      // Второе прохождение — плитки: сначала «Что скажете?», потом плитки картошки.
      await toBuy(page);
      await expect(page.getByTestId('mission-tiles')).toHaveCount(0);
      await expect(page.getByTestId('choice-pick')).toHaveCount(2);
      await page.getByTestId('choice-pick').nth(1).click();
      await expect(page.getByTestId('choice-hint')).toContainText(options[1].ru);
      const tiles = page.getByTestId('mission-tiles').locator('button');
      for (const w of phraseTiles(options[1].es)) await tiles.filter({ hasText: new RegExp(`^${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }).and(page.locator(':enabled')).first().click();
      await turn.getByRole('button', { name: 'Сказать' }).click();
      await expect(page.getByTestId('hero-line').last()).toContainText(own[1]);
      await expect(page.getByTestId('hero-line').last()).not.toContainText('Правильно');
    });

    test('мужской голос выбирается в настройках: путник говорит им без понижения', async ({ page }) => {
      // Голоса системы: у телефона они есть, у браузера тестов — нет. Имена как у Google TTS на Android: пол по ним не угадать.
      const prefix = lang === 'es' ? 'es-es' : 'it-it';
      await page.addInitScript((p) => {
        const voices = [`${p}-x-aaa-local`, `${p}-x-zzz-local`].map((name) => ({ name, lang: p.toUpperCase().replace(/^(..)-/, (m) => m.toLowerCase()), voiceURI: name, localService: true, default: false }));
        Object.defineProperty(speechSynthesis, 'getVoices', { value: () => voices });
        // Простая фраза вместо SpeechSynthesisUtterance: ей можно присвоить голос-заглушку.
        (window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = class {
          text: string;
          constructor(t: string) {
            this.text = t;
          }
        };
      }, prefix);
      await openApp(page, lang);
      await page.goto('./#/settings/sound');
      await page.getByTestId('voice-m').selectOption(`${prefix}-x-zzz-local`);
      await expect.poll(async () => (await readMeta<{ voiceM: string }>(page, lang, 'settings'))?.voiceM).toBe(`${prefix}-x-zzz-local`);
      await page.goto('./#/settings/hero');
      await page.getByRole('button', { name: /Голос путника/ }).click();
      const last = (await readSpoken(page)).at(-1)!;
      expect(last.voice).toBe(`${prefix}-x-zzz-local`);
      expect(last.pitch).toBe(1);
      // Без выбора тот же путник звучит основным голосом, опущенным вниз.
      await page.goto('./#/settings/sound');
      await page.getByTestId('voice-m').selectOption('');
      await page.goto('./#/settings/hero');
      await page.getByRole('button', { name: /Голос путника/ }).click();
      expect((await readSpoken(page)).at(-1)!.pitch).toBeLessThan(1);
    });
  });
}
