import { expect, test, type Page } from '@playwright/test';
import { openApp } from './fixtures';

/**
 * Кэш курса (задача 20.4): в precache только оболочка, контент языка приложение докачивает в свой кэш. После
 * первой загрузки и после смены курса всё работает без сети; на нескачанный курс без сети не переключиться.
 */

async function courseReady(page: Page) {
  await page.goto('./#/settings/language');
  await expect(page.getByTestId('course-status')).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
}

/** Сколько файлов в кэше курса и сколько в списке его версии. */
async function cached(page: Page, lang: string) {
  return page.evaluate(async (lang) => {
    const cache = await caches.open(`eslacity-course-${lang}`);
    const keys = (await cache.keys()).map((r) => r.url);
    const meta = await caches.open('eslacity-course-meta');
    const lists = (await meta.keys()).map((r) => r.url).filter((u) => u.includes(`/course/${lang}-`));
    const list = lists.length ? ((await (await meta.match(lists[0]))!.json()) as { files: string[] }) : { files: [] };
    return { keys: keys.length, files: list.files.length, foreign: keys.filter((u) => !u.includes(`/assets/${lang}/`)).length };
  }, lang);
}

test('precache без контента языков, курс в своём кэше; смена курса без сети — только на скачанный', async ({ page, context }) => {
  test.setTimeout(120_000);
  await openApp(page, 'es');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));

  // Service worker кэширует заранее только оболочку: ни одного файла из папок языков.
  const sw = await (await page.request.get('./sw.js')).text();
  expect(sw).toContain('assets/index-');
  for (const lang of ['es', 'it', 'en', 'tr', 'pt']) expect(sw, lang).not.toContain(`assets/${lang}/`);

  await courseReady(page);
  const es = await cached(page, 'es');
  expect(es.files).toBeGreaterThan(100);
  expect(es).toEqual({ keys: es.files, files: es.files, foreign: 0 });

  // Смена курса при сети: итальянский докачивается целиком.
  await page.getByRole('button', { name: /Итальянский/ }).click();
  await expect(page.getByTestId('continue').or(page.getByTestId('prologue-skip'))).toBeVisible();
  if (await page.getByTestId('prologue-skip').count()) await page.getByTestId('prologue-skip').click();
  await courseReady(page);
  const it = await cached(page, 'it');
  expect(it.keys).toBe(it.files);

  // Без сети: итальянский открывается целиком, урок места и урок грамматики тоже.
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('course-status')).toHaveAttribute('data-state', 'ready');
  await page.goto('./#/loc/police');
  await expect(page.getByText('Уровень 1').first()).toBeVisible();
  await page.goto('./#/grammar/a1.02-essere');
  await expect(page.getByRole('button', { name: /к упражнениям/i })).toBeVisible();

  // Английский не скачан: без сети приложение не переключается и говорит, когда он скачается.
  await page.goto('./#/settings/language');
  await page.getByRole('button', { name: /Английский/ }).click();
  await expect(page.getByTestId('course-notice')).toHaveText('Курс скачается, когда появится интернет.');
  await expect(page.getByRole('button', { name: /Итальянский/ })).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => localStorage.getItem('eslacity.lang'))).toBe('it');

  // Испанский скачан раньше: на него можно и без сети.
  await page.getByRole('button', { name: /Испанский/ }).click();
  await expect(page.getByTestId('continue')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('eslacity.lang'))).toBe('es');
  await page.goto('./#/grammar/a1.02-ser');
  await expect(page.getByRole('button', { name: /к упражнениям/i })).toBeVisible();
});

test('курс не скачан, а сети нет — плашка над меню', async ({ page, context }) => {
  await openApp(page, 'es');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  // Сеть пропала раньше, чем курс докачался: удаляем его кэш и отметку, перезапускаем без сети.
  await courseReady(page);
  await page.evaluate(async () => {
    localStorage.removeItem('eslacity.course.es');
    const cache = await caches.open('eslacity-course-es');
    const keys = await cache.keys();
    // Оставляем то, что нужно для запуска, остальное — как будто не успело скачаться.
    for (const k of keys.filter((r) => /\/(airport|bank|beach)-/.test(r.url))) await cache.delete(k);
  });
  await context.setOffline(true);
  await page.goto('./#/');
  await page.reload();
  await expect(page.getByTestId('course-offline')).toContainText('Курс скачается, когда появится интернет.');
  await context.setOffline(false);
  await expect(page.getByTestId('course-offline')).toHaveCount(0, { timeout: 30_000 });
});
