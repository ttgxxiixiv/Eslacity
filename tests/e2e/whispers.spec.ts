import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { DB, LANGS, openApp, readAnswers, type Lang } from './fixtures';

const CONTENT = join(import.meta.dirname, '..', '..', 'src', 'content');

interface Whisper {
  id: string;
  mode?: string;
  lines: { who: string; es: string; ru: string }[];
  questions: { q: string; options: string[]; answer: number }[];
}
interface Npc {
  id: string;
  location: string;
  name: string;
  voice: { pitch: number };
}

function whispersOf(lang: Lang): Whisper[] {
  return readdirSync(join(CONTENT, lang, 'scenes'))
    .filter((f) => f.endsWith('.json'))
    .flatMap((f) => JSON.parse(readFileSync(join(CONTENT, lang, 'scenes', f), 'utf8')).scenes as Whisper[])
    .filter((sc) => sc.mode === 'overhear');
}
const npcsOf = (lang: Lang): Npc[] => JSON.parse(readFileSync(join(CONTENT, lang, 'npcs.json'), 'utf8')).npcs;

/** Кафе построено, открыта глава `opened`, при `mute` звук на час выключен («Не могу слушать»). */
async function seed(page: Page, lang: Lang, opened: number, mute = false) {
  await page.evaluate(
    ({ db, opened, mute }) =>
      new Promise<void>((resolve, reject) => {
        const r = indexedDB.open(db);
        r.onerror = () => reject(r.error);
        r.onsuccess = () => {
          const tx = r.result.transaction(['buildings', 'meta'], 'readwrite');
          tx.objectStore('buildings').put({ locationId: 'cafe', level: 1, lastCollectedAt: Date.now() });
          tx.objectStore('meta').put({ key: 'journey', value: { fragments: {}, seals: {}, openedChapter: opened, celebrated: opened } });
          if (mute) tx.objectStore('meta').put({ key: 'settings', value: { listenOffUntil: Date.now() + 3_600_000 } });
          tx.oncomplete = () => resolve();
        };
      }),
    { db: DB[lang], opened, mute },
  );
  await page.goto('./#/');
  await page.reload();
  await expect(page.getByTestId('continue')).toBeVisible();
}

/** Озвучка с высотой голоса: реплика и pitch каждого произнесённого. */
const trackPitch = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __said: string[]; __pitch: number[] };
    w.__pitch = [];
    speechSynthesis.speak = (u: SpeechSynthesisUtterance) => {
      w.__said.push(u.text);
      w.__pitch.push(u.pitch);
    };
  });
const said = (page: Page) => page.evaluate(() => (window as unknown as { __said: string[] }).__said);
const pitches = (page: Page) => page.evaluate(() => (window as unknown as { __pitch: number[] }).__pitch);

async function answerAll(page: Page, wh: Whisper) {
  for (const q of wh.questions) {
    await expect(page.getByTestId('scene-question')).toHaveText(q.q);
    await page.getByRole('button', { name: q.options[q.answer], exact: true }).click();
    await page.getByRole('button', { name: /дальше|итог/i }).click();
  }
  await expect(page.getByTestId('scene-result'), wh.id).toContainText(`Понято: ${wh.questions.length} из ${wh.questions.length}`);
}

for (const lang of LANGS) {
  test.describe(lang, () => {
    const all = whispersOf(lang);
    const npcs = npcsOf(lang);
    const byId = Object.fromEntries(npcs.map((n) => [n.id, n]));
    const cafe = all.find((w) => w.id === 'wh:cafe.4')!;
    const resident = npcs.find((n) => n.location === 'cafe')!;
    const speaker = (who: string) => (who === 'npc' ? resident : byId[who]);

    test('шёпот в кафе: закрыт до главы IV, два голоса, текст скрыт до вопросов, потом расшифровка', async ({ page }) => {
      expect(cafe).toBeTruthy();
      await openApp(page, lang);
      await seed(page, lang, 3);
      await page.goto('./#/loc/cafe');
      await expect(page.getByTestId('scene-link').first()).toBeVisible();
      await expect(page.getByTestId('whisper-link')).toHaveCount(0);

      await seed(page, lang, 4);
      await page.goto('./#/loc/cafe');
      const other = speaker(cafe.lines.find((l) => l.who !== 'npc')!.who);
      await expect(page.getByTestId('whisper-link')).toContainText(`${resident.name} и ${other.name}`);
      // Шёпот не попадает в обычные разговоры места.
      await expect(page.getByTestId('scene-link')).toHaveCount(3);
      await trackPitch(page);
      await page.getByTestId('whisper-link').click();
      await expect(page).toHaveURL(/#\/scene\/wh%3Acafe\.4$/);

      for (let i = 0; i < cafe.lines.length; i++) {
        const line = cafe.lines[i];
        await expect(page.getByText(`Реплика ${i + 1} из ${cafe.lines.length}`)).toBeVisible();
        await expect(page.getByTestId('whisper-speaker')).toContainText(speaker(line.who).name);
        await expect.poll(() => said(page)).toContain(line.es);
        // Слов разговора на экране нет.
        await expect(page.getByText(line.es)).toHaveCount(0);
        await expect(page.getByTestId('whisper-text')).toHaveCount(0);
        if (i === 0) {
          const before = (await said(page)).length;
          await page.getByTestId('scene-again').click();
          await expect.poll(async () => (await said(page)).length).toBe(before + 1);
        }
        await page.getByTestId('scene-next').click();
      }
      // Два голоса разной высоты: у каждой реплики голос своего жителя.
      const heard = await pitches(page);
      expect(new Set(heard).size).toBe(2);
      expect(heard[0]).toBeCloseTo(speaker(cafe.lines[0].who).voice.pitch, 5);

      await answerAll(page, cafe);
      await page.getByRole('button', { name: 'Расшифровка' }).click();
      const transcript = page.getByTestId('whisper-transcript');
      for (const l of cafe.lines) {
        await expect(transcript).toContainText(l.es);
        await expect(transcript).toContainText(l.ru);
      }
      const log = (await readAnswers(page, lang)).filter((a) => a.itemId === cafe.id);
      expect(log.map((a) => a.kind)).toEqual(cafe.questions.map(() => 'listen-whisper'));
      await page.getByRole('button', { name: 'Готово' }).click();
      await expect(page).toHaveURL(/#\/loc\/cafe$/);
    });

    test('без звука реплики шёпота видны текстом', async ({ page }) => {
      await openApp(page, lang);
      await seed(page, lang, 4, true);
      await page.goto(`./#/scene/${encodeURIComponent(cafe.id)}`);
      await expect(page.getByTestId('whisper-text')).toHaveText(cafe.lines[0].es);
      await page.getByTestId('scene-next').click();
      await expect(page.getByTestId('whisper-text')).toHaveText(cafe.lines[1].es);
    });

    test('все шёпоты контента: разные голоса, все ответы верные', async ({ page }) => {
      test.setTimeout(240_000);
      expect(all.length).toBeGreaterThanOrEqual(5);
      await openApp(page, lang);
      for (const wh of all) {
        const place = wh.id.replace(/^wh:/, '').split('.')[0];
        const pair = [...new Set(wh.lines.map((l) => (l.who === 'npc' ? npcs.find((n) => n.location === place)! : byId[l.who])))];
        expect(pair, wh.id).toHaveLength(2);
        expect(pair[0].voice.pitch, wh.id).not.toBe(pair[1].voice.pitch);
        await page.goto(`./#/scene/${encodeURIComponent(wh.id)}`);
        for (let i = 0; i < wh.lines.length; i++) {
          await expect(page.getByText(`Реплика ${i + 1} из ${wh.lines.length}`), wh.id).toBeVisible();
          await page.getByTestId('scene-next').click();
        }
        await answerAll(page, wh);
      }
    });
  });
}
