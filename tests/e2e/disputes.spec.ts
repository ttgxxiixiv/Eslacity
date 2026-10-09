import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { LANGS, openApp, playDispute as play, readAnswers, type Lang, type Move } from './fixtures';

const CONTENT = join(import.meta.dirname, '..', '..', 'src', 'content');

/** Места, где есть миссия главы IV. */
const placesWithDispute = (lang: Lang) =>
  readdirSync(join(CONTENT, lang, 'missions'))
    .map((f) => f.replace(/\.json$/, ''))
    .filter((place) => (JSON.parse(readFileSync(join(CONTENT, lang, 'missions', `${place}.json`), 'utf8')).missions as { id: string }[]).some((m) => m.id === `ms:${place}.4`));

for (const lang of LANGS) {
  test.describe(lang, () => {
    test('спор в миссии главы IV: выбором — возразить, плитками — уступить, вводом — компромисс', async ({ page }) => {
      await openApp(page, lang);
      const plan: [Move, 'choose' | 'tiles' | 'type'][] = [['object', 'choose'], ['concede', 'tiles'], ['compromise', 'type']];
      for (const [move, mode] of plan) {
        await page.goto('./#/');
        await page.goto('./#/mission/ms%3Acafe.4');
        const r = await play(page, lang, 'cafe', move, mode);
        expect(r.disputes).toBe(1);
        await expect(page.getByTestId('mission-result')).toContainText(`Верных ответов: ${r.answers} из ${r.answers} (100%)`);
      }
      const log = (await readAnswers(page, lang)).filter((a) => a.itemId === 'ms:cafe.4');
      expect(new Set(log.map((a) => a.kind))).toEqual(new Set(['mission-choose', 'mission-tiles', 'mission-type']));
    });

    test('все споры контента: уступить и компромисс ведут к своим реакциям жителя', async ({ page }) => {
      test.setTimeout(480_000);
      await openApp(page, lang);
      for (const place of placesWithDispute(lang).filter((p) => p !== 'cafe')) {
        for (const move of ['concede', 'compromise'] as Move[]) {
          // Первое прохождение каждой миссии — выбор фразы; дальше плитки.
          await page.goto('./#/');
          await page.goto(`./#/mission/${encodeURIComponent(`ms:${place}.4`)}`);
          await play(page, lang, place, move, move === 'concede' ? 'choose' : 'tiles');
        }
      }
    });
  });
}
