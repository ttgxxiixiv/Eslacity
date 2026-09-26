import { describe, expect, it } from 'vitest';
import { sceneWords, wordTranslation } from './sceneText';

describe('реплика по словам', () => {
  it('слова и знаки, ключ строчными', () => {
    expect(sceneWords('¡Hola! ¿Un café?')).toEqual([
      { word: 'Hola', key: 'hola', pre: '¡', post: '!' }, { text: ' ' }, { word: 'Un', key: 'un', pre: '¿' }, { text: ' ' }, { word: 'café', key: 'café', post: '?' },
    ]);
  });
  it('знаки вплотную к слову идут с ним, отдельно стоящие остаются текстом', () => {
    expect(sceneWords('Sì, ma — dopo.')).toEqual([
      { word: 'Sì', key: 'sì', post: ',' }, { text: ' ' }, { word: 'ma', key: 'ma' }, { text: ' — ' }, { word: 'dopo', key: 'dopo', post: '.' },
    ]);
  });
  it('итальянский апостроф элизии остаётся у слова', () => {
    expect(sceneWords('Un bicchiere d’acqua').filter((p) => 'word' in p).map((p) => ('key' in p ? p.key : ''))).toEqual(['un', 'bicchiere', "d'", 'acqua']);
  });
  it('перевод: автор сцены важнее словаря', () => {
    expect(wordTranslation('claro', { claro: 'конечно' }, { claro: 'ясный' })).toBe('конечно');
    expect(wordTranslation('café', undefined, { café: 'кофе' })).toBe('кофе');
    expect(wordTranslation('el', {}, {})).toBeUndefined();
  });
});
