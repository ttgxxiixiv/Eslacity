import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { openCourse, phraseFull } from './fixtures';

/**
 * Турецкий курс закрыт (задача 18.5): сцены и миссии открываются напрямую, без пролога и города.
 * Каждая сцена и каждая миссия проходится целиком, как в scenes.spec.ts и missions.spec.ts.
 */
const CONTENT = join(import.meta.dirname, '..', '..', 'src', 'content', 'tr');
type Cond = { flag: string; is: string | null | (string | null)[] };
type Line = { es: string; if?: Cond };
type SceneData = { id: string; mode?: string; lines: Line[]; questions: { q: string; options: string[]; answer: number }[] };
type Node = { kind: 'say' } | { kind: 'answer'; task: string; branches: { phrase: string }[] };

const files = (dir: string) => readdirSync(join(CONTENT, dir)).filter((f) => f.endsWith('.json') && f !== 'thread.json');
const read = (dir: string, f: string) => JSON.parse(readFileSync(join(CONTENT, dir, f), 'utf8'));
const allScenes = files('scenes').flatMap((f) => read('scenes', f).scenes as SceneData[]);
const scenes = allScenes.filter((sc) => sc.mode !== 'overhear');
const missions = files('missions').flatMap((f) => (read('missions', f).missions as { id: string; nodes: Record<string, Node> }[]).map((m) => ({ ...m, place: f.replace(/\.json$/, '') })));
const phrases = new Map<string, string>(files('phrases').flatMap((f) => (read('phrases', f).phrases as { id: string; es: string }[]).map((p) => [p.id, phraseFull(p.es)])));

/** Пройти сцену: реплики по порядку (с флагами из `flags`), все ответы верные. */
async function playScene(page: Page, sc: SceneData, flags: Record<string, string> = {}) {
  await page.goto(`./#/scene/${encodeURIComponent(sc.id)}`);
  const lines = sc.lines.filter((l) => !l.if || [l.if.is].flat().includes(flags[l.if.flag] ?? null));
  for (const l of lines) {
    await expect(page.getByTestId('scene-current'), sc.id).toContainText(l.es);
    await page.getByTestId('scene-next').click();
  }
  for (const q of sc.questions) {
    await expect(page.getByTestId('scene-question')).toHaveText(q.q);
    await page.getByRole('button', { name: q.options[q.answer], exact: true }).click();
    await page.getByRole('button', { name: /дальше|итог/i }).click();
  }
  await expect(page.getByTestId('scene-result'), sc.id).toContainText(`Понято: ${sc.questions.length} из ${sc.questions.length}`);
}

/** Пройти миссию выбором фраз: в развилке — ветка `pick` (номер), иначе первая. */
async function playMission(page: Page, id: string, pick: Record<string, number> = {}) {
  const m = missions.find((x) => x.id === id)!;
  const answers = Object.values(m.nodes).filter((n): n is Extract<Node, { kind: 'answer' }> => n.kind === 'answer');
  await page.goto(`./#/mission/${encodeURIComponent(id)}`);
  while (!(await page.getByText('Ответить жителю').count())) await page.getByTestId('scene-next').click();
  await page.getByTestId('scene-next').click();
  for (let i = 0; i < 60; i++) {
    if (await page.getByTestId('mission-result').count()) break;
    if (await page.getByTestId('hero-turn').count()) {
      const task = ((await page.getByTestId('hero-task').textContent()) ?? '').trim();
      const node = answers.find((a) => a.task === task)!;
      const right = phrases.get(node.branches[pick[task] ?? 0].phrase)!;
      await page.getByTestId('hero-turn').getByRole('button', { name: right, exact: true }).click();
      continue;
    }
    await page.getByTestId('mission-next').click();
  }
  await expect(page.getByTestId('mission-result'), id).toContainText(`Верных ответов: ${answers.length} из ${answers.length} (100%)`);
}

test('tr: все сцены контента — реплики по порядку и все ответы верные', async ({ page }) => {
  test.setTimeout(240_000);
  await openCourse(page, 'tr');
  for (const sc of scenes) await playScene(page, sc);
});

test('tr: все миссии контента проходятся выбором без ошибок', async ({ page }) => {
  test.setTimeout(600_000);
  await openCourse(page, 'tr');
  for (const m of missions) await playMission(page, m.id);
});

test('tr: развилка чайной — Хасан-уста помнит, что герой пил кофе', async ({ page }) => {
  await openCourse(page, 'tr');
  await playMission(page, 'ms:cafe.1', { 'Закажите чай или кофе.': 1 });
  const sc = scenes.find((s) => s.id === 'sc:cafe.2')!;
  // Реплика с условием «кофе» звучит, «чай» — нет: playScene идёт по репликам с флагом drink = coffee.
  await playScene(page, sc, { drink: 'coffee' });
  expect(sc.lines.some((l) => l.if?.is === 'coffee' && l.es.includes('her zamanki kahven'))).toBe(true);
});

test('tr: развилка базара — тётушка Фатма спрашивает про картошку', async ({ page }) => {
  await openCourse(page, 'tr');
  await playMission(page, 'ms:market.1', { 'Попросите килограмм яблок или два килограмма картошки.': 1 });
  const sc = scenes.find((s) => s.id === 'sc:market.2')!;
  await playScene(page, sc, { basket: 'potatoes' });
  expect(sc.lines.some((l) => l.if?.is === 'potatoes' && l.es.includes('Patateslerim'))).toBe(true);
});

test('tr: развилка больницы — доктор Гюль сравнивает перелом Керема с бедой героя', async ({ page }) => {
  await openCourse(page, 'tr');
  await playMission(page, 'ms:hospital.1', { 'Скажите, что у вас, кажется, сломана рука или что у вас болит сердце.': 1 });
  const sc = scenes.find((s) => s.id === 'sc:hospital.2')!;
  await playScene(page, sc, { injury: 'heart' });
  expect(sc.lines.some((l) => l.if?.is === 'heart' && l.es.includes('kalbiniz'))).toBe(true);
});
