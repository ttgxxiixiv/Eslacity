import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { LANGS, loadPhraseData, openApp, phraseFull, playPhrases, playWords, readMeta, type Lang } from './fixtures';

const CONTENT = join(import.meta.dirname, '..', '..', 'src', 'content');
/** Праздник языка в тесте и день внутри его недели. */
const FEST = {
  es: { id: 'sanfermin', host: 'restaurant', day: new Date(2026, 6, 8, 10), after: new Date(2026, 9, 6, 10) },
  it: { id: 'ferragosto', host: 'beach', day: new Date(2026, 7, 14, 10), after: new Date(2026, 9, 6, 10) },
} as const;

type Node = { kind: 'say' } | { kind: 'answer'; task: string; branches: { phrase: string }[] };

/** Пройти миссию праздника выбором верной фразы. */
async function playFestivalMission(page: Page, lang: Lang, id: string) {
  const data = JSON.parse(readFileSync(join(CONTENT, lang, 'festivals', `${id}.json`), 'utf8')) as { missions: { nodes: Record<string, Node> }[] };
  const answers = Object.values(data.missions[0].nodes).filter((n): n is Extract<Node, { kind: 'answer' }> => n.kind === 'answer');
  const phrases = new Map(loadPhraseData(lang, `fest-${id}`).map((p) => [p.id, p.es]));
  for (let i = 0; i < 60; i++) {
    if (await page.getByTestId('mission-result').count()) return answers.length;
    if (await page.getByTestId('hero-turn').count()) {
      const task = ((await page.getByTestId('hero-task').textContent()) ?? '').trim();
      const node = answers.find((a) => a.task === task)!;
      await page.getByTestId('hero-turn').getByRole('button', { name: phraseFull(phrases.get(node.branches[0].phrase)!), exact: true }).click();
      continue;
    }
    await page.getByTestId('mission-next').click();
  }
  throw new Error('Миссия праздника не закончилась');
}

for (const lang of LANGS) {
  test.describe(lang, () => {
    const f = FEST[lang];

    test('неделя праздника: приглашение, флажки, слова, фразы, миссия хозяина и тайная медаль', async ({ page }) => {
      test.setTimeout(120_000);
      await page.clock.install({ time: f.day });
      await openApp(page, lang);
      await expect(page.getByTestId('festival-banner')).toBeVisible();
      await expect(page.getByTestId('festival-bunting')).toBeVisible();
      await expect(page.getByTestId('festival-sign')).toBeVisible();
      await page.getByTestId('festival-banner').click();
      await expect(page).toHaveURL(new RegExp(`#/festival/${f.id}$`));
      await expect(page.getByTestId('festival-when')).toContainText('Праздник идёт');

      // Слова праздника — обычный урок слов; после него слова — карточки и урок отмечен.
      await page.getByTestId('festival-words-0').click();
      await playWords(page, lang, /урок пройден/i);
      await page.getByRole('button', { name: /Дальше|Готово|В город/ }).last().click();
      await expect(page).toHaveURL(new RegExp(`#/festival/${f.id}$`));
      await expect(page.getByTestId('festival-words-0')).toContainText('✓');
      const cards = await page.evaluate(async (db) => {
        const r = indexedDB.open(db);
        await new Promise((ok) => (r.onsuccess = ok));
        const all = r.result.transaction('cards').objectStore('cards').getAllKeys();
        await new Promise((ok) => (all.onsuccess = ok));
        return (all.result as string[]).filter((k) => k.startsWith('fest-'));
      }, lang === 'es' ? 'eslacity' : 'eslacity-it');
      expect(cards.length).toBeGreaterThan(3);

      // Фразы праздника.
      await page.getByTestId('festival-phrases').click();
      await playPhrases(page, lang, `fest-${f.id}`, /фразы выучены/i);
      await page.getByRole('button', { name: /Дальше|Готово/ }).last().click();
      await expect(page.getByTestId('festival-phrases')).toContainText('✓');

      // Миссия хозяина: засчитана, тайная медаль.
      await page.getByTestId('festival-mission').click();
      const n = await playFestivalMission(page, lang, f.id);
      await expect(page.getByTestId('mission-result')).toContainText(`Верных ответов: ${n} из ${n} (100%)`);
      await page.getByRole('button', { name: 'Готово' }).click();
      await expect(page).toHaveURL(new RegExp(`#/festival/${f.id}$`));
      await expect(page.getByTestId('festival-mission')).toContainText('✓ выполнена');
      await expect(page.getByTestId('festival-medal')).toContainText('получена');
      await expect.poll(async () => Object.keys((await readMeta<{ medals: { secrets: Record<string, number> } }>(page, lang, 'motivation'))?.medals.secrets ?? {})).toContain(`festival-${f.id}`);

      // Медаль праздника видна только в курсе своего языка.
      await page.goto('./#/profile');
      await expect(page.getByTestId(`festival-${f.id}`)).toContainText('✓ медаль');
    });

    test('миссии всех праздников языка проходятся выбором без ошибок', async ({ page }) => {
      const all = { es: [['sanfermin', new Date(2026, 6, 8, 10)], ['tomatina', new Date(2026, 7, 26, 10)]], it: [['ferragosto', new Date(2026, 7, 14, 10)], ['carnevale', new Date(2026, 1, 14, 10)]] }[lang] as [string, Date][];
      await page.clock.install({ time: all[0][1] });
      await openApp(page, lang);
      for (const [id, day] of all) {
        await page.clock.setSystemTime(day);
        await page.goto(`./#/festival/${id}`);
        await page.reload();
        await page.getByTestId('festival-mission').click();
        const n = await playFestivalMission(page, lang, id);
        await expect(page.getByTestId('mission-result'), id).toContainText(`Верных ответов: ${n} из ${n} (100%)`);
      }
    });

    test('вне недели праздника: нет приглашения и флажков, страница говорит, когда праздник', async ({ page }) => {
      await page.clock.install({ time: f.after });
      await openApp(page, lang);
      await expect(page.getByTestId('festival-banner')).toHaveCount(0);
      await expect(page.getByTestId('festival-bunting')).toHaveCount(0);
      await page.goto('./#/profile');
      await expect(page.getByTestId('festival-calendar').locator('li')).toHaveCount(2);
      await page.getByTestId(`festival-${f.id}`).click();
      await expect(page.getByTestId('festival-when')).toContainText('Неделя праздника');
      await expect(page.getByTestId('festival-closed')).toBeVisible();
      await expect(page.getByTestId('festival-steps')).toHaveCount(0);
      // Праздник другого языка здесь не открывается.
      await page.goto(`./#/festival/${lang === 'es' ? 'ferragosto' : 'sanfermin'}`);
      await expect(page.getByText('Такого праздника в этом городе нет.')).toBeVisible();
    });
  });
}
