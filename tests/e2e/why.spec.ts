import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import type { GrammarLesson } from '../../src/content/schema';
import { tableForms } from '../../src/domain/grammar';
import { conjugate, PERSONS, TENSE_LESSON, TENSE_RU, type Tense, type VerbData } from '../../src/domain/verbs';
import { DB, LANGS, openApp, readAnswers, seedDueCards, type Lang } from './fixtures';

/**
 * Почему неверно (задача 12.3): причина ошибки одной строкой в окне итога, урок правила в повторении,
 * причина в журнале ответов.
 */
const content = join(import.meta.dirname, '..', '..', 'src', 'content');

/** Упражнение ввода формы урока A1, где ответ — форма из таблицы урока, и другая форма той же таблицы. */
function formExercise(lang: Lang) {
  const dir = join(content, lang, 'grammar', 'a1');
  for (const f of readdirSync(dir).sort()) {
    const lesson = JSON.parse(readFileSync(join(dir, f), 'utf8')) as GrammarLesson;
    const forms = tableForms(lesson.theory);
    for (const ex of lesson.exercises) {
      if (ex.kind !== 'type') continue;
      const accepted = [ex.answer, ...(ex.alt ?? [])].map((a) => a.toLowerCase());
      if (!forms.some((x) => accepted.includes(x.form.toLowerCase()))) continue;
      const other = forms.find((x) => !accepted.includes(x.form.toLowerCase()) && x.form.toLowerCase() !== ex.answer.toLowerCase());
      if (other) return { lesson, ex, other };
    }
  }
  throw new Error(`нет упражнения с формой из таблицы (${lang})`);
}

const verbsOf = (lang: Lang): VerbData[] => JSON.parse(readFileSync(join(content, lang, 'verbs.json'), 'utf8')).verbs;

async function passLesson(page: Page, lang: Lang, lessonId: string) {
  await page.evaluate(
    ({ db, lessonId }) =>
      new Promise<void>((resolve, reject) => {
        const r = indexedDB.open(db);
        r.onerror = () => reject(r.error);
        r.onsuccess = () => {
          const tx = r.result.transaction('grammar', 'readwrite');
          tx.objectStore('grammar').put({ lessonId, completedAt: 1, bestScore: 90 });
          tx.oncomplete = () => resolve();
        };
      }),
    { db: DB[lang], lessonId },
  );
  await page.reload();
}

for (const lang of LANGS) {
  test.describe(lang, () => {
    test('повторение правила: ответ другой формой из таблицы — причина и ссылка на урок', async ({ page }) => {
      const { lesson, ex, other } = formExercise(lang);
      await openApp(page, lang);
      await seedDueCards(page, lang, [`g:${ex.id}`]);
      await page.goto('./#/review');
      const review = page.getByTestId('rule-review');
      await expect(review).toContainText('Правило · 1 из 1');
      await review.locator('input').fill(other.form);
      await review.getByRole('button', { name: 'Проверить' }).click();
      const sheet = page.locator('.sheet[aria-live]');
      await expect(sheet).toContainText('Неверно');
      await expect(sheet).toContainText(`«${other.form}» — это ${other.label}`);
      await expect(page.getByTestId('feedback-rule')).toContainText(`урок «${lesson.title}»`);
      const log = (await readAnswers(page, lang)).filter((a) => a.mode === 'review');
      expect(log.map((a) => (a as { why?: string }).why)).toEqual(['form']);
      await page.getByTestId('feedback-rule').getByRole('link').click();
      await expect(page).toHaveURL(new RegExp(`#/grammar/${lesson.id.replace('.', '\\.')}$`));
    });

    test('кузница: другое лицо того же глагола — причина ошибки', async ({ page }) => {
      await openApp(page, lang);
      await passLesson(page, lang, TENSE_LESSON[lang].presente!);
      await page.goto('./#/forge');
      await page.getByTestId('forge-start').click();
      const task = page.getByTestId('forge-task');
      const inf = (await task.getAttribute('data-inf'))!;
      const tense = (await task.getAttribute('data-tense')) as Tense;
      const person = Number(await task.getAttribute('data-person'));
      const all = conjugate(verbsOf(lang).find((v) => v.inf === inf)!, tense, lang);
      const other = all.findIndex((f, p) => p !== person && f !== all[person] && (lang !== 'es' || p !== 4));
      await page.getByRole('textbox', { name: 'Форма глагола' }).fill(all[other]);
      await page.getByRole('button', { name: 'Проверить' }).click();
      const sheet = page.locator('.sheet[aria-live]');
      await expect(sheet).toContainText(`«${all[other]}» — это ${PERSONS[lang][other]} · ${TENSE_RU[tense]}`);
      await expect(sheet).toContainText(`а здесь нужно ${PERSONS[lang][person]} · ${TENSE_RU[tense]}: «${all[person]}»`);
      // В кузнице правило не показываем: время открыто уроком, кузнец сам называет лицо и время.
      await expect(page.getByTestId('feedback-rule')).toHaveCount(0);
      const log = (await readAnswers(page, lang)).filter((a) => a.mode === 'forge');
      expect(log.map((a) => (a as { why?: string }).why)).toEqual(['form']);
    });
  });
}
