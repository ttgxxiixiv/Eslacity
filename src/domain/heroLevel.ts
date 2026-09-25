/**
 * Уровень персонажа по накопленному опыту. Каждый следующий уровень дороже предыдущего:
 * переход с уровня n на n + 1 стоит 100·n^1.5 XP (округлено до 10).
 * 1 → 2: 100 XP (примерно один урок), 5 → 6: 1120, 10 → 11: 3160, 20 → 21: 8940.
 * До 10-го уровня нужно около 11 тысяч XP, до 20-го — около 67 тысяч.
 */
export function levelCost(level: number): number {
  return Math.round((100 * level ** 1.5) / 10) * 10;
}

export interface HeroLevel {
  level: number;
  /** Опыт, набранный внутри текущего уровня. */
  into: number;
  /** Сколько всего нужно на текущем уровне до следующего. */
  need: number;
}

export function heroLevel(xpTotal: number): HeroLevel {
  let level = 1;
  let rest = Math.max(0, Math.floor(xpTotal));
  while (rest >= levelCost(level)) {
    rest -= levelCost(level);
    level++;
  }
  return { level, into: rest, need: levelCost(level) };
}
