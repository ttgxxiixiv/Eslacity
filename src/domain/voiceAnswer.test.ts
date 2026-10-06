import { describe, expect, it } from 'vitest';
import { checkPhrase } from './answer';
import { bestAlternative, cleanTranscript } from './voiceAnswer';

describe('ответ голосом', () => {
  const phrase = { es: 'Un café, por favor' };
  const verdict = (s: string) => checkPhrase(s, phrase).verdict;

  it('из вариантов распознавания берётся тот, что проходит проверку', () => {
    expect(bestAlternative(['un cafe por favor', 'un café por favor'], verdict)).toBe('un café por favor');
    expect(bestAlternative(['hola por favor', 'un cafe por favor'], verdict)).toBe('un cafe por favor');
  });

  it('если ни один не подходит, остаётся самый уверенный: игрок увидит, что услышано', () => {
    expect(bestAlternative(['hola', 'ola'], verdict)).toBe('hola');
    expect(bestAlternative([], verdict)).toBe('');
    expect(bestAlternative(['  ', ''], verdict)).toBe('');
  });

  it('пробелы и точка в конце убираются', () => {
    expect(cleanTranscript('  Un  café, por favor. ')).toBe('Un café, por favor');
  });
});
