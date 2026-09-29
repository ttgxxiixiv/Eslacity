import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { LANGS, loadPhraseData, openApp, phraseFull, readAnswers, type Lang } from './fixtures';

const CONTENT = join(import.meta.dirname, '..', '..', 'src', 'content');
type Answer = { kind: 'answer'; task: string; branches: { phrase: string }[]; register?: string; tone?: { es: string } };

/** Миссия главы V места: ответы героя и фразы места. */
function mission(lang: Lang, place: string) {
  const m = (JSON.parse(readFileSync(join(CONTENT, lang, 'missions', `${place}.json`), 'utf8')).missions as { id: string; nodes: Record<string, Answer | { kind: 'say' }> }[])
    .find((x) => x.id === `ms:${place}.5`)!;
  const answers = Object.values(m.nodes).filter((n): n is Answer => n.kind === 'answer');
  const phrases = new Map(loadPhraseData(lang, place).map((p) => [p.id, p.es]));
  return { id: m.id, answers, phrases };
}

const TONE: Record<string, string> = { formal: 'Тон: официально', informal: 'Тон: по-свойски' };

for (const lang of LANGS) {
  test.describe(lang, () => {
    for (const place of ['cafe', 'home']) {
      test(`узел тона в миссии главы V (${place}): чужой тон — «почти» и реакция жителя, миссия засчитана`, async ({ page }) => {
        const { id, answers, phrases } = mission(lang, place);
        const toneNode = answers.find((a) => a.register)!;
        await openApp(page, lang);
        await page.goto(`./#/mission/${encodeURIComponent(id)}`);
        while (!(await page.getByText('Ответить жителю').count())) await page.getByTestId('scene-next').click();
        await page.getByTestId('scene-next').click();
        for (let i = 0; i < 60 && !(await page.getByTestId('mission-result').count()); i++) {
          if (!(await page.getByTestId('hero-turn').count())) {
            await page.getByTestId('mission-next').click();
            continue;
          }
          const task = ((await page.getByTestId('hero-task').textContent()) ?? '').trim();
          const node = answers.find((a) => a.task === task)!;
          const turn = page.getByTestId('hero-turn');
          if (node === toneNode) {
            // Подсказка тона видна; герой нарочно говорит другим тоном.
            await expect(page.getByTestId('tone-hint')).toHaveText(TONE[node.register!]);
            const other = phraseFull(phrases.get(node.branches[1].phrase)!);
            const right = phraseFull(phrases.get(node.branches[0].phrase)!);
            await turn.getByRole('button', { name: other, exact: true }).click();
            await expect(page.getByTestId('hero-line').nth(-2)).toContainText('не тот тон');
            await expect(page.getByTestId('npc-line').last()).toContainText(node.tone!.es);
            await expect(page.getByTestId('hero-line').last()).toContainText(`Лучше так: ${right}`);
            continue;
          }
          await turn.getByRole('button', { name: phraseFull(phrases.get(node.branches[0].phrase)!), exact: true }).click();
        }
        // «Почти» засчитывается: миссия выполнена, в журнале один ответ «почти».
        await expect(page.getByTestId('mission-result')).toContainText('Миссия выполнена');
        await expect(page.getByTestId('mission-result')).toContainText(`Верных ответов: ${answers.length} из ${answers.length}`);
        const log = (await readAnswers(page, lang)).filter((a) => a.kind === 'mission-choose');
        expect(log.filter((a) => a.verdict === 'almost')).toHaveLength(1);
        expect(log).toHaveLength(answers.length);
      });
    }
  });
}
