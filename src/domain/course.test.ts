import { describe, expect, it } from 'vitest';
import { courseCacheName, courseListPath, courseStamp, missingFiles, staleFiles } from './course';

describe('кэш курса (задача 20.4)', () => {
  it('метка версии и имена', () => {
    expect(courseStamp('2026-10-22T08:56:01.123Z')).toBe('20261022085601123');
    expect(courseListPath('tr', '123')).toBe('course/tr-123.json');
    expect(courseCacheName('pt')).toBe('eslacity-course-pt');
  });

  it('недостающие и лишние файлы', () => {
    const wanted = ['a/es/x.js', 'a/es/y.js', 'a/es/z.webp'];
    const have = ['a/es/x.js', 'a/es/old.js'];
    expect(missingFiles(wanted, have)).toEqual(['a/es/y.js', 'a/es/z.webp']);
    expect(staleFiles(wanted, have)).toEqual(['a/es/old.js']);
    expect(missingFiles(wanted, wanted)).toEqual([]);
  });
});
