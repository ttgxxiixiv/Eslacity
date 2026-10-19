import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { openCourse } from './fixtures';

// Португальский курс закрыт (задача 19.2): город и уроки ещё пишутся, Звонница уже есть.
const CONTENT = join(import.meta.dirname, '..', '..', 'src', 'content', 'pt');
const pairs = JSON.parse(readFileSync(join(CONTENT, 'pairs.json'), 'utf8')) as { ringer: { name: string }; contrasts: { id: string }[] };

test('pt: Звонница открывается напрямую, звонарь и все противопоставления на месте', async ({ page }) => {
  await openCourse(page, 'pt');
  await page.goto('./#/bells');
  await expect(page.getByTestId('bells-intro')).toBeVisible();
  await expect(page.getByText(pairs.ringer.name).first()).toBeVisible();
  for (const c of pairs.contrasts) await expect(page.getByTestId(`contrast-${c.id}`)).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('bells-start').click();
  const task = page.getByTestId('bells-task');
  await expect(task).toBeVisible();
  const heard = (await task.getAttribute('data-heard'))!;
  await page.getByTestId('bells-option').and(page.locator(`[data-word="${heard}"]`)).click();
  await expect(page.getByText('Верно!')).toBeVisible();
  await page.getByRole('button', { name: /Дальше/ }).click();
  await expect(page.getByTestId('bells-progress')).toHaveText(/^2 \//);
});
