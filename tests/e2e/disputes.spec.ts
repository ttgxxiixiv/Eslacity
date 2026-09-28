import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { exact, LANGS, loadPhraseData, openApp, phraseFull, phraseTiles, readAnswers, type Lang } from './fixtures';

const CONTENT = join(import.meta.dirname, '..', '..', 'src', 'content');
type Move = 'object' | 'concede' | 'compromise';
type Branch = { phrase: string; next: string; move?: Move };
type Node = { kind: 'say'; es: string } | { kind: 'answer'; task: string; branches: Branch[] };

const VERB: Record<Move, string> = { object: 'Возразить', concede: 'Уступить', compromise: 'Компромисс' };
const DONE: Record<Move, string> = { object: 'Вы возражаете', concede: 'Вы уступаете', compromise: 'Вы предлагаете компромисс' };

function mission(lang: Lang, place: string) {
  const m = (JSON.parse(readFileSync(join(CONTENT, lang, 'missions', `${place}.json`), 'utf8')).missions as { id: string; nodes: Record<string, Node> }[]).find((x) => x.id === `ms:${place}.4`)!;
  const phrases = new Map(loadPhraseData(lang, place).map((p) => [p.id, p]));
  return { m, phrases };
}

/** Пройти миссию главы IV без ошибок: в споре — ходом `move`, в режиме прохождения (выбор, плитки, ввод). */
async function play(page: Page, lang: Lang, place: string, move: Move, mode: 'choose' | 'tiles' | 'type') {
  const { m, phrases } = mission(lang, place);
  const answers = Object.values(m.nodes).filter((n): n is Extract<Node, { kind: 'answer' }> => n.kind === 'answer');
  while (!(await page.getByText('Ответить жителю').count())) await page.getByTestId('scene-next').click();
  await page.getByTestId('scene-next').click();
  let disputes = 0;
  for (let i = 0; i < 80; i++) {
    if (await page.getByTestId('mission-result').count()) return { answers: answers.length, disputes };
    if (!(await page.getByTestId('hero-turn').count())) {
      await page.getByTestId('mission-next').click();
      continue;
    }
    const task = ((await page.getByTestId('hero-task').textContent()) ?? '').trim();
    const node = answers.find((a) => a.task === task)!;
    const dispute = node.branches.some((b) => b.move);
    const branch = dispute ? node.branches.find((b) => b.move === move)! : node.branches[0];
    const phrase = phrases.get(branch.phrase)!;
    const turn = page.getByTestId('hero-turn');
    if (dispute) {
      disputes++;
      if (mode === 'choose') {
        // Все три хода спора среди вариантов.
        for (const b of node.branches) await expect(turn.getByRole('button', { name: phraseFull(phrases.get(b.phrase)!.es), exact: true })).toBeVisible();
      } else {
        await expect(page.getByTestId('dispute-move')).toHaveCount(3);
        await expect(page.getByTestId('mission-tiles')).toHaveCount(0);
        await page.getByTestId('dispute-move').filter({ hasText: VERB[move] }).click();
        await expect(page.getByTestId('dispute-hint')).toContainText(phrase.ru);
      }
    }
    if (mode === 'choose') {
      await turn.getByRole('button', { name: phraseFull(phrase.es), exact: true }).click();
    } else if (mode === 'tiles') {
      for (const t of phraseTiles(phrase.es)) await page.getByTestId('mission-tiles').locator('button:not([disabled])').filter({ hasText: exact(t) }).first().click();
      await turn.getByRole('button', { name: 'Сказать' }).click();
    } else {
      await turn.locator('input').fill(phraseFull(phrase.es));
      await turn.getByRole('button', { name: 'Сказать' }).click();
    }
    if (dispute) {
      // Житель отвечает на выбранный ход своей репликой, в ленте видно, как ответил герой.
      await expect(page.getByTestId('hero-line').last()).toContainText(DONE[move]);
      await expect(page.getByTestId('npc-line').last()).toContainText((m.nodes[branch.next] as { es: string }).es);
    }
  }
  throw new Error('Миссия не закончилась');
}

for (const lang of LANGS) {
  test.describe(lang, () => {
    test('спор в миссии главы IV: выбором — возразить, плитками — уступить, вводом — компромисс', async ({ page }) => {
      await openApp(page, lang);
      const plan: [Move, 'choose' | 'tiles' | 'type'][] = [['object', 'choose'], ['concede', 'tiles'], ['compromise', 'type']];
      for (const [move, mode] of plan) {
        await page.goto('./#/');
        await page.goto('./#/mission/ms%3Acafe.4');
        const r = await play(page, lang, 'cafe', move, mode);
        expect(r.disputes).toBe(1);
        await expect(page.getByTestId('mission-result')).toContainText(`Верных ответов: ${r.answers} из ${r.answers} (100%)`);
      }
      const log = (await readAnswers(page, lang)).filter((a) => a.itemId === 'ms:cafe.4');
      expect(new Set(log.map((a) => a.kind))).toEqual(new Set(['mission-choose', 'mission-tiles', 'mission-type']));
    });

    test('все споры первой пачки: каждый ход ведёт к своей реакции жителя', async ({ page }) => {
      test.setTimeout(240_000);
      await openApp(page, lang);
      for (const place of ['market', 'supermarket', 'restaurant', 'home']) {
        for (const move of ['concede', 'compromise'] as Move[]) {
          // Первое прохождение каждой миссии — выбор фразы; дальше плитки.
          await page.goto('./#/');
          await page.goto(`./#/mission/${encodeURIComponent(`ms:${place}.4`)}`);
          await play(page, lang, place, move, move === 'concede' ? 'choose' : 'tiles');
        }
      }
    });
  });
}
