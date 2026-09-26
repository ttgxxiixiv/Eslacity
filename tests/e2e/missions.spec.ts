import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { LANGS, loadPhraseData, openApp, phraseFull, readMeta, seedDueCards, wordIdsOf, type Lang } from './fixtures';

const CONTENT = join(import.meta.dirname, '..', '..', 'src', 'content');
type Node = { kind: 'say' } | { kind: 'answer'; task: string; branches: { phrase: string }[]; wrong: { es: string } };

function missionData(lang: Lang, place = 'cafe') {
  const m = JSON.parse(readFileSync(join(CONTENT, lang, 'missions', `${place}.json`), 'utf8')).missions[0] as { nodes: Record<string, Node> };
  const answers = Object.values(m.nodes).filter((n): n is Extract<Node, { kind: 'answer' }> => n.kind === 'answer');
  const phrases = new Map(loadPhraseData(lang, place).map((p) => [p.id, p.es]));
  return { answers, phrases };
}

/** Места, у которых есть миссия в контенте языка. */
const missionPlaces = (lang: Lang) =>
  readdirSync(join(CONTENT, lang, 'missions'))
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, ''));

/** Пройти сцену-вступление и диалог. wrongAt — номера ответов (с 0), где герой ошибается. */
async function playMission(page: Page, lang: Lang, wrongAt: number[] = [], place = 'cafe') {
  const { answers, phrases } = missionData(lang, place);
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

    test('миссии главы I всех мест проходятся выбором без ошибок', async ({ page }) => {
      test.setTimeout(120_000);
      await openApp(page, lang);
      for (const place of missionPlaces(lang)) {
        await page.goto(`./#/mission/ms%3A${place}.1`);
        await playMission(page, lang, [], place);
        const { answers } = missionData(lang, place);
        await expect(page.getByTestId('mission-result'), place).toContainText(`Верных ответов: ${answers.length} из ${answers.length} (100%)`);
      }
      const done = Object.keys((await readMeta<Record<string, unknown>>(page, lang, 'missions')) ?? {}).sort();
      expect(done).toEqual(missionPlaces(lang).map((p) => `ms:${p}.1`).sort());
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
