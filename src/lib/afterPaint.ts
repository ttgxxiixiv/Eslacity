/**
 * Запустить работу после того, как браузер отрисует текущий кадр.
 * Визуальный ответ на нажатие появляется сразу, а звук и запись в IndexedDB идут следом.
 */
export function afterPaint(fn: () => void): void {
  if (typeof requestAnimationFrame === 'undefined') {
    setTimeout(fn, 0);
    return;
  }
  requestAnimationFrame(() => setTimeout(fn, 0));
}
