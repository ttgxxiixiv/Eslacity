import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { DB, LANGS, loadPhraseData, openApp, phraseFull, readMeta, seedDueCards, wordIdsOf, type Lang } from './fixtures';

const CONTENT = join(import.meta.dirname, '..', '..', 'src', 'content');
type Node = { kind: 'say' } | { kind: 'answer'; task: string; branches: { phrase: string }[]; wrong: { es: string } };

function missionData(lang: Lang, place = 'cafe', id = `ms:${place}.1`) {
  const m = (JSON.parse(readFileSync(join(CONTENT, lang, 'missions', `${place}.json`), 'utf8')).missions as { id: string; nodes: Record<string, Node> }[]).find((x) => x.id === id)!;
  const answers = Object.values(m.nodes).filter((n): n is Extract<Node, { kind: 'answer' }> => n.kind === 'answer');
  const phrases = new Map(loadPhraseData(lang, place).map((p) => [p.id, p.es]));
  return { answers, phrases };
}

/** Все миссии контента языка: место и id. */
const allMissions = (lang: Lang) =>
  readdirSync(join(CONTENT, lang, 'missions'))
    .filter((f) => f.endsWith('.json'))
    .flatMap((f) => (JSON.parse(readFileSync(join(CONTENT, lang, 'missions', f), 'utf8')).missions as { id: string }[]).map((m) => ({ place: f.replace(/\.json$/, ''), id: m.id })));

/** Пройти сцену-вступление и диалог. wrongAt — номера ответов (с 0), где герой ошибается. */
async function playMission(page: Page, lang: Lang, wrongAt: number[] = [], place = 'cafe', id?: string) {
  const { answers, phrases } = missionData(lang, place, id);
  while (!(await page.getByText('Ответить жителю').count())) await page.getByTestId('scene-next').click();
  await page.getByTestId('scene-next').click();
  let n = 0;
  for (let i = 0; i < 60; i++) {
    if (await page.getByTestId('mission-result').count()) return;
    if (await page.getByTestId('hero-turn').count()) {
      const task = ((await page.getByTestId('hero-task').textContent()) ?? '').trim();
      const node = answers.find((a) => a.task === task)!;
      const right = phraseFull(phrases.get(node.branches[0].phrase)!);
      const turn = page.getByTestId('hero-turn');
      if (wrongAt.includes(n)) {
        const own = node.branches.map((b) => phraseFull(phrases.get(b.phrase)!));
        const texts = await turn.locator('button').allTextContents();
        await turn.getByRole('button', { name: texts.find((t) => !own.includes(t.trim()))!.trim(), exact: true }).click();
        await expect(page.getByTestId('npc-line').last()).toContainText(node.wrong.es);
        await expect(page.getByTestId('hero-line').last()).toContainText(`Правильно: ${right}`);
      } else {
        await turn.getByRole('button', { name: right, exact: true }).click();
      }
      n++;
      continue;
    }
    await page.getByTestId('mission-next').click();
  }
  throw new Error('Миссия не закончилась');
}

for (const lang of LANGS) {
  test.describe(lang, () => {
    test('миссия кафе: выбор фраз, награда, отношения и обрывок карты', async ({ page }) => {
      await openApp(page, lang);
      // Слова кафе выучены: обрывок ждёт только миссию.
      await seedDueCards(page, lang, wordIdsOf(lang, 'cafe', [1, 2]));
      await page.goto('./#/loc/cafe');
      await expect(page.getByTestId('mission-link')).toContainText('новая');
      await page.getByTestId('mission-link').click();
      await expect(page).toHaveURL(/#\/mission\/ms%3Acafe\.1$/);
      await playMission(page, lang);
      const { answers } = missionData(lang);
      await expect(page.getByTestId('mission-result')).toContainText('Миссия выполнена');
      await expect(page.getByTestId('mission-result')).toContainText(`Верных ответов: ${answers.length} из ${answers.length} (100%)`);
      await expect(page.getByTestId('mission-reward')).toContainText('+30 🪙');
      await expect(page.getByTestId('mission-result')).toContainText('Отношения стали ближе: Знакомый');
      expect((await readMeta<Record<string, { attempts: number; done?: number }>>(page, lang, 'missions'))?.['ms:cafe.1']).toMatchObject({ attempts: 1 });
      await expect.poll(async () => Object.keys((await readMeta<{ fragments: Record<string, number> }>(page, lang, 'journey'))?.fragments ?? {})).toEqual(['1:cafe']);
      await page.getByRole('button', { name: 'Готово' }).click();
      await expect(page.getByTestId('mission-link')).toContainText('✓ выполнена');
    });

    test('все миссии контента проходятся выбором без ошибок', async ({ page }) => {
      test.setTimeout(240_000);
      await openApp(page, lang);
      for (const { place, id } of allMissions(lang)) {
        await page.goto(`./#/mission/${encodeURIComponent(id)}`);
        await playMission(page, lang, [], place, id);
        const { answers } = missionData(lang, place, id);
        await expect(page.getByTestId('mission-result'), id).toContainText(`Верных ответов: ${answers.length} из ${answers.length} (100%)`);
      }
      const done = Object.keys((await readMeta<Record<string, unknown>>(page, lang, 'missions')) ?? {}).sort();
      expect(done).toEqual(allMissions(lang).map((m) => m.id).sort());
    });

    test('глава II открыта: в кафе две миссии, миссия главы II ждёт отношений «Приятель»', async ({ page }) => {
      await openApp(page, lang);
      const npc = { es: 'lola', it: 'giulia' }[lang];
      const seed = (rep: number) =>
        page.evaluate(
          ({ db, npc, rep }) =>
            new Promise<void>((resolve) => {
              const r = indexedDB.open(db);
              r.onsuccess = () => {
                const tx = r.result.transaction('meta', 'readwrite');
                tx.objectStore('meta').put({ key: 'journey', value: { fragments: {}, seals: {}, openedChapter: 2, celebrated: 2 } });
                tx.objectStore('meta').put({ key: 'errands', value: { day: 0, active: [], last: {}, done: 0, rep: { [npc]: rep } } });
                tx.oncomplete = () => resolve();
              };
            }),
          { db: DB[lang], npc, rep },
        );
      await seed(2);
      await page.goto('./#/loc/cafe');
      await page.reload();
      const links = page.getByTestId('mission-link');
      await expect(links).toHaveCount(2);
      await expect(links.nth(0)).toContainText('глава I · новая');
      await expect(links.nth(1)).toContainText('глава II · нужны отношения «Приятель»');
      await expect(links.nth(1)).not.toHaveAttribute('href');
      await seed(5);
      await page.reload();
      await expect(links.nth(1)).toContainText('глава II · новая');
      await links.nth(1).click();
      await expect(page).toHaveURL(/#\/mission\/ms%3Acafe\.2$/);
      await expect(page.getByTestId('scene-current')).toBeVisible();
    });

    test('миссия: две ошибки — реакция жителя, не засчитана, второе прохождение со сборкой из плиток', async ({ page }) => {
      await openApp(page, lang, '/mission/ms%3Acafe.1');
      await playMission(page, lang, [0, 2]);
      const { answers } = missionData(lang);
      const correct = answers.length - 2;
      await expect(page.getByTestId('mission-result')).toContainText('Пока не получилось');
      await expect(page.getByTestId('mission-result')).toContainText(`Верных ответов: ${correct} из ${answers.length} (${Math.round((correct / answers.length) * 100)}%)`);
      await expect(page.getByTestId('mission-result')).toContainText('сборка из плиток');
      await expect(page.getByTestId('mission-reward')).toHaveCount(0);
      await page.getByTestId('mission-retry').click();
      while (!(await page.getByText('Ответить жителю').count())) await page.getByTestId('scene-next').click();
      await page.getByTestId('scene-next').click();
      await page.getByTestId('mission-next').click();
      await expect(page.getByTestId('mission-tiles')).toBeVisible();
    });
  });
}
