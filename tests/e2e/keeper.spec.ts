import { expect, test, type Page } from '@playwright/test';
import { DB, LANGS, openApp, readMeta, skipPrologue, type Lang } from './fixtures';

const OTHER: Record<Lang, Lang> = { es: 'it', it: 'es' };
const FLAG: Record<Lang, string> = { es: '🇪🇸', it: '🇮🇹' };
const WORDS: Record<Lang, string[]> = { es: ['bank.banco', 'bank.dinero', 'cafe.te'], it: ['bank.banca', 'bank.soldi', 'cafe.te'] };

/**
 * Эликсир выпит. Карточки повторены `ago` дней назад с интервалом `interval` (свежие — сила около 100%,
 * давние с коротким интервалом — сила падает). `streak` — столько прошлых дней подряд сила была выше 90%.
 */
async function seedKeeper(page: Page, lang: Lang, o: { ago: number; interval: number; streak: number }) {
  await page.evaluate(
    ({ db, ids, o }) =>
      new Promise<void>((resolve, reject) => {
        const key = (ts: number) => {
          const d = new Date(ts);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        };
        const now = Date.now();
        const reviewed = now - o.ago * 86_400_000;
        const days = Object.fromEntries(Array.from({ length: o.streak }, (_, i) => [key(now - (i + 1) * 86_400_000), 0.95]));
        const r = indexedDB.open(db);
        r.onerror = () => reject(r.error);
        r.onsuccess = () => {
          const tx = r.result.transaction(['cards', 'meta'], 'readwrite');
          for (const id of ids) {
            tx.objectStore('cards').put({ wordId: id, ef: 2.5, interval: o.interval, reps: 3, due: 99999, lapses: 0, learnedAt: reviewed, lastReviewedAt: reviewed });
          }
          tx.objectStore('meta').put({ key: 'journey', value: { fragments: {}, seals: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 }, openedChapter: 5, celebrated: 5 } });
          tx.objectStore('meta').put({
            key: 'sphinx',
            value: { visited: 1, hearts: 3, rounds: { hear: 1, word: 1, wisdom: 1 }, attempts: {}, done: 1, elixir: now - 86_400_000 },
          });
          tx.objectStore('meta').put({ key: 'keeper', value: { days } });
          tx.oncomplete = () => resolve();
        };
      }),
    { db: DB[lang], ids: WORDS[lang], o },
  );
  await page.goto('./#/');
  await page.reload();
}

const pct = async (page: Page) => Number(((await page.getByTestId('elixir-pct').textContent()) ?? '').replace('%', ''));

for (const lang of LANGS) {
  test.describe(lang, () => {
    test('сила Эликсира высокая: день засчитан, на тридцатый день подряд — титул «Хранитель языка»', async ({ page }) => {
      await openApp(page, lang);
      await seedKeeper(page, lang, { ago: 0, interval: 30, streak: 3 });
      await page.goto('./#/vault');
      expect(await pct(page)).toBeGreaterThanOrEqual(90);
      // Три прошлых дня и сегодняшний замер при запуске.
      await expect(page.getByTestId('keeper-streak')).toContainText('4 из 30');
      await expect(page.getByTestId('vault-hero-title')).toHaveText('Мудрец');

      await seedKeeper(page, lang, { ago: 0, interval: 30, streak: 29 });
      await page.goto('./#/vault');
      await expect(page.getByTestId('keeper-title')).toContainText('Хранитель языка');
      await expect(page.getByTestId('vault-hero-title')).toHaveText('Хранитель языка');
      await expect.poll(async () => (await readMeta<{ title?: number }>(page, lang, 'keeper'))?.title).toBeGreaterThan(0);
      await page.goto('./#/');
      await expect(page.getByTestId('level-badge')).toHaveAttribute('aria-label', /^Хранитель языка, уровень/);
    });

    test('сила упала: серия не растёт, но полученный титул остаётся', async ({ page }) => {
      await openApp(page, lang);
      await seedKeeper(page, lang, { ago: 120, interval: 1, streak: 5 });
      await page.goto('./#/vault');
      expect(await pct(page)).toBeLessThan(90);
      // Прошлые пять дней есть, сегодня сила ниже порога, но день не кончился.
      await expect(page.getByTestId('keeper-streak')).toContainText('5 из 30');
      await page.getByTestId('keeper-errands').click();
      await expect(page).toHaveURL(/#\/errands/);

      // Титул уже был: слабая сила его не отнимает.
      await page.evaluate(
        ({ db }) =>
          new Promise<void>((resolve) => {
            const r = indexedDB.open(db);
            r.onsuccess = () => {
              const tx = r.result.transaction(['meta'], 'readwrite');
              tx.objectStore('meta').put({ key: 'keeper', value: { days: {}, title: Date.now() - 10 * 86_400_000 } });
              tx.oncomplete = () => resolve();
            };
          }),
        { db: DB[lang] },
      );
      await page.reload();
      await page.goto('./#/vault');
      await expect(page.getByTestId('keeper-title')).toBeVisible();
      await expect(page.getByTestId('vault-hero-title')).toHaveText('Хранитель языка');
    });

    test('второй язык: переход из Хранилища, в его профиле виден «Мудрец» первого', async ({ page }) => {
      await openApp(page, lang);
      // В профиле первого языка чужого «Мудреца» нет, и база второго языка от этого не создаётся.
      await page.goto('./#/profile');
      await expect(page.getByTestId('best-medals')).toBeVisible();
      await expect(page.getByTestId('sage-elsewhere')).toHaveCount(0);
      const dbs = await page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name));
      expect(dbs).not.toContain(DB[OTHER[lang]]);

      await seedKeeper(page, lang, { ago: 0, interval: 30, streak: 0 });
      await page.goto('./#/vault');
      await page.getByTestId(`start-${OTHER[lang]}`).click();
      // Новый курс начинается с пролога.
      await skipPrologue(page);
      expect(await page.evaluate(() => localStorage.getItem('eslacity.lang'))).toBe(OTHER[lang]);
      await page.goto('./#/profile');
      await expect(page.getByTestId('sage-elsewhere')).toContainText(`Мудрец ${FLAG[lang]}`);
    });
  });
}
