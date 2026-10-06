import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { LANGS, openApp } from './fixtures';

const CONTENT = join(import.meta.dirname, '..', '..', 'src', 'content');
const said = (page: Page) => page.evaluate(() => (window as unknown as { __said: string[] }).__said);
const played = (page: Page) => page.evaluate(() => (window as unknown as { __played: string[] }).__played);

/** Запуски записи считаются: проигрывание своей записи проверяется по вызову play() у <audio>. */
async function watchPlay(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __played: string[] };
    w.__played = [];
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      w.__played.push(this.src);
      return Promise.resolve();
    };
  });
}

// Поддельный микрофон Chromium: тон вместо голоса, разрешение без окна.
test.use({ launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] }, permissions: ['microphone'] });

test.describe('микрофон есть', () => {
  for (const lang of LANGS) {
    test(`${lang}: повторить за жителем в сцене — запись, себя, житель и себя подряд; во фразе — запись`, async ({ page }) => {
      const scene = JSON.parse(readFileSync(join(CONTENT, lang, 'scenes', 'cafe.json'), 'utf8')).scenes[0] as { lines: { es: string }[] };
      await watchPlay(page);
      await openApp(page, lang, '/scene/sc%3Acafe.1');
      await expect(page.getByTestId('scene-current')).toContainText(scene.lines[0].es);

      await page.getByTestId('repeat-record').click();
      await expect(page.getByTestId('repeat-stop')).toBeVisible();
      await page.waitForTimeout(600);
      await page.getByTestId('repeat-stop').click();
      await expect(page.getByTestId('repeat-mine')).toBeVisible();
      await expect(page.getByTestId('repeat-audio')).toHaveAttribute('src', /^blob:/);

      await page.getByTestId('repeat-mine').click();
      await expect.poll(async () => (await played(page)).length).toBe(1);

      // «Оба»: сначала реплика жителя, потом своя запись.
      const before = (await said(page)).length;
      await page.getByTestId('repeat-both').click();
      await expect.poll(async () => (await said(page)).length).toBe(before + 1);
      expect((await said(page)).at(-1)).toContain(scene.lines[0].es.split(' ')[0].replace(/[¡¿]/g, ''));
      await expect.poll(async () => (await played(page)).length, { timeout: 15_000 }).toBe(2);

      // Следующая реплика — запись прежней пропадает.
      await page.getByTestId('scene-next').click();
      await expect(page.getByTestId('repeat-record')).toBeVisible();
      await expect(page.getByTestId('repeat-audio')).toHaveCount(0);

      // Новая фраза в уроке «Как здесь говорят».
      await page.goto('./#/phrases/cafe/1');
      await expect(page.getByTestId('phrase-text')).toBeVisible();
      await page.getByTestId('repeat-record').click();
      await page.waitForTimeout(400);
      await page.getByTestId('repeat-stop').click();
      await expect(page.getByTestId('repeat-mine')).toBeVisible();
    });
  }
});

test.describe('без записи', () => {
  for (const lang of LANGS) {
    test(`${lang}: без MediaRecorder кнопки «Повторить» нет, сцена проходится`, async ({ page }) => {
      await page.addInitScript(() => {
        delete (window as unknown as { MediaRecorder?: unknown }).MediaRecorder;
      });
      await openApp(page, lang, '/scene/sc%3Acafe.1');
      await expect(page.getByTestId('scene-current')).toBeVisible();
      await expect(page.getByTestId('repeat')).toHaveCount(0);
      await page.getByTestId('scene-next').click();
      await expect(page.getByTestId('scene-next')).toBeVisible();
    });

    test(`${lang}: доступ к микрофону запрещён — кнопка исчезает после отказа`, async ({ page }) => {
      await page.addInitScript(() => {
        navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('нет', 'NotAllowedError'));
      });
      await openApp(page, lang, '/scene/sc%3Acafe.1');
      await page.getByTestId('repeat-record').click();
      await expect(page.getByTestId('repeat')).toHaveCount(0);
    });
  }
});
