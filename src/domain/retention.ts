import { DEFAULT_RETENTION } from './srs';

/**
 * Запоминаемость на выбор (задача 21.2): какую вероятность вспомнить слово FSRS держит к дню повтора. Ниже —
 * повторений меньше, но и забывается больше; выше — наоборот. Сверка с журналом: доля верных ответов на плановых
 * повторах против предсказанной FSRS. Если игрок помнит заметно лучше или хуже прогноза, подсказка сменить режим.
 */
export type RetentionMode = 'light' | 'normal' | 'firm';

export const RETENTION_MODES: RetentionMode[] = ['light', 'normal', 'firm'];

export const RETENTION: Record<RetentionMode, number> = { light: 0.85, normal: DEFAULT_RETENTION, firm: 0.95 };

export const RETENTION_LABEL: Record<RetentionMode, string> = { light: 'Повторять реже', normal: 'Обычно', firm: 'Надёжнее' };

/**
 * Плановый повтор: предсказанная FSRS вероятность вспомнить (в тысячных) и вспомнил ли (верно или «почти»).
 * Хранится последних `CALIBRATION_KEEP` в `meta.calibration`.
 */
export type CalSample = [pred: number, ok: 0 | 1];

export const CALIBRATION_KEEP = 400;
/** Меньше повторов — подсказки нет: разница может быть случайной. */
export const CALIBRATION_MIN = 100;
/** На сколько доля верных должна отличаться от прогноза, чтобы советовать другой режим. */
export const CALIBRATION_GAP = 0.05;

export function addSamples(prev: readonly CalSample[], add: readonly CalSample[]): CalSample[] {
  return [...prev, ...add].slice(-CALIBRATION_KEEP);
}

export interface Calibration {
  n: number;
  /** Средняя предсказанная вероятность вспомнить, 0–1. */
  predicted: number;
  /** Доля вспомненных, 0–1. */
  actual: number;
}

export function calibration(samples: readonly CalSample[]): Calibration | null {
  if (!samples.length) return null;
  let pred = 0;
  let ok = 0;
  for (const [p, o] of samples) {
    pred += p / 1000;
    ok += o;
  }
  return { n: samples.length, predicted: pred / samples.length, actual: ok / samples.length };
}

export interface RetentionHint {
  /** Помнит лучше прогноза — можно реже; хуже — надёжнее. */
  kind: 'better' | 'worse';
  /** Какой режим предложить; null — уже крайний. */
  suggest: RetentionMode | null;
  cal: Calibration;
}

export function retentionHint(samples: readonly CalSample[], mode: RetentionMode): RetentionHint | null {
  const cal = calibration(samples);
  if (!cal || cal.n < CALIBRATION_MIN) return null;
  const i = RETENTION_MODES.indexOf(mode);
  if (cal.actual - cal.predicted >= CALIBRATION_GAP) return { kind: 'better', suggest: RETENTION_MODES[i - 1] ?? null, cal };
  if (cal.predicted - cal.actual >= CALIBRATION_GAP) return { kind: 'worse', suggest: RETENTION_MODES[i + 1] ?? null, cal };
  return null;
}
