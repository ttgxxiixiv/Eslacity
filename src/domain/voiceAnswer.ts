import type { Verdict } from './answer';

/**
 * Ответ голосом (задача 10.3). Распознавание отдаёт несколько вариантов услышанного: «pero» и «perro», «el café»
 * и «el cafe». Берётся вариант, который лучше всего проходит проверку задания, при равенстве — более уверенный
 * (первый). Игрок видит его в поле и сам нажимает «Проверить»: оценивает та же проверка, что и для ввода.
 */
const RANK: Record<Verdict, number> = { correct: 2, almost: 1, wrong: 0 };

export function bestAlternative(alts: string[], verdictOf: (text: string) => Verdict): string {
  let best = '';
  let rank = -1;
  for (const raw of alts) {
    const text = cleanTranscript(raw);
    if (!text) continue;
    const r = RANK[verdictOf(text)];
    if (r > rank) {
      best = text;
      rank = r;
    }
  }
  return best;
}

/** Распознанный текст без лишних пробелов и точки в конце, которую ставят некоторые движки. */
export function cleanTranscript(s: string): string {
  return s.replace(/\s+/g, ' ').trim().replace(/\.$/, '');
}
