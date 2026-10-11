import { describe, expect, it } from 'vitest';
import { buildSayIndex, sayCandidates, sayIssues, sayRecords, sayToken, spokenText } from './say';

describe('произношение для озвучки (задача 15.4)', () => {
  it('изменённая часть слова', () => {
    expect(sayToken('el DNI', 'el de ene i')).toEqual(['DNI', 'de ene i']);
    expect(sayToken('la sala VIP', 'la sala vip')).toEqual(['VIP', 'vip']);
    expect(sayToken('el código QR', 'el código cu erre')).toEqual(['QR', 'cu erre']);
    expect(sayToken('el DNI', 'el DNI')).toBeNull();
    expect(sayToken('ADN', 'a de ene')).toBeNull();
  });

  it('текст целиком, иначе части слов только целыми словами', () => {
    const index = buildSayIndex([
      { es: 'el DNI', say: 'el de ene i', word: true },
      { es: 'la UCI', say: 'la uci', word: true },
      { es: 'Llame al 112.', say: 'Llame al uno uno dos.', word: false },
    ]);
    expect(spokenText('el DNI', index)).toBe('el de ene i');
    expect(spokenText('Aquí tiene mi DNI.', index)).toBe('Aquí tiene mi de ene i.');
    expect(spokenText('Está en la UCI.', index)).toBe('Está en la uci.');
    expect(spokenText('Llame al 112.', index)).toBe('Llame al uno uno dos.');
    expect(spokenText('Llame al 112 ahora.', index)).toBe('Llame al 112 ahora.');
    expect(spokenText('El DNIE es nuevo.', index)).toBe('El DNIE es nuevo.');
  });

  it('записи из файла контента и кандидаты', () => {
    const file = { words: [{ id: 'post.dni', es: 'el DNI', pos: 'noun', say: 'el de ene i', example: { es: 'Su DNI.', ru: '', say: 'Su de ene i.' } }] };
    expect(sayRecords(file)).toEqual([
      { es: 'el DNI', say: 'el de ene i', word: true },
      { es: 'Su DNI.', say: 'Su de ene i.', word: false },
    ]);
    expect(sayCandidates('La puerta B12, llame al 112, el AVE y la UCI.')).toEqual(['B12', '112', 'AVE', 'UCI']);
    expect(sayCandidates('Hola, Leo.')).toEqual([]);
  });

  it('замечания к say', () => {
    expect(sayIssues({ lines: [{ es: 'el DNI', say: 'el de ene i' }] })).toEqual([]);
    expect(sayIssues({ mission: [{ say: { es: '¡Hola!', ru: 'Привет!' } }] })).toEqual([]);
    expect(sayIssues({ lines: [{ es: 'el DNI', say: ' ' }] })).toEqual([{ where: 'lines[0]', msg: 'пустое поле say' }]);
    expect(sayIssues({ lines: [{ es: 'el DNI', say: 'el DNI' }] })).toEqual([{ where: 'lines[0]', msg: 'say совпадает с текстом' }]);
    expect(sayIssues({ lines: [{ es: '¿ME OYES, listo?', say: '¿Me oyes, listo?', fem: { es: '¿ME OYES, lista?' } }] })[0].msg).toMatch(/fem\.say/);
  });
});
