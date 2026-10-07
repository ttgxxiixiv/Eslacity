import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { LANGS, openApp, readMeta } from './fixtures';

const CONTENT = join(import.meta.dirname, '..', '..', 'src', 'content');

/** Звуки и темы, о которых сообщило приложение (`eslacity:sound`). */
async function listen(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __sounds: { sfx?: string; music?: string | null; track?: string }[] };
    w.__sounds = [];
    window.addEventListener('eslacity:sound', (e) => w.__sounds.push((e as CustomEvent).detail));
  });
}
const sounds = (page: Page) =>
  page.evaluate(() => (window as unknown as { __sounds: { sfx?: string; music?: string | null; track?: string }[] }).__sounds);
const lastMusic = async (page: Page) => (await sounds(page)).filter((s) => 'music' in s).at(-1)?.music;
const sfxCount = async (page: Page) => (await sounds(page)).filter((s) => s.sfx).length;

/**
 * Музыка и звуки (задача 13.3): тема города на главной (записанный трек), земля открытой главы на карте странствий, звук вердикта за
 * ответ; громкость 0 в настройках выключает и то и другое.
 */
for (const lang of LANGS) {
  test.describe(lang, () => {
    const scene = JSON.parse(readFileSync(join(CONTENT, lang, 'scenes', 'cafe.json'), 'utf8')).scenes[0] as {
      id: string;
      lines: unknown[];
      questions: { options: string[]; answer: number }[];
    };

    const answerFirst = async (page: Page, right: boolean) => {
      // Тот же адрес не перезагружает экран: сначала уходим со сцены.
      await page.goto('./#/');
      await page.goto(`./#/scene/${encodeURIComponent(scene.id)}`);
      for (let i = 0; i < scene.lines.length; i++) await page.getByTestId('scene-next').click();
      const q = scene.questions[0];
      await page.getByRole('button', { name: q.options[right ? q.answer : (q.answer + 1) % q.options.length], exact: true }).click();
    };

    test('тема города и земли, звук вердикта, выключение в настройках', async ({ page }) => {
      await listen(page);
      await openApp(page, lang);
      await expect.poll(() => lastMusic(page)).toBe('city');
      // У города записанный трек (public/music/city.ogg): он скачался, расшифровался и заиграл вместо нот.
      await expect.poll(async () => (await sounds(page)).some((s) => s.track === 'city')).toBe(true);
      await page.goto('./#/journey-map');
      await expect.poll(() => lastMusic(page)).toBe('land1');

      await answerFirst(page, true);
      await expect.poll(async () => (await sounds(page)).filter((s) => s.sfx).map((s) => s.sfx)).toEqual(['correct']);
      await answerFirst(page, false);
      await expect.poll(async () => (await sounds(page)).filter((s) => s.sfx).at(-1)?.sfx).toBe('wrong');

      // Громкость 0: музыка останавливается, звуков нет.
      await page.goto('./#/settings');
      await expect(page.getByTestId('sound-card')).toBeVisible();
      await page.getByTestId('music-volume').fill('0');
      await expect(page.getByTestId('sound-card')).toContainText('Музыка: выключено');
      await expect.poll(() => lastMusic(page)).toBeNull();
      await page.getByTestId('sfx-volume').fill('0');
      await expect(page.getByTestId('sound-card')).toContainText('Звуки: выключено');
      await expect.poll(async () => (await readMeta<{ sfxVolume: number; musicVolume: number }>(page, lang, 'settings'))).toMatchObject({ sfxVolume: 0, musicVolume: 0 });
      // После перезапуска громкость та же: ни музыки, ни звука за ответ.
      await page.goto('./#/');
      await page.reload();
      await expect(page.getByTestId('continue')).toBeVisible();
      await answerFirst(page, true);
      await page.goto('./#/journey-map');
      await expect(page.getByTestId('chronicle-link')).toBeVisible();
      expect(await sfxCount(page)).toBe(0);
      expect((await sounds(page)).filter((s) => s.music)).toEqual([]);
    });
  });
}
