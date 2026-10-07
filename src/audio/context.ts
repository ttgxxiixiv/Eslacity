/**
 * Общий AudioContext звуков и музыки (задача 13.3). Создаётся лениво: браузер разрешает звук только после жеста
 * игрока, поэтому `unlockAudio` вешается на первое касание и будит контекст. Где WebAudio нет (тесты в node),
 * всё молчит.
 */
let ctx: AudioContext | null | undefined;

export function audioContext(): AudioContext | null {
  if (ctx !== undefined) return ctx;
  const Ctor = typeof window !== 'undefined' ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext) : undefined;
  ctx = Ctor ? new Ctor() : null;
  return ctx;
}

/** Разбудить звук на первом касании и после возвращения в приложение. */
export function unlockAudio(): void {
  if (typeof window === 'undefined') return;
  const wake = () => {
    const c = audioContext();
    if (c && c.state === 'suspended') void c.resume().catch(() => {});
  };
  for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, wake, { capture: true });
}

/** Сообщить, какой звук или тема играют: по событию это видят сквозные тесты. */
export function announceSound(detail: { sfx?: string; music?: string | null; track?: string }): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('eslacity:sound', { detail }));
}
