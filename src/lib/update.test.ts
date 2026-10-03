import { describe, expect, it, vi } from 'vitest';

vi.mock('virtual:pwa-register', () => ({ registerSW: () => async () => {} }));
const { remoteIsNewer, versionNewer } = await import('./update');

const build = (version: string, builtAt: string) => ({ version, builtAt, commit: 'x' });

describe('новая версия на сайте', () => {
  it('номера версий сравниваются по частям', () => {
    expect(versionNewer('2.113.1', '2.113.0')).toBe(true);
    expect(versionNewer('2.113.10', '2.113.9')).toBe(true);
    expect(versionNewer('2.114.0', '2.113.99')).toBe(true);
    expect(versionNewer('2.113.0', '2.113.0')).toBe(false);
    expect(versionNewer('2.112.5', '2.113.0')).toBe(false);
  });

  it('приложение для Android смотрит на номер версии: другое время сборки той же версии — не обновление', () => {
    const site = build('2.113.1', '2026-10-03T10:05:00Z');
    const apk = build('2.113.1', '2026-10-03T10:01:00Z');
    expect(remoteIsNewer(site, apk, true)).toBe(false);
    expect(remoteIsNewer(build('2.113.2', '2026-10-04T10:00:00Z'), apk, true)).toBe(true);
    // Сайт в браузере по-прежнему сравнивает время сборки.
    expect(remoteIsNewer(site, apk, false)).toBe(true);
  });
});
