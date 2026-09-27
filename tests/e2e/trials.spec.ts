import { expect, test, type Page } from '@playwright/test';
import {
  ADVERB, DB, exact, LANGS, loadPhraseData, loadWords, openApp, phraseFull, phraseTiles, readAnswers, readMeta, seedDueCards,
  seedMissionsDone, wordIdsOf, type Lang,
} from './fixtures';

/** Клавиши над полем в испытании: только буквы с ударением языка, без букв ответа. */
const EXAM_KEYS: Record<Lang, string[]> = { es: ['á', 'é', 'í', 'ó', 'ú', 'ü', 'ñ'], it: ['à', 'è', 'é', 'ì', 'ò', 'ù', "'"] };
const expectExamKeys = async (page: Page, lang: Lang) =>
  expect(await page.getByTestId('trial-run').locator('form button.w-11').allTextContents()).toEqual(EXAM_KEYS[lang]);

/**
 * Пройти испытание места. wrong — сколько первых заданий ответить неверно (ввод «xxx», в выборе — не тот вариант).
 * Возвращает, сколько было заданий с вводом.
 */
async function playTrial(page: Page, lang: Lang, place: string, wrong = 0): Promise<{ total: number; typed: number }> {
  const { byRu, byEs } = loadWords(lang);
  const phrases = loadPhraseData(lang, place);
  const run = page.getByTestId('trial-run');
  const label = run.locator('.text-sm.font-medium.text-stone-500').first();
  const said = () => page.evaluate(() => (window as unknown as { __said: string[] }).__said.at(-1) ?? '');
  let total = 0;
  let typed = 0;
  for (let i = 0; i < 20; i++) {
    if (await page.getByTestId('trial-result').count()) return { total, typed };
    const kind = (await label.textContent({ timeout: 3000 }).catch(() => null))?.trim();
    if (!kind) continue;
    const bad = total < wrong;
    total++;
    if (await run.getByTestId('phrase-prompt').count()) {
      const prompt = ((await run.getByTestId('phrase-prompt').textContent()) ?? '').trim();
      const p = phrases.find((x) => x.ru === prompt)!;
      if (kind === 'Соберите фразу из плиток') {
        const tiles = phraseTiles(p.es);
        for (const t of bad ? tiles.slice(1) : tiles) {
          await run.getByTestId('phrase-tiles').locator('button:not([disabled])').filter({ hasText: exact(t) }).first().click();
        }
        await page.getByRole('button', { name: 'Проверить' }).click();
      } else {
        typed++;
        await expectExamKeys(page, lang);
        await page.locator('input').fill(bad ? 'xxx' : phraseFull(p.es).replace("'", '’ '));
        await page.getByRole('button', { name: 'Проверить' }).click();
      }
    } else {
      const shown = ((await run.locator('.text-3xl.font-bold, .text-2xl.font-bold').first().textContent({ timeout: 3000 }).catch(() => '')) ?? '').trim();
      const options = run.locator('button.min-h-14');
      if (kind === `Как сказать ${ADVERB[lang]}?`) {
        const right = byRu.get(shown)!.es;
        await (bad ? options.filter({ hasNotText: exact(right) }) : options.filter({ hasText: exact(right) })).first().click();
      } else if (kind === 'Что вы услышали?') {
        await page.getByRole('button', { name: 'Прослушать ещё раз' }).click();
        const right = byEs.get(await said())!.ru;
        await (bad ? options.filter({ hasNotText: exact(right) }) : options.filter({ hasText: exact(right) })).first().click();
      } else if (kind === 'Соберите слово') {
        const w = byRu.get(shown)!;
        const m = w.es.match(/^(l'|el |la |los |las |il |lo |i |gli |le )(.*)$/);
        const [art, core] = m ? [m[1].trim(), m[2]] : [null, w.es];
        if (art) await page.locator('button.h-12.flex-1').filter({ hasText: exact(art) }).click();
        const letters = bad ? [...core].reverse() : [...core];
        for (const ch of letters) await page.locator('button.min-w-12:not([disabled])').filter({ hasText: exact(ch) }).first().click();
        await page.getByRole('button', { name: 'Проверить' }).click();
      } else if (kind === `Напишите ${ADVERB[lang]}` || kind === 'Напишите, что услышали') {
        typed++;
        await expectExamKeys(page, lang);
        let text = 'xxx';
        if (!bad && kind === 'Напишите, что услышали') {
          await page.getByRole('button', { name: 'Прослушать ещё раз' }).click();
          text = await said();
        } else if (!bad) text = byRu.get(shown)!.es.replace("'", '’ ');
        await page.locator('input').fill(text);
        await page.locator('button[type=submit]').click();
      } else {
        throw new Error(`Неизвестное задание испытания: «${kind}»`);
      }
    }
    const next = page.getByRole('button', { name: /дальше/i });
    await expect(next).toBeVisible();
    const fb = (await page.locator('[aria-live]').first().textContent()) ?? '';
    if (!bad && /неверно/i.test(fb)) throw new Error(`Правильный ответ не засчитан: «${kind}»: ${fb}`);
    await next.click();
  }
  throw new Error('Испытание не закончилось');
}

/** Выученные фразы уровней 1–2 места: чтобы в испытание попали и фразы. */
const phraseIds = (lang: Lang, place: string) => loadPhraseData(lang, place).filter((p) => p.level <= 2).map((p) => p.id);

for (const lang of LANGS) {
  test.describe(lang, () => {
    test('испытание кафе: откроется после слов, пройдено — обрывок карты, медаль «Испытатель»', async ({ page }) => {
      await openApp(page, lang, '/loc/cafe');
      const cafe = wordIdsOf(lang, 'cafe', [1, 2]);
      const link = page.getByTestId('trial-link');
      await expect(link).toContainText(`глава I · осталось ${cafe.length} слов`);
      await link.click();
      await expect(page.getByTestId('trial-state')).toContainText(`Сначала выучите слова главы: осталось ${cafe.length}.`);
      await expect(page.getByTestId('trial-start')).toHaveCount(0);

      // Слова и фразы выучены, миссия пройдена: обрывок ждёт только испытание.
      await page.goto('./#/');
      await seedMissionsDone(page, lang, ['ms:cafe.1']);
      await seedDueCards(page, lang, [...cafe, ...phraseIds(lang, 'cafe')]);
      await page.goto('./#/loc/cafe');
      await expect(link).toContainText('глава I · можно проходить');
      await link.click();
      await page.getByTestId('trial-start').click();
      await expect(page.getByTestId('trial-progress')).toHaveText('1 / 15');
      const { total, typed } = await playTrial(page, lang, 'cafe');
      expect(total).toBe(15);
      expect(typed).toBeGreaterThanOrEqual(8);
      const result = page.getByTestId('trial-result');
      await expect(result).toContainText('Испытание пройдено');
      await expect(result).toContainText('Верно: 15 из 15 (100%)');
      await expect(page.getByTestId('trial-reward')).toContainText('+40 🪙');
      await expect.poll(async () => Object.keys((await readMeta<{ fragments: Record<string, number> }>(page, lang, 'journey'))?.fragments ?? {})).toEqual(['1:cafe']);
      expect((await readMeta<Record<string, { done?: number }>>(page, lang, 'trials'))?.['tr:cafe.1']?.done).toBeGreaterThan(0);
      // Ответы в журнале под своим режимом, карточки повторения не тронуты.
      const log = (await readAnswers(page, lang)).filter((a) => a.mode === 'trial');
      expect(log).toHaveLength(15);
      await page.getByRole('button', { name: 'Готово' }).click();
      await expect(link).toContainText('глава I · ✓ пройдено');

      await page.goto('./#/medals');
      await expect(page.getByTestId('medals').locator('[data-line=trials]')).toContainText('1 / 5 испытаний до камня');
    });

    test('испытание не пройдено: обрывка нет, следующая попытка через сутки', async ({ page }) => {
      await openApp(page, lang);
      await seedMissionsDone(page, lang, ['ms:cafe.1']);
      await seedDueCards(page, lang, wordIdsOf(lang, 'cafe', [1, 2]));
      await page.goto('./#/trial/tr%3Acafe.1');
      await page.getByTestId('trial-start').click();
      // Четыре ошибки из пятнадцати: 73%, меньше порога.
      await playTrial(page, lang, 'cafe', 4);
      const result = page.getByTestId('trial-result');
      await expect(result).toContainText('Испытание не пройдено');
      await expect(result).toContainText('Верно: 11 из 15 (73%)');
      await expect(page.getByTestId('trial-reward')).toHaveCount(0);
      expect(Object.keys((await readMeta<{ fragments: Record<string, number> }>(page, lang, 'journey'))?.fragments ?? {})).toEqual([]);
      await page.getByRole('button', { name: 'Готово' }).click();
      await expect(page.getByTestId('trial-link')).toContainText('глава I · снова через 24 ч');
      await page.getByTestId('trial-link').click();
      await expect(page.getByTestId('trial-state')).toContainText('Следующая попытка через 24 ч');
      await expect(page.getByTestId('trial-start')).toHaveCount(0);

      // Сутки прошли: попытка снова доступна.
      await page.evaluate(
        (db) =>
          new Promise<void>((resolve) => {
            const r = indexedDB.open(db);
            r.onsuccess = () => {
              const tx = r.result.transaction('meta', 'readwrite');
              tx.objectStore('meta').put({ key: 'trials', value: { 'tr:cafe.1': { attempts: 1, best: 0.7, failedAt: Date.now() - 86_400_001 } } });
              tx.oncomplete = () => resolve();
            };
          }),
        DB[lang],
      );
      await page.reload();
      await expect(page.getByTestId('trial-start')).toBeVisible();
    });
  });
}
