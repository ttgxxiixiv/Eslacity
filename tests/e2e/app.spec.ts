import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { answerGrammar, DB, LANGS, loadLesson, openApp, playWords, readMeta, seedDueCards, seedXp, wordIdsOf, seedMissionsDone, seedTrialsDone, skipPrologue } from './fixtures';

test('переключение языка сохраняет прогресс каждого курса', async ({ page }) => {
  await openApp(page, 'es');
  await seedXp(page, 'es', 500);
  await page.goto('./#/profile');
  await expect(page.getByText('всего 500 XP')).toBeVisible();

  await page.goto('./#/settings');
  await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: /итальянский/i }).click()]);
  // Новый курс начинается с пролога.
  await skipPrologue(page);
  expect(await page.evaluate(() => localStorage.getItem('eslacity.lang'))).toBe('it');
  await page.goto('./#/profile');
  await expect(page.getByText('всего 0 XP')).toBeVisible();

  await page.goto('./#/settings');
  await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: /испанский/i }).click()]);
  await expect(page.getByTestId('continue')).toBeVisible();
  await page.goto('./#/profile');
  await expect(page.getByText('всего 500 XP')).toBeVisible();
});

for (const lang of LANGS) {
  test.describe(lang, () => {
    test('верхняя панель: серый огонёк до цели дня, полоска уровня под дорогой дня', async ({ page }) => {
      await openApp(page, lang);
      await expect(page.getByTestId('streak')).toHaveAttribute('data-lit', '0');
      await expect(page.getByTestId('level-bar')).toHaveAttribute('aria-valuenow', '0');
      await seedXp(page, lang, 150);
      // 150 XP: второй уровень и часть пути к третьему.
      await expect(page.getByTestId('level-bar')).toHaveAttribute('aria-label', /^До уровня 3:/);
      expect(Number(await page.getByTestId('level-bar').getAttribute('aria-valuenow'))).toBeGreaterThan(0);
      // Цель дня выполнена: огонёк загорается.
      await page.evaluate(
        (db) =>
          new Promise<void>((resolve) => {
            const r = indexedDB.open(db);
            r.onsuccess = () => {
              const d = new Date();
              const today = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
              const tx = r.result.transaction('meta', 'readwrite');
              tx.objectStore('meta').put({ key: 'motivation', value: { streak: { count: 1, best: 1, lastDay: today, freezes: 0, freezesUsed: 0 } } });
              tx.oncomplete = () => resolve();
            };
          }),
        DB[lang],
      );
      await page.reload();
      await expect(page.getByTestId('streak')).toHaveAttribute('data-lit', '1');
    });

    test('огонёк стрика загорается цветным после урока, который закрыл цель дня', async ({ page }) => {
      await openApp(page, lang);
      const flame = page.getByTestId('streak').locator('img');
      // В макете огонёк серый; горящий — отдельная цветная картинка.
      await expect(flame).toHaveAttribute('data-flame', 'grey');
      const grey = await flame.getAttribute('src');
      await seedXp(page, lang, 95);
      await page.goto('./#/learn/cafe/1/1');
      await playWords(page, lang, /урок пройден/i);
      await page.goto('./#/');
      await expect(page.getByTestId('streak')).toHaveAttribute('data-lit', '1');
      await expect(flame).toHaveAttribute('data-flame', 'lit');
      expect(await flame.getAttribute('src')).not.toBe(grey);
      // Дневной переход пройден: путник у привала, костёр горит, все фонари горят.
      await expect(page.getByTestId('daily-road')).toHaveAttribute('data-camp', '1');
      await expect(page.getByTestId('road-fire')).toHaveAttribute('data-lit', '1');
      await expect(page.getByTestId('daily-road').locator('[data-passed="1"]')).toHaveCount(4);
    });

    test('дневной переход: путник идёт по дороге, фонари загораются по пути, подсказка по нажатию', async ({ page }) => {
      await openApp(page, lang);
      const road = page.getByTestId('daily-road');
      await expect(road).toHaveAttribute('aria-valuenow', '0');
      await expect(road).toHaveAttribute('data-camp', '0');
      await expect(road.locator('[data-passed="1"]')).toHaveCount(0);
      // 45 XP из 100 за сегодня: два фонаря из четырёх горят, костёр не горит.
      await page.evaluate(
        (db) =>
          new Promise<void>((resolve) => {
            const r = indexedDB.open(db);
            r.onsuccess = () => {
              const d = new Date();
              const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
              const tx = r.result.transaction('days', 'readwrite');
              tx.objectStore('days').put({ date, xp: 45, newWords: 0, reviews: 0, lessons: 0, grammarLessons: 0 });
              tx.oncomplete = () => resolve();
            };
          }),
        DB[lang],
      );
      await page.reload();
      await expect(road).toHaveAttribute('aria-valuenow', '45');
      await expect(road.locator('[data-passed="1"]')).toHaveCount(2);
      await expect(page.getByTestId('road-fire')).toHaveAttribute('data-lit', '0');
      const walker = (await page.getByTestId('road-walker').boundingBox())!;
      const box = (await road.boundingBox())!;
      expect(walker.x + walker.width / 2).toBeGreaterThan(box.x + box.width * 0.3);
      expect(walker.x + walker.width / 2).toBeLessThan(box.x + box.width * 0.55);
      await road.click();
      await expect(page.getByTestId('road-tip')).toContainText('Дневной переход: 45 из 100 XP');
    });

    test('портрет в окне квеста заполняет окно и при вытянутой карточке', async ({ page }) => {
      await openApp(page, lang);
      const win = page.getByTestId('quest-window');
      const art = win.getByTestId('npc-art');
      for (const h of [130, 170]) {
        await page.addStyleTag({ content: `[data-testid=continue].quest-art{min-height:${h}px !important}` });
        const q = (await page.getByTestId('continue').boundingBox())!;
        const w = (await win.boundingBox())!;
        const a = (await art.boundingBox())!;
        // Окно — строки 59–180 картинки свитка высотой 228: доля высоты карточки.
        expect(Math.abs(w.y - q.y - (q.height * 59) / 228)).toBeLessThan(2);
        expect(Math.abs(w.height - (q.height * 121) / 228)).toBeLessThan(2);
        expect(Math.abs(a.height - w.height)).toBeLessThan(1);
        expect(Math.abs(a.y - w.y)).toBeLessThan(1);
      }
    });

    test('жители: портрет и приветствие в месте, фигурка у открытого здания', async ({ page }) => {
      const npcs = JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', 'src', 'content', lang, 'npcs.json'), 'utf8')).npcs as {
        name: string; location: string; greeting: { es: string; ru: string };
      }[];
      const cafe = npcs.find((n) => n.location === 'cafe')!;
      await openApp(page, lang);
      // Кафе открыто с начала — житель стоит у здания; рынок закрыт — там никого.
      await expect(page.getByTestId('npc-cafe')).toHaveCount(1);
      await expect(page.getByTestId('npc-market')).toHaveCount(0);

      await page.goto('./#/loc/cafe');
      const card = page.getByTestId('npc-card');
      await expect(card).toContainText(cafe.name);
      await expect(card).toContainText(cafe.greeting.ru);
      await expect(card.getByRole('img', { name: new RegExp(`^${cafe.name}`) })).toBeVisible();
      await card.getByRole('button', { name: /Послушать/ }).click();
      await expect.poll(() => page.evaluate(() => (window as unknown as { __said: string[] }).__said.at(-1))).toBe(cafe.greeting.es);
    });

    test('словарный запас в профиле: без фраз, закреплённые отдельно', async ({ page }) => {
      await openApp(page, lang);
      const words = JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', 'src', 'content', lang, 'words', 'cafe.json'), 'utf8'))
        .words as { id: string; pos: string; level: number }[];
      const taken = words.filter((w) => w.level <= 2);
      const plain = taken.filter((w) => w.pos !== 'phrase');
      expect(taken.length).toBeGreaterThan(plain.length);
      // Пять слов закреплены (интервал 30 дней), остальные только выучены; фразы тоже выучены, но не считаются.
      await page.evaluate(
        ({ db, rows }) =>
          new Promise<void>((resolve) => {
            const r = indexedDB.open(db);
            r.onsuccess = () => {
              const tx = r.result.transaction('cards', 'readwrite');
              for (const [id, interval] of rows) {
                tx.objectStore('cards').put({ wordId: id, ef: 2.5, interval, reps: 3, due: Date.now() + 86_400_000, lapses: 0, learnedAt: 1, lastReviewedAt: 1 });
              }
              tx.oncomplete = () => resolve();
            };
          }),
        { db: DB[lang], rows: taken.map((w) => [w.id, plain.slice(0, 5).includes(w) ? 30 : 1] as const) },
      );
      await page.reload();
      await expect(page.getByTestId('continue')).toBeVisible();
      await page.goto('./#/profile');
      await expect(page.getByTestId('vocab-text')).toContainText(`${plain.length} слов`);
      await expect(page.getByTestId('vocab-text')).toContainText('из них 5 закреплено');
      await expect(page.getByTestId('vocab-card').getByRole('progressbar')).toHaveAttribute('aria-valuenow', String(plain.length));
    });

    test('обрывок карты за слова главы в месте и медаль «Картограф»', async ({ page }) => {
      await openApp(page, lang);
      // Все слова уровней 1–2 кафе и половина рынка, миссия и испытание кафе пройдены: обрывок главы I только у кафе.
      await seedMissionsDone(page, lang, ['ms:cafe.1']);
      await seedTrialsDone(page, lang, ['tr:cafe.1']);
      const market = wordIdsOf(lang, 'market', [1, 2]);
      await seedDueCards(page, lang, [...wordIdsOf(lang, 'cafe', [1, 2]), ...market.slice(0, market.length / 2)]);
      await expect
        .poll(async () => Object.keys((await readMeta<{ fragments: Record<string, number> }>(page, lang, 'journey'))?.fragments ?? {}))
        .toEqual(['1:cafe']);
      await page.goto('./#/medals');
      const line = page.getByTestId('medals').locator('[data-line=cartographer]');
      await expect(line).toContainText('Дерево');
      await expect(line).toContainText('1 / 5 обрывков до камня');
      // Повторный запуск ничего не добавляет.
      await page.reload();
      await expect(line).toContainText('1 / 5 обрывков до камня');
    });

    test('нижнее меню: переходы и картинка своего языка', async ({ page }) => {
      await openApp(page, lang);
      await expect(page.getByTestId('nav-art')).toHaveAttribute('data-src', new RegExp(`nav-${lang}`));
      // Компактное меню (задача 14.2): ряд ячеек с медальоном не выше 12% экрана, ячейки во всю ширину ряда.
      const view = page.viewportSize()!;
      const box = (await page.getByTestId('nav-art').boundingBox())!;
      const eye = (await page.getByTestId('nav-art').locator('span').first().boundingBox())!;
      expect(box.y + box.height).toBeCloseTo(view.height, 0);
      expect(box.y + box.height - eye.y).toBeLessThanOrEqual(view.height * 0.12 + 1);
      expect(box.width).toBeGreaterThan(view.width * 0.9);
      for (const [label, hash] of [['Грамматика', '#/grammar'], ['Профиль', '#/profile'], ['Город', '#/']] as const) {
        await page.getByRole('link', { name: label, exact: true }).click();
        await expect(page).toHaveURL(new RegExp(`${hash.replace('/', '\\/')}$`));
      }
    });

    test('поздравление с новым уровнем', async ({ page }) => {
      await openApp(page, lang);
      await seedXp(page, lang, 92);
      const lesson = lang === 'es' ? loadLesson('es', 'a1', '02-ser') : loadLesson('it', 'a1', '02-essere');
      await page.goto(`./#/grammar/${lesson.id}`);
      await page.getByRole('button', { name: /к упражнениям/i }).click();
      // Два верных ответа по 5 XP: 92 → 102, это второй уровень.
      for (let i = 0; i < 2; i++) {
        await answerGrammar(page, lesson);
        if (i === 0) await page.getByRole('button', { name: /дальше/i }).click();
      }
      await expect(page.getByText('Новый уровень')).toBeVisible();
    });

    test('офлайн после первой загрузки', async ({ page, context }) => {
      await openApp(page, lang);
      await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
      await page.waitForTimeout(500);
      await context.setOffline(true);
      await page.reload();
      await expect(page.getByTestId('continue')).toBeVisible();
      // Слова и уроки грамматики лежат в отдельных чанках: они тоже должны быть в кэше.
      await page.goto('./#/loc/police');
      await expect(page.getByText('Уровень 1').first()).toBeVisible();
      // Урок B2 закрыт до главы IV, но экран с замком тоже грузит чанк урока.
      await page.goto(`./#/grammar/${lang === 'es' ? 'b2.20-marcadores' : 'b2.20-segnali-discorsivi'}`);
      await expect(page.getByTestId('district-lock')).toContainText('откроется в главе IV');
      await page.goto(`./#/grammar/${lang === 'es' ? 'a1.02-ser' : 'a1.02-essere'}`);
      await expect(page.getByRole('button', { name: /к упражнениям/i })).toBeVisible();
    });
  });
}
