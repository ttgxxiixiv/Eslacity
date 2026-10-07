import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { DB, LANGS, loadPhraseData, openApp, phraseFull, playTrial, seedDueCards, seedMissionsDone, wordIdsOf, type Lang } from './fixtures';

const CONTENT = join(import.meta.dirname, '..', '..', 'src', 'content');

/**
 * Заглушка распознавания речи: «слышит» варианты из `window.__heard` и отдаёт их как результат.
 * `window.__voiceShown` считает, сколько раз в испытании показалась кнопка «Голосом».
 */
async function fakeRecognition(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __heard: string[]; __voiceShown: number; SpeechRecognition: unknown; webkitSpeechRecognition: unknown };
    w.__heard = [];
    w.__voiceShown = 0;
    class Fake {
      lang = '';
      interimResults = false;
      maxAlternatives = 1;
      continuous = false;
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        (window as unknown as { __recLang: string }).__recLang = this.lang;
        setTimeout(() => {
          const alts = w.__heard.map((transcript) => ({ transcript }));
          this.onresult?.({ results: [alts] });
          this.onend?.();
        }, 150);
      }
      stop() {}
      abort() {}
    }
    w.SpeechRecognition = Fake;
    w.webkitSpeechRecognition = Fake;
    new MutationObserver(() => {
      if (document.querySelector('[data-testid=trial-run] [data-testid=voice-answer]:not([data-seen])')) {
        document.querySelector('[data-testid=trial-run] [data-testid=voice-answer]')!.setAttribute('data-seen', '1');
        w.__voiceShown++;
      }
    }).observe(document, { childList: true, subtree: true });
  });
}

const heard = (page: Page, alts: string[]) => page.evaluate((a) => ((window as unknown as { __heard: string[] }).__heard = a), alts);

async function seedAttempts(page: Page, lang: Lang, id: string, attempts: number) {
  await page.evaluate(
    ({ db, id, attempts }) =>
      new Promise<void>((resolve) => {
        const r = indexedDB.open(db);
        r.onsuccess = () => {
          const tx = r.result.transaction('meta', 'readwrite');
          tx.objectStore('meta').put({ key: 'missions', value: { [id]: { attempts } } });
          tx.oncomplete = () => resolve();
        };
      }),
    { db: DB[lang], id, attempts },
  );
  // Перезагрузка сразу: иначе экран миссии при открытии сохранит записи из памяти (start) поверх засеянных,
  // и прохождение окажется не третьим (так падало в 2.129.0 и 2.132.0).
  await page.reload();
  await expect(page.getByTestId('continue')).toBeVisible();
}

type Node = { kind: 'say' } | { kind: 'answer'; branches: { phrase: string }[]; wrong: { es: string } };

for (const lang of LANGS) {
  test.describe(lang, () => {
    test('миссия, третье прохождение: ответ голосом встаёт в поле лучшим вариантом и засчитывается', async ({ page }) => {
      await fakeRecognition(page);
      await openApp(page, lang);
      await seedAttempts(page, lang, 'ms:cafe.1', 2);
      await page.goto('./#/mission/ms%3Acafe.1');
      while (!(await page.getByText('Ответить жителю').count())) await page.getByTestId('scene-next').click();
      await page.getByTestId('scene-next').click();
      const mission = JSON.parse(readFileSync(join(CONTENT, lang, 'missions', 'cafe.json'), 'utf8')).missions[0] as { nodes: Record<string, Node>; start: string };
      const node = Object.values(mission.nodes).find((n): n is Extract<Node, { kind: 'answer' }> => n.kind === 'answer')!;
      const phrase = loadPhraseData(lang, 'cafe').find((p) => p.id === node.branches[0].phrase)!;
      // Распознавание без знаков и заглавных, как у Chrome; первым идёт неверный вариант.
      const spoken = phraseFull(phrase.es).toLowerCase().replace(/[¿¡?!.,]/g, '');
      while (!(await page.getByTestId('hero-turn').count())) await page.getByTestId('mission-next').click();
      await heard(page, ['hola amigo', spoken]);
      await page.getByTestId('voice-answer').click();
      await expect(page.getByTestId('hero-turn').locator('input')).toHaveValue(spoken);
      expect(await page.evaluate(() => (window as unknown as { __recLang: string }).__recLang)).toMatch(lang === 'es' ? /^es-/ : /^it-IT$/);
      await page.getByRole('button', { name: 'Сказать' }).click();
      // Засчитанный ответ герой произносит фразой в правильном написании.
      await expect(page.getByTestId('hero-line').last()).toContainText(phraseFull(phrase.es));
      await page.getByTestId('mission-next').click();
      await expect(page.getByTestId('npc-line').last()).not.toContainText(node.wrong.es);

      // Без сети кнопки нет, с сетью она возвращается.
      await page.context().setOffline(true);
      while (!(await page.getByTestId('hero-turn').count())) await page.getByTestId('mission-next').click();
      await expect(page.getByTestId('voice-answer')).toHaveCount(0);
      await page.context().setOffline(false);
      await expect(page.getByTestId('voice-answer')).toBeVisible();

      // Ничего не расслышано: подсказка, поле пустое.
      await heard(page, []);
      await page.getByTestId('voice-answer').click();
      await expect(page.getByTestId('voice-missed')).toBeVisible();
      await expect(page.getByTestId('hero-turn').locator('input')).toHaveValue('');
    });

    test('испытание: у ввода слова и фразы есть «Голосом», испытание проходится', async ({ page }) => {
      await fakeRecognition(page);
      await openApp(page, lang);
      await seedMissionsDone(page, lang, ['ms:cafe.1']);
      await seedDueCards(page, lang, wordIdsOf(lang, 'cafe', [1, 2]));
      await page.goto('./#/trial/tr%3Acafe.1');
      await page.getByTestId('trial-start').click();
      const { typed } = await playTrial(page, lang, 'cafe');
      expect(typed).toBeGreaterThan(0);
      expect(await page.evaluate(() => (window as unknown as { __voiceShown: number }).__voiceShown)).toBe(typed);
    });

    test('без распознавания в браузере кнопки нет', async ({ page }) => {
      await page.addInitScript(() => {
        delete (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition;
        delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition;
      });
      await openApp(page, lang);
      await seedAttempts(page, lang, 'ms:cafe.1', 2);
      await page.goto('./#/mission/ms%3Acafe.1');
      while (!(await page.getByText('Ответить жителю').count())) await page.getByTestId('scene-next').click();
      await page.getByTestId('scene-next').click();
      while (!(await page.getByTestId('hero-turn').count())) await page.getByTestId('mission-next').click();
      await expect(page.getByTestId('hero-turn').locator('input')).toBeVisible();
      await expect(page.getByTestId('voice-answer')).toHaveCount(0);
    });
  });
}
