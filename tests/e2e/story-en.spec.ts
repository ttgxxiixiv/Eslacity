import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { openEnglish, phraseFull } from './fixtures';

/**
 * Английский курс закрыт (задача 17.5): сцены и миссии открываются напрямую, без пролога и города.
 * Каждая сцена и каждая миссия проходится целиком, как в scenes.spec.ts и missions.spec.ts.
 */
const CONTENT = join(import.meta.dirname, '..', '..', 'src', 'content', 'en');
type Cond = { flag: string; is: string | null | (string | null)[] };
type Line = { es: string; if?: Cond };
type SceneData = { id: string; mode?: string; lines: Line[]; questions: { q: string; options: string[]; answer: number }[] };
type Node = { kind: 'say' } | { kind: 'answer'; task: string; branches: { phrase: string }[] };

const files = (dir: string) => readdirSync(join(CONTENT, dir)).filter((f) => f.endsWith('.json') && f !== 'thread.json');
const read = (dir: string, f: string) => JSON.parse(readFileSync(join(CONTENT, dir, f), 'utf8'));
const allScenes = files('scenes').flatMap((f) => read('scenes', f).scenes as SceneData[]);
const scenes = allScenes.filter((sc) => sc.mode !== 'overhear');
const whispers = allScenes.filter((sc) => sc.mode === 'overhear');
const missions = files('missions').flatMap((f) => (read('missions', f).missions as { id: string; nodes: Record<string, Node> }[]).map((m) => ({ ...m, place: f.replace(/\.json$/, '') })));
const phrases = new Map<string, string>(files('phrases').flatMap((f) => (read('phrases', f).phrases as { id: string; es: string }[]).map((p) => [p.id, phraseFull(p.es)])));

/**
 * Записать значения в meta базы английского курса. Сначала приложение должно запуститься: при старте оно само
 * записывает путь в базу и затёрло бы запись теста. Главная нового игрока уводит в пролог, поэтому ждём экран настроек.
 */
async function putMeta(page: Page, values: Record<string, unknown>) {
  await page.goto('./#/settings');
  await expect(page.getByRole('heading', { name: 'Настройки' })).toBeVisible();
  await page.evaluate(
    (values) =>
      new Promise<void>((resolve) => {
        // База создаётся при запуске приложения: ждём, пока в ней появится таблица meta.
        const attempt = () => {
          const r = indexedDB.open('eslacity-en');
          r.onsuccess = () => {
            if (!r.result.objectStoreNames.contains('meta')) {
              r.result.close();
              setTimeout(attempt, 100);
              return;
            }
            const tx = r.result.transaction(['meta'], 'readwrite');
            for (const [key, value] of Object.entries(values)) tx.objectStore('meta').put({ key, value });
            tx.oncomplete = () => resolve();
          };
        };
        attempt();
      }),
    values,
  );
  await page.reload();
}

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

test('en: все сцены контента — реплики по порядку и все ответы верные', async ({ page }) => {
  test.setTimeout(240_000);
  await openEnglish(page);
  for (const sc of scenes) await playScene(page, sc);
});

test('en: все сцены нити глав — Летописец, реплики по порядку и все ответы верные', async ({ page }) => {
  test.setTimeout(240_000);
  await openEnglish(page);
  const thread = read('scenes', 'thread.json') as { scenes: SceneData[]; notes: Record<string, unknown[]> };
  expect(thread.scenes).toHaveLength(15);
  for (const sc of thread.scenes) await playScene(page, sc);
});

test('en: пролог — ворота, три слова, кафе, обрывок пролога, потом главная', async ({ page }) => {
  const p = read('.', 'prologue.json') as { gate: unknown[]; road: unknown[]; words: string[]; mission: { say: { es: string }; wrong: { es: string } }[] };
  const ru = new Map<string, string>(
    [...files('words').map((f) => read('words', f)), ...readdirSync(join(CONTENT, 'scrolls')).map((f) => read('scrolls', f))].flatMap((d: { words: { id: string; ru: string }[] }) =>
      d.words.map((w) => [w.id, w.ru] as [string, string]),
    ),
  );
  await openEnglish(page);
  await page.goto('./');
  const pro = page.getByTestId('prologue');
  await expect(pro).toHaveAttribute('data-step', 'gate');
  for (let i = 0; i < p.gate.length; i++) await page.getByTestId('prologue-next').click();
  await expect(pro).toHaveAttribute('data-step', 'words');
  for (let guard = 0; guard < 10 && (await pro.getAttribute('data-step')) === 'words'; guard++) {
    const id = (await page.getByTestId('prologue-word').getAttribute('data-word'))!;
    await page.getByTestId('prologue-next').click();
    await page.getByTestId('prologue-meaning').filter({ hasText: ru.get(id)! }).first().click();
    await expect(page.getByTestId('prologue-verdict')).toHaveAttribute('data-verdict', 'correct');
    await page.getByTestId('prologue-next').click();
  }
  await expect(pro).toHaveAttribute('data-step', 'road');
  for (let i = 0; i < p.road.length; i++) await page.getByTestId('prologue-next').click();
  await expect(pro).toHaveAttribute('data-step', 'mission');
  for (let i = 0; i < p.mission.length; i++) {
    await expect(page.getByTestId('prologue-mission')).toContainText(p.mission[i].say.es);
    await page.locator('[data-testid="prologue-option"][data-right="false"]').first().click();
    await expect(page.getByTestId('prologue-mission')).toContainText(p.mission[i].wrong.es);
    await page.locator('[data-testid="prologue-option"][data-right="true"]').click();
    await page.getByTestId('prologue-next').click();
  }
  await expect(pro).toHaveAttribute('data-step', 'shard');
  await expect(page.getByTestId('prologue-shard')).toContainText('Обрывок пролога');
  await page.getByTestId('prologue-home').click();
  await expect(page.getByTestId('continue')).toBeVisible();
  await expect(page.getByTestId('review-card')).toBeVisible();
});

test('en: все миссии контента проходятся выбором без ошибок', async ({ page }) => {
  test.setTimeout(600_000);
  await openEnglish(page);
  for (const m of missions) await playMission(page, m.id);
});

test('en: развилка кафе — Молли помнит, что герой пил чай', async ({ page }) => {
  await openEnglish(page);
  await playMission(page, 'ms:cafe.1', { 'Закажите кофе или чай с молоком.': 1 });
  const sc = scenes.find((s) => s.id === 'sc:cafe.2')!;
  // Реплика с условием «чай» звучит, «кофе» — нет: playScene идёт по репликам с флагом drink = tea.
  await playScene(page, sc, { drink: 'tea' });
  expect(sc.lines.some((l) => l.if?.is === 'tea' && l.es.includes('your usual tea'))).toBe(true);
});

test('en: развилка главы II — Молли в главе III вспоминает, что герой хотел её угостить', async ({ page }) => {
  await openEnglish(page);
  await playMission(page, 'ms:cafe.2', { 'Попросите счёт или скажите, что сегодня угощаете вы.': 1 });
  const sc = scenes.find((s) => s.id === 'sc:cafe.3')!;
  await playScene(page, sc, { treat: 'treat' });
  expect(sc.lines.some((l) => l.if?.is === 'treat' && l.es.includes('like you wanted to treat me'))).toBe(true);
});

test('en: все шёпоты главы IV — реплики голосом, все ответы на понимание верные', async ({ page }) => {
  test.setTimeout(240_000);
  expect(whispers).toHaveLength(20);
  await openEnglish(page);
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

test('en: развилка главы III — Грэм помнит, что герой брал билет туда и обратно', async ({ page }) => {
  await openEnglish(page);
  await playMission(page, 'ms:station.3', { 'Попросите билет на лунный поезд: в одну сторону или туда и обратно.': 1 });
  const sc = scenes.find((s) => s.id === 'sc:station.4')!;
  await playScene(page, sc, { ticket: 'round' });
  expect(sc.lines.some((l) => l.if?.is === 'round' && l.es.includes('You asked for a return'))).toBe(true);
});

test('en: спор в миссии главы IV — можно уступить или предложить компромисс', async ({ page }) => {
  await openEnglish(page);
  await playMission(page, 'ms:cafe.4', { 'Возразите, уступите или предложите компромисс.': 1 });
  await playMission(page, 'ms:market.4', { 'Возразите, уступите или предложите компромисс.': 2 });
});

test('en: развилка главы IV — инспектор помнит, чем кончилось дело Освальда', async ({ page }) => {
  await openEnglish(page);
  await playMission(page, 'ms:police.4', { 'Возразите, уступите или предложите компромисс.': 2 });
  const sc = scenes.find((s) => s.id === 'sc:police.5')!;
  await playScene(page, sc, { fine: 'work' });
  expect(sc.lines.some((l) => l.if?.is === 'work' && l.es.includes('blue hands'))).toBe(true);
});

test('en: записка Молли — образец находит все пункты проверки', async ({ page }) => {
  const note = (read('.', 'letters.json').notes as { id: string; sample: string; must: unknown[] }[]).find((n) => n.id === 'nt:cafe')!;
  await openEnglish(page);
  // Записки открываются с главы II: глава открыта в базе английского курса.
  await putMeta(page, { journey: { fragments: {}, seals: {}, openedChapter: 2, celebrated: 2 } });
  await page.goto(`./#/note/${encodeURIComponent(note.id)}`);
  await page.getByTestId('note-text').fill(note.sample);
  await page.getByRole('button', { name: 'Проверить' }).click();
  const items = page.getByTestId('note-must');
  await expect(items).toHaveCount(note.must.length);
  for (let i = 0; i < note.must.length; i++) await expect(items.nth(i)).toHaveAttribute('data-ok', 'true');
});

test('en: дневник путника — записи главы I открывают Летопись, слухи и дослушанный разговор', async ({ page }) => {
  type Entry = { id: string; chapter: number; from: string; es: string };
  const entries = (read('.', 'diary.json').entries as Entry[]).filter((e) => e.chapter === 1);
  const rumors = read('.', 'rumors.json').rumors as { id: string }[];
  expect(rumors).toHaveLength(20);
  await openEnglish(page);
  await putMeta(page, {
    thread: { seen: Object.fromEntries(entries.filter((e) => e.from.startsWith('th:')).map((e) => [e.from, 1])) },
    rumors: { got: entries.filter((e) => e.from.startsWith('rm:')).map((e) => e.from) },
  });
  await page.goto('./#/diary');
  const known = entries.filter((e) => !e.from.startsWith('sc:'));
  await expect(page.getByTestId('diary-progress')).toContainText(`Записано ${known.length} из ${entries.length}`);
  for (const e of known) await expect(page.locator(`[data-testid=diary-entry][data-id="${e.id}"]`).getByTestId('diary-quote')).toHaveText(e.es);

  // Разговор дослушан до вопросов — его запись открыта.
  const talk = entries.find((e) => e.from.startsWith('sc:'))!;
  await page.goto(`./#/scene/${encodeURIComponent(talk.from)}`);
  for (let i = 0; i < 40 && !((await page.getByTestId('scene-next').textContent()) ?? '').includes('К вопросам'); i++) await page.getByTestId('scene-next').click();
  await page.getByTestId('scene-next').click();
  await expect(page.getByTestId('scene-question')).toBeVisible();
  await page.goto('./#/diary');
  await expect(page.locator(`[data-testid=diary-entry][data-id="${talk.id}"]`)).toHaveAttribute('data-open', 'true');
});

test('en: книги Летописца — все 20 текстов открыты по обрывкам, вопросы проходятся, слово книги — в мои слова', async ({ page }) => {
  test.setTimeout(240_000);
  type BookData = { words: { id: string; es: string; ru: string; forms: string[] }[]; books: { id: string; title: { es: string }; questions: { q: string; options: string[]; answer: number }[] }[] };
  const places = files('words').map((f) => f.replace(/\.json$/, ''));
  const fragments = Object.fromEntries([1, 2, 3, 4, 5].flatMap((c) => places.map((p) => [`${c}:${p}`, 1])));
  await openEnglish(page);
  await putMeta(page, { journey: { fragments, seals: { 1: 1, 2: 1, 3: 1, 4: 1 }, openedChapter: 5, celebrated: 5 } });
  for (const chapter of [1, 2, 3, 4, 5]) {
    const data = read('books', `${chapter}.json`) as BookData;
    expect(data.books).toHaveLength(4);
    for (const b of data.books) {
      // Экран книги тот же: без перезагрузки он остался бы на итоге прошлого текста.
      await page.goto('./#/book/' + encodeURIComponent(b.id));
      await page.reload();
      await expect(page.getByTestId('book-title'), b.id).toHaveText(b.title.es);
      await page.getByTestId('book-quiz').click();
      for (const q of b.questions) {
        await expect(page.getByTestId('scene-question')).toHaveText(q.q);
        await page.getByRole('button', { name: q.options[q.answer], exact: true }).click();
        await page.getByRole('button', { name: /дальше|итог/i }).click();
      }
      await expect(page.getByTestId('scene-result'), b.id).toContainText(`Понято: ${b.questions.length} из ${b.questions.length}`);
    }
  }
  // Слово словарика главы I: нажать в тексте и добавить в мои слова.
  const word = (read('books', '1.json') as BookData).words[0];
  await page.goto('./#/book/' + encodeURIComponent('book:1.4'));
  await page.reload();
  await page.getByTestId('book-text').getByRole('button', { name: word.forms[0], exact: true }).first().click();
  await expect(page.getByTestId('book-word')).toContainText(`${word.es} — ${word.ru}`);
  await page.getByTestId('book-add-word').click();
  await expect(page.getByTestId('book-word-mine')).toBeVisible();
});

for (const [id, day] of [
  ['bonfire', new Date(2026, 10, 5, 18)],
  ['carnival', new Date(2026, 7, 30, 12)],
] as const) {
  test(`en: праздник ${id} — неделя идёт, миссия хозяина проходится, тайная медаль`, async ({ page }) => {
    const data = read('festivals', `${id}.json`) as { phrases: { id: string; es: string }[]; missions: { nodes: Record<string, Node> }[] };
    const own = new Map(data.phrases.map((p) => [p.id, phraseFull(p.es)]));
    const answers = Object.values(data.missions[0].nodes).filter((n): n is Extract<Node, { kind: 'answer' }> => n.kind === 'answer');
    await page.clock.install({ time: day });
    await openEnglish(page);
    await page.goto(`./#/festival/${id}`);
    await expect(page.getByTestId('festival-when')).toContainText('Праздник идёт');
    await page.getByTestId('festival-mission').click();
    for (let i = 0; i < 60 && !(await page.getByTestId('mission-result').count()); i++) {
      if (await page.getByTestId('hero-turn').count()) {
        const task = ((await page.getByTestId('hero-task').textContent()) ?? '').trim();
        const node = answers.find((a) => a.task === task)!;
        await page.getByTestId('hero-turn').getByRole('button', { name: own.get(node.branches[0].phrase)!, exact: true }).click();
        continue;
      }
      await page.getByTestId('mission-next').click();
    }
    await expect(page.getByTestId('mission-result')).toContainText(`Верных ответов: ${answers.length} из ${answers.length} (100%)`);
    await page.getByRole('button', { name: 'Готово' }).click();
    await expect(page.getByTestId('festival-medal')).toContainText('получена');
  });
}

test('en: свой медальон в меню и рисованные портреты жителей', async ({ page }) => {
  await openEnglish(page);
  await page.goto('./#/grammar');
  await expect(page.getByTestId('nav-eye')).toHaveAttribute('src', /eye-en(?!-gold)/);
  await page.goto(`./#/scene/${encodeURIComponent('sc:cafe.1')}`);
  await expect(page.getByTestId('npc-art').first()).toHaveAttribute('src', /molly/);
});
