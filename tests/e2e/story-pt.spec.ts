import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { openCourse, phraseFull } from './fixtures';

/**
 * Португальский курс закрыт (задачи 19.5–19.7): сцены и миссии открываются напрямую, без пролога и города.
 * Каждая сцена и каждая миссия проходится целиком, как в scenes.spec.ts и missions.spec.ts.
 */
const CONTENT = join(import.meta.dirname, '..', '..', 'src', 'content', 'pt');
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

test('pt: все сцены контента — реплики по порядку и все ответы верные', async ({ page }) => {
  test.setTimeout(540_000);
  await openCourse(page, 'pt');
  for (const sc of scenes) await playScene(page, sc);
});

test('pt: все миссии контента проходятся выбором без ошибок', async ({ page }) => {
  test.setTimeout(900_000);
  await openCourse(page, 'pt');
  for (const m of missions) await playMission(page, m.id);
});

test('pt: развилка кафе — Сеу Тоньо помнит, что герой пил сок', async ({ page }) => {
  await openCourse(page, 'pt');
  await playMission(page, 'ms:cafe.1', { 'Закажите кофе или апельсиновый сок.': 1 });
  const sc = scenes.find((s) => s.id === 'sc:cafe.2')!;
  // Реплика с условием «сок» звучит, «кофе» — нет: playScene идёт по репликам с флагом drink = juice.
  await playScene(page, sc, { drink: 'juice' });
  expect(sc.lines.some((l) => l.if?.is === 'juice' && l.es.includes('suco de laranja'))).toBe(true);
});

test('pt: развилка рынка — Дона Граса спрашивает про картошку', async ({ page }) => {
  await openCourse(page, 'pt');
  await playMission(page, 'ms:market.1', { 'Попросите килограмм бананов или два килограмма картошки.': 1 });
  const sc = scenes.find((s) => s.id === 'sc:market.2')!;
  await playScene(page, sc, { basket: 'potatoes' });
  expect(sc.lines.some((l) => l.if?.is === 'potatoes' && l.es.includes('minhas batatas'))).toBe(true);
});

test('pt: развилка больницы — доктор Фернанда сравнивает перелом Каю с бедой героя', async ({ page }) => {
  await openCourse(page, 'pt');
  await playMission(page, 'ms:hospital.1', { 'Скажите, что у вас болит голова или сердце.': 1 });
  const sc = scenes.find((s) => s.id === 'sc:hospital.2')!;
  await playScene(page, sc, { injury: 'heart' });
  expect(sc.lines.some((l) => l.if?.is === 'heart' && l.es.includes('o seu coração'))).toBe(true);
});

test('pt: развилка кафе главы II — Сеу Тоньо угощал Северину, как хотел угостить герой', async ({ page }) => {
  await openCourse(page, 'pt');
  await playMission(page, 'ms:cafe.2', { 'Попросите счёт или скажите, что сегодня угощаете вы.': 1 });
  const sc = scenes.find((s) => s.id === 'sc:cafe.3')!;
  await playScene(page, sc, { treat: 'host' });
  expect(sc.lines.some((l) => l.if?.is === 'host' && l.es.includes('quem convidou fui eu'))).toBe(true);
});

test('pt: развилка рынка главы II — Дона Граса спрашивает про чеснок', async ({ page }) => {
  await openCourse(page, 'pt');
  await playMission(page, 'ms:market.2', { 'Попросите килограмм моркови или спросите, есть ли чеснок.': 1 });
  const sc = scenes.find((s) => s.id === 'sc:market.3')!;
  await playScene(page, sc, { veg: 'garlic' });
  expect(sc.lines.some((l) => l.if?.is === 'garlic' && l.es.includes('cheiro de alho'))).toBe(true);
});

const whispers = allScenes.filter((sc) => sc.mode === 'overhear');

test('pt: все шёпоты главы IV — реплики голосом, все ответы на понимание верные', async ({ page }) => {
  test.setTimeout(240_000);
  expect(whispers).toHaveLength(20);
  await openCourse(page, 'pt');
  for (const wh of whispers) {
    await page.goto(`./#/scene/${encodeURIComponent(wh.id)}`);
    for (let i = 0; i < wh.lines.length; i++) {
      await expect(page.getByText(`Реплика ${i + 1} из ${wh.lines.length}`), wh.id).toBeVisible();
      await page.getByTestId('scene-next').click();
    }
    for (const q of wh.questions) {
      await expect(page.getByTestId('scene-question')).toHaveText(q.q);
      await page.getByRole('button', { name: q.options[q.answer], exact: true }).click();
      await page.getByRole('button', { name: /дальше|итог/i }).click();
    }
    await expect(page.getByTestId('scene-result'), wh.id).toContainText(`Понято: ${wh.questions.length} из ${wh.questions.length}`);
  }
});

test('pt: развилка рынка главы III — Дона Граса помнит, что герой брал бананы', async ({ page }) => {
  await openCourse(page, 'pt');
  await playMission(page, 'ms:market.3', { 'Спросите, есть ли сегодня кешью, или попросите килограмм бананов.': 1 });
  const sc = scenes.find((s) => s.id === 'sc:market.4')!;
  await playScene(page, sc, { fruit: 'banana' });
  expect(sc.lines.some((l) => l.if?.is === 'banana' && l.es.includes('levou banana'))).toBe(true);
});

test('pt: развилка вокзала главы III — Сеу Раймунду помнит билет в одну сторону', async ({ page }) => {
  await openCourse(page, 'pt');
  await playMission(page, 'ms:station.3', { 'Попросите билет в одну сторону или туда и обратно.': 0 });
  const sc = scenes.find((s) => s.id === 'sc:station.4')!;
  await playScene(page, sc, { ticket: 'oneway' });
  expect(sc.lines.some((l) => l.if?.is === 'oneway' && l.es.includes('só de ida'))).toBe(true);
});

test('pt: спор в миссии главы IV — можно уступить или предложить компромисс', async ({ page }) => {
  await openCourse(page, 'pt');
  await playMission(page, 'ms:cafe.4', { 'Возразите, уступите или предложите компромисс.': 1 });
  await playMission(page, 'ms:market.4', { 'Возразите, уступите или предложите компромисс.': 2 });
});
