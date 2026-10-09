import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { LANGS, openApp, playDispute, readMeta, type Lang, type Move } from './fixtures';

const CONTENT = join(import.meta.dirname, '..', '..', 'src', 'content');
type Line = { es: string; if?: { flag: string; is: string | null | (string | null)[] } };

const sceneLines = (lang: Lang, place: string, chapter = 5) =>
  (JSON.parse(readFileSync(join(CONTENT, lang, 'scenes', `${place}.json`), 'utf8')).scenes as { id: string; lines: Line[] }[]).find((s) => s.id === `sc:${place}.${chapter}`)!.lines;

/** Пройти сцену и собрать реплики, которые видел герой. */
async function readScene(page: Page, id: string): Promise<string[]> {
  await page.goto('./#/');
  await page.goto(`./#/scene/${encodeURIComponent(id)}`);
  const seen: string[] = [];
  for (let i = 0; i < 40; i++) {
    seen.push(((await page.getByTestId('scene-current').textContent()) ?? '').trim());
    const next = page.getByTestId('scene-next');
    if ((await next.textContent())?.includes('К вопросам')) return seen;
    await next.click();
  }
  throw new Error('Сцена не закончилась');
}

async function dispute(page: Page, lang: Lang, place: string, move: Move, mode: 'choose' | 'tiles') {
  await page.goto('./#/');
  await page.goto(`./#/mission/${encodeURIComponent(`ms:${place}.4`)}`);
  await playDispute(page, lang, place, move, mode);
  await expect(page.getByTestId('mission-result')).toBeVisible();
}

for (const lang of LANGS) {
  test.describe(lang, () => {
    test('выбор с последствиями: развилка в споре главы IV меняет сцену главы V и приставку к титулу', async ({ page }) => {
      test.setTimeout(180_000);
      await openApp(page, lang);
      const lines = sceneLines(lang, 'hotel');
      const conditional = lines.filter((l) => l.if);
      const line = (value: string) => conditional.find((l) => [l.if!.is].flat().includes(value))!.es;

      // До развилки сцена без реплик с условием.
      const before = await readScene(page, 'sc:hotel.5');
      expect(before.length).toBe(lines.length - conditional.length);
      for (const l of conditional) expect(before.some((t) => t.includes(l.es))).toBe(false);

      // Уступить директору отеля: номер Ивану не дают.
      await dispute(page, lang, 'hotel', 'concede', 'choose');
      expect(await readMeta(page, lang, 'story')).toEqual({ flags: { room: 'refused' }, moves: { room: 'concede' } });
      // Повторное прохождение другим ходом историю не переписывает.
      await dispute(page, lang, 'hotel', 'object', 'tiles');
      expect((await readMeta<{ flags: Record<string, string> }>(page, lang, 'story'))?.flags).toEqual({ room: 'refused' });

      const after = await readScene(page, 'sc:hotel.5');
      expect(after.length).toBe(before.length + 1);
      expect(after.some((t) => t.includes(line('refused')))).toBe(true);
      expect(after.some((t) => t.includes(line('room')))).toBe(false);

      // Одна развилка — ещё без приставки, две уступки — «Чуткий».
      await page.goto('./#/profile');
      await expect(page.getByTestId('hero-epithet')).toHaveCount(0);
      await dispute(page, lang, 'police', 'concede', 'choose');
      await page.goto('./#/profile');
      await expect(page.getByTestId('hero-title')).toHaveText(/^Чуткий /);
      await expect(page.getByTestId('hero-epithet')).toBeVisible();

      // Флаги переживают перезапуск.
      await page.reload();
      await expect(page.getByTestId('hero-title')).toHaveText(/^Чуткий /);
    });

    test('развилки ранних глав: выбор в миссии главы I меняет сцену главы II', async ({ page }) => {
      test.setTimeout(120_000);
      await openApp(page, lang);
      const conditional = sceneLines(lang, 'cafe', 2).filter((l) => l.if?.flag === 'drink');
      const line = (value: string) => conditional.find((l) => [l.if!.is].flat().includes(value))!.es;

      // Вторая ветка выбора — чай с молоком.
      await page.goto('./#/');
      await page.goto(`./#/mission/${encodeURIComponent('ms:cafe.1')}`);
      await playDispute(page, lang, 'cafe', 'object', 'choose', { chapter: 1, pick: 1 });
      expect(await readMeta(page, lang, 'story')).toEqual({ flags: { drink: 'tea' }, moves: {} });
      const seen = await readScene(page, 'sc:cafe.2');
      expect(seen.some((t) => t.includes(line('tea')))).toBe(true);
      expect(seen.some((t) => t.includes(line('coffee')))).toBe(false);
      // Без спора приставки к титулу нет.
      await page.goto('./#/profile');
      await expect(page.getByTestId('hero-epithet')).toHaveCount(0);
    });
  });
}
