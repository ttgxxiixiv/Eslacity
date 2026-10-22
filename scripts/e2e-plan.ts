/**
 * План сквозных тестов для CI (задача 20.6): `npx tsx scripts/e2e-plan.ts <база> <коммит>` печатает строку
 * `grep=<регулярное выражение>` для `$GITHUB_OUTPUT`, пустую — полный прогон. База — коммит версии на сайте
 * (`version.json`): она прошла все тесты. Логика — `scripts/e2e-plan-lib.ts`.
 */
import { execFileSync } from 'node:child_process';
import { LANG_IDS } from '../src/lang';
import { e2eGrep, onlyVersionChanged } from './e2e-plan-lib';

const [before, after] = process.argv.slice(2);
const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });

let grep: string | null = null;
try {
  if (before && after && /^[0-9a-f]{7,40}$/.test(before) && !/^0+$/.test(before)) {
    const files = git('diff', '--name-only', before, after).split('\n').filter(Boolean);
    const versionOnly = onlyVersionChanged(git('diff', '-U0', before, after, '--', 'package.json', 'package-lock.json'));
    grep = e2eGrep(files, LANG_IDS, versionOnly);
  }
} catch {
  // Нет истории (первый запуск, принудительный push): полный прогон.
  grep = null;
}
console.log(`grep=${grep ?? ''}`);
