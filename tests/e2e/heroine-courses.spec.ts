import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import type { PrologueFile } from '../../src/content/schema';
import { loadWords, openCourse, type Lang } from './fixtures';

/**
 * Род путницы в прологе и у Сфинкса (задача 20.2): поле `fem` у реплик пролога, вариантов ответа и монологов
 * загадки слуха. Португальская путница отвечает «Obrigada», турецкому Летописцу и жителю кафе она «пришла».
 */
const CONTENT = join(import.meta.dirname, '..', '..', 'src', 'content');
const DBS = { tr: 'eslacity-tr', pt: 'eslacity-pt' } as const;
type Course = keyof typeof DBS;
const prologueOf = (lang: Course): PrologueFile => JSON.parse(readFileSync(join(CONTENT, lang, 'prologue.json'), 'utf8'));

/** Курс открыт без пролога, путница выбрана в настройках. */
async function heroine(page: Page, lang: Course) {
  await openCourse(page, lang);
  await page.addInitScript(() => {
    const w = window as unknown as { __said: string[] };
    w.__said = [];
    speechSynthesis.speak = (u: SpeechSynthesisUtterance) => {
      w.__said.push(u.text);
    };
  });
  await page.goto('./#/settings/hero');
  await page.getByTestId('hero-gender-f').click();
  await expect(page.getByTestId('hero-gender-f')).toHaveAttribute('aria-checked', 'true');
}

/** Пролог до ответов жителю кафе: ворота, три слова, дорога. */
async function toCafe(page: Page, lang: Course) {
  const p = prologueOf(lang);
  const words = loadWords(lang as unknown as Lang).byId;
  const pro = page.getByTestId('prologue');
  await page.goto('./#/');
  await expect(pro).toHaveAttribute('data-step', 'gate');
  for (let i = 0; i < p.gate.length; i++) await page.getByTestId('prologue-next').click();
  for (let guard = 0; guard < 10 && (await pro.getAttribute('data-step')) === 'words'; guard++) {
    const id = (await page.getByTestId('prologue-word').getAttribute('data-word'))!;
    await page.getByTestId('prologue-next').click();
    await page.getByTestId('prologue-meaning').filter({ hasText: words.get(id)!.ru }).first().click();
    await page.getByTestId('prologue-next').click();
  }
  await expect(pro).toHaveAttribute('data-step', 'road');
  for (let i = 0; i < p.road.length; i++) await page.getByTestId('prologue-next').click();
  await expect(pro).toHaveAttribute('data-step', 'mission');
}

test('pt: путница учит «obrigada» у ворот и отвечает так в кафе', async ({ page }) => {
  await heroine(page, 'pt');
  await page.goto('./#/');
  const lines = page.getByTestId('prologue-line');
  await page.getByTestId('prologue-next').click();
  await expect(lines.nth(1)).toContainText('se é mulher, «obrigada»');
  await page.getByTestId('prologue-next').click();
  await expect(lines.nth(2)).toContainText('Olá! Obrigada!');
  // Уйти с пролога и вернуться: он начнётся с ворот.
  await page.goto('./#/settings');
  await toCafe(page, 'pt');
  const options = page.getByTestId('prologue-option');
  await expect(options.filter({ hasText: /^Obrigada$/ })).toHaveCount(1);
  await expect(options.filter({ hasText: /^Obrigado$/ })).toHaveCount(0);
  // Второй вопрос — кофе: верный ответ «Obrigada», он и звучит голосом путницы.
  await page.locator('[data-testid="prologue-option"][data-right="true"]').click();
  await page.getByTestId('prologue-next').click();
  await page.locator('[data-testid="prologue-option"][data-right="true"]').click();
  await expect(page.getByTestId('prologue-mission')).toContainText('Obrigada');
  expect(await page.evaluate(() => (window as unknown as { __said: string[] }).__said)).toContain('Obrigada');
});

test('tr: житель кафе говорит путнице «ты же только пришла»', async ({ page }) => {
  await heroine(page, 'tr');
  await toCafe(page, 'tr');
  await page.locator('[data-testid="prologue-option"][data-right="false"]').first().click();
  await page.getByTestId('prologue-mission').getByText(/Ты же никуда не уходишь/).waitFor();
  await expect(page.getByTestId('prologue-mission')).toContainText('только пришла');
  await expect(page.getByTestId('prologue-mission')).not.toContainText('только пришёл');
});

test('pt: в загадке слуха Сфинкс говорит о путнице в женском роде', async ({ page }) => {
  await heroine(page, 'pt');
  // Печать главы V и одна прежняя попытка загадки слуха: второй набор, где житель говорит «essa aí tem paciência».
  await page.evaluate(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const r = indexedDB.open(db);
        r.onerror = () => reject(r.error);
        r.onsuccess = () => {
          const tx = r.result.transaction(['meta'], 'readwrite');
          tx.objectStore('meta').put({ key: 'journey', value: { fragments: {}, seals: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 }, openedChapter: 5, celebrated: 5 } });
          tx.objectStore('meta').put({ key: 'sphinx', value: { hearts: 3, rounds: {}, attempts: { hear: 1 } } });
          tx.oncomplete = () => resolve();
        };
      }),
    DBS.pt,
  );
  await page.reload();
  await page.getByTestId('hero-gender-f').click();
  await expect(page.getByTestId('hero-gender-f')).toHaveAttribute('aria-checked', 'true');
  await page.goto('./#/sphinx');
  await page.getByTestId('sphinx-start').click();
  await page.getByTestId('sphinx-begin').click();
  for (let n = 0; n < 12; n++) await page.getByTestId('sphinx-line-next').click();
  const said = await page.evaluate(() => (window as unknown as { __said: string[] }).__said.join('\n'));
  expect(said).toContain('essa aí tem paciência');
  expect(said).not.toContain('esse aí tem paciência');
});
