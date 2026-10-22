import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { LANGS, openApp } from './fixtures';

/** Загрузка и переходы (задача 14.6): ожидание вместо пустого экрана, предзагрузка урока, мягкое появление экранов. */

for (const lang of LANGS) {
  test.describe(lang, () => {
    test('медленный контент: на экране свиток ожидания, потом урок', async ({ page }) => {
      await openApp(page, lang);
      // Слова аэропорта ещё не грузились (здание закрыто): задерживаем их чанк.
      let release!: () => void;
      const held = new Promise<void>((r) => (release = r));
      await page.route(/\/assets\/airport-[^/]+\.js$/, async (route) => {
        await held;
        await route.continue();
      });
      await page.goto('./#/learn/airport/1/0');
      const loading = page.getByTestId('loading');
      await expect(loading).toBeVisible();
      await expect(loading).toHaveAttribute('role', 'status');
      await expect(loading).toContainText('Летописец');
      release();
      await expect(loading).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Выйти из урока' })).toBeVisible();
    });

    test('главная заранее грузит следующий урок грамматики', async ({ page }) => {
      const asked: string[] = [];
      page.on('request', (r) => asked.push(r.url()));
      await openApp(page, lang);
      await expect.poll(() => asked.some((u) => u.includes(`grammar-${lang}-a1`)), { timeout: 5000 }).toBe(true);
    });

    test('экран проявляется, при «меньше движения» — сразу', async ({ page }) => {
      await openApp(page, lang, '/profile');
      // Профиль — свой чанк (16.2): ждём сам экран, а не экран ожидания.
      await expect(page.getByTestId('profile-path')).toBeVisible();
      const anim = () => page.locator('.screen-in', { has: page.getByTestId('profile-path') }).evaluate((el) => getComputedStyle(el).animationName);
      await expect.poll(anim).toBe('screen-in');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await expect.poll(anim).toBe('none');
    });
  });
}

test('главный чанк меньше 350 КБ, экраны и индекс слов — своими чанками (задача 16.2)', () => {
  const assets = join(import.meta.dirname, '..', '..', 'dist', 'assets');
  const files = readdirSync(assets);
  const main = files.find((f) => /^index-.*\.js$/.test(f))!;
  expect(statSync(join(assets, main)).size).toBeLessThan(350 * 1024);
  // В главном чанке нет списка изменений и индексов слов обоих языков.
  const code = readFileSync(join(assets, main), 'utf8');
  expect(code).not.toContain('Карта города на главной теперь в той же рамке');
  expect(files.some((f) => /^changelog-.*\.js$/.test(f))).toBe(true);
  expect(files.filter((f) => /^(es|it)-.*\.js$/.test(f))).toHaveLength(2);
});

/** Входной чанк и все, что `index.html` грузит заранее (`modulepreload`): то, что браузер скачивает при запуске. */
function startupChunks(): { name: string; code: string }[] {
  const dist = join(import.meta.dirname, '..', '..', 'dist');
  const html = readFileSync(join(dist, 'index.html'), 'utf8');
  const names = [...html.matchAll(/<(?:script[^>]+src|link rel="modulepreload"[^>]+href)="\.\/(assets\/[^"]+\.js)"/g)].map((m) => m[1]);
  return [...new Set(names)].map((name) => ({ name, code: readFileSync(join(dist, name), 'utf8') }));
}

test('при запуске грузится не больше 1000 КБ JS, тексты курсов — только своим чанком (задача 20.3)', () => {
  const chunks = startupChunks();
  expect(chunks.length).toBeGreaterThan(10);
  const total = chunks.reduce((s, c) => s + Buffer.byteLength(c.code), 0);
  expect(total).toBeLessThan(1000 * 1024);
  // Жители, стражи и пролог ни одного языка не лежат в стартовых чанках: их грузит `core-<язык>` языка курса.
  const content = join(import.meta.dirname, '..', '..', 'src', 'content');
  const code = chunks.map((c) => c.code).join('\n');
  const read = (lang: string, file: string) => JSON.parse(readFileSync(join(content, lang, file), 'utf8'));
  for (const lang of ['es', 'it', 'en', 'tr', 'pt']) {
    const texts: string[] = [
      (read(lang, 'prologue.json') as { gate: { es: string }[] }).gate[0].es,
      (read(lang, 'guardians.json') as { guardians: { greeting: { es: string } }[] }).guardians[0].greeting.es,
      (read(lang, 'diary.json') as { entries: { ru: string }[] }).entries[0].ru,
    ];
    for (const text of texts) expect(code.includes(JSON.stringify(text).slice(1, -1)), `${lang}: ${text}`).toBe(false);
  }
  const assets = readdirSync(join(import.meta.dirname, '..', '..', 'dist', 'assets'));
  expect(assets.filter((f) => /^core-(es|it|en|tr|pt)-.*\.js$/.test(f))).toHaveLength(5);
});
