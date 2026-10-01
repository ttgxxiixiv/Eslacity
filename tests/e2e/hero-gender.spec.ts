import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { LANGS, loadPhraseData, openApp, phraseFull, readMeta, type Lang } from './fixtures';

const CONTENT = join(import.meta.dirname, '..', '..', 'src', 'content');
type Text = { es: string; ru: string; fem?: { es?: string; ru?: string } };
type Node = ({ kind: 'say' } & Text) | { kind: 'answer'; task: string; branches: { phrase: string }[]; wrong: Text };
/** Текст в роде путницы: женская форма, если она есть. */
const she = (t: Text) => ({ es: t.fem?.es ?? t.es, ru: t.fem?.ru ?? t.ru });

function missionData(lang: Lang, place: string, id: string) {
  const m = (JSON.parse(readFileSync(join(CONTENT, lang, 'missions', `${place}.json`), 'utf8')).missions as { id: string; nodes: Record<string, Node> }[]).find((x) => x.id === id)!;
  const phrases = new Map(loadPhraseData(lang, place).map((p) => [p.id, she(p as Text).es]));
  return { nodes: m.nodes, phrases };
}

/** Путница: пол в настройках. */
async function becomeHeroine(page: Page, lang: Lang) {
  await page.goto('./#/settings');
  await page.getByTestId('hero-gender-f').click();
  await expect.poll(async () => (await readMeta<{ heroGender: string }>(page, lang, 'settings'))?.heroGender).toBe('f');
}

/** Пройти миссию путницей: ответы — женские формы фраз. Возвращает сказанные героем фразы. */
async function playAsHeroine(page: Page, lang: Lang, place: string, id: string) {
  const { nodes, phrases } = missionData(lang, place, id);
  await page.goto('./#/');
  await page.goto(`./#/mission/${id}`);
  while (!(await page.getByText('Ответить жителю').count())) await page.getByTestId('scene-next').click();
  await page.getByTestId('scene-next').click();
  const said: string[] = [];
  for (let i = 0; i < 80; i++) {
    if (await page.getByTestId('mission-result').count()) return said;
    if (await page.getByTestId('hero-turn').count()) {
      const task = ((await page.getByTestId('hero-task').textContent()) ?? '').trim();
      const node = Object.values(nodes).find((n): n is Extract<Node, { kind: 'answer' }> => n.kind === 'answer' && n.task === task)!;
      const right = phraseFull(phrases.get(node.branches[0].phrase)!);
      await page.getByTestId('hero-turn').getByRole('button', { name: right, exact: true }).click();
      said.push(right);
      continue;
    }
    await page.getByTestId('mission-next').click();
  }
  throw new Error('Миссия не закончилась');
}

/** Миссия, где путница говорит о себе в женском роде. */
const PHRASE: Record<Lang, { place: string; id: string; line: string }> = {
  es: { place: 'pharmacy', id: 'ms:pharmacy.2', line: 'Estoy mareada.' },
  it: { place: 'beach', id: 'ms:beach.1', line: 'Mi sono scottata la schiena.' },
};

for (const lang of LANGS) {
  test.describe(lang, () => {
    test('путница: жители говорят с ней в женском роде, перевод тоже', async ({ page }) => {
      await openApp(page, lang);
      await becomeHeroine(page, lang);
      const { nodes } = missionData(lang, 'police', 'ms:police.1');
      const calm = she(nodes.shoutsay as Text);
      expect(calm.es).toMatch(/Tranquill?a\./);
      await page.goto('./#/');
      await page.goto('./#/mission/ms:police.1');
      while (!(await page.getByText('Ответить жителю').count())) await page.getByTestId('scene-next').click();
      await page.getByTestId('scene-next').click();
      // Комиссар начинает с обращения в женском роде: «¡Cuidado, viajera!» / «Attenta, viaggiatrice!».
      const npc = page.getByTestId('npc-line');
      await expect(npc.first()).toContainText(lang === 'es' ? '¡Cuidado, viajera!' : 'Attenta, viaggiatrice!');
      // Первый ответ героя, потом «¡Lo tengo! Tranquila.» и перевод.
      const turn = page.getByTestId('hero-turn');
      for (let i = 0; i < 10 && !(await turn.count()); i++) await page.getByTestId('mission-next').click();
      const { phrases } = missionData(lang, 'police', 'ms:police.1');
      const shout = nodes.shout as Extract<Node, { kind: 'answer' }>;
      await turn.getByRole('button', { name: phraseFull(phrases.get(shout.branches[0].phrase)!), exact: true }).click();
      await expect(npc.filter({ hasText: calm.es })).toHaveCount(1);
      await expect(npc.filter({ hasText: /Tranquilo\.|Tranquillo\./ })).toHaveCount(0);
    });

    test('путница: свои фразы говорит в женском роде, мужская форма в ответах не предлагается', async ({ page }) => {
      await openApp(page, lang);
      await becomeHeroine(page, lang);
      const { place, id, line } = PHRASE[lang];
      const said = await playAsHeroine(page, lang, place, id);
      expect(said).toContain(line);
      await expect(page.getByTestId('mission-result')).toBeVisible();
      await expect(page.getByTestId('mission-result')).not.toContainText('0 из');
    });

    test('путник: те же реплики в мужском роде', async ({ page }) => {
      await openApp(page, lang);
      await page.goto('./#/');
      await page.goto('./#/mission/ms:police.1');
      while (!(await page.getByText('Ответить жителю').count())) await page.getByTestId('scene-next').click();
      await page.getByTestId('scene-next').click();
      await expect(page.getByTestId('npc-line').first()).toContainText(lang === 'es' ? '¡Cuidado, viajero!' : 'Attento, viaggiatore!');
    });
  });
}
