/**
 * Проставляет упражнениям грамматики устойчивые id вида `<lessonId>.<n>` (задача 3.3 в docs/ROADMAP.md).
 *
 *   npx tsx scripts/add-exercise-ids.ts
 *
 * Номер — порядок упражнения в файле, с единицы, как их уже пишет журнал ответов (`g:<lessonId>.<n>`).
 * Уже проставленные id не меняются: новые упражнения получают следующий свободный номер, даже если их
 * вставили в середину файла. Так журнал ответов и повторение правил не теряют историю.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..', 'src', 'content');
let added = 0;
let files = 0;

for (const lang of readdirSync(root)) {
  const dir = join(root, lang, 'grammar');
  if (!existsSync(dir)) continue;
  for (const district of readdirSync(dir)) {
    for (const f of readdirSync(join(dir, district)).filter((x) => x.endsWith('.json'))) {
      const path = join(dir, district, f);
      const lesson = JSON.parse(readFileSync(path, 'utf8'));
      const taken = lesson.exercises.map((e: { id?: string }) => Number(e.id?.slice(lesson.id.length + 1))).filter(Number.isFinite);
      let next = Math.max(0, ...taken) + 1;
      let changed = false;
      lesson.exercises = lesson.exercises.map((e: { id?: string }, i: number) => {
        if (e.id) return e;
        changed = true;
        added++;
        // В первый раз номера идут по порядку в файле; потом — следующий свободный.
        const n = taken.length ? next++ : i + 1;
        return { id: `${lesson.id}.${n}`, ...e };
      });
      if (changed) {
        writeFileSync(path, JSON.stringify(lesson, null, 2) + '\n');
        files++;
      }
    }
  }
}
console.log(`Проставлено id: ${added} в ${files} файлах`);
