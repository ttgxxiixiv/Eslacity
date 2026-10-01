import { describe, expect, it } from 'vitest';
import { MALE_SHIFT, FEMALE_SHIFT, pickGendered, shiftedPitch, voiceGender } from './voiceGender';

const v = (name: string, lang: string) => ({ name, lang });

describe('пол голоса по имени', () => {
  it('голоса Apple, Microsoft и Google TTS', () => {
    expect(voiceGender(v('Jorge', 'es-ES'))).toBe('m');
    expect(voiceGender(v('Mónica', 'es-ES'))).toBe('f');
    expect(voiceGender(v('Microsoft Pablo - Spanish (Spain)', 'es-ES'))).toBe('m');
    expect(voiceGender(v('Microsoft Helena - Spanish (Spain)', 'es-ES'))).toBe('f');
    expect(voiceGender(v('Luca', 'it-IT'))).toBe('m');
    expect(voiceGender(v('Microsoft Elsa - Italian (Italy)', 'it-IT'))).toBe('f');
    expect(voiceGender(v('es-es-x-eed-local', 'es-ES'))).toBe('m');
    expect(voiceGender(v('Google español', 'es-ES'))).toBe('f');
  });

  it('female не считается male, имя — только целым словом', () => {
    expect(voiceGender(v('Spanish female', 'es-ES'))).toBe('f');
    expect(voiceGender(v('Spanish male', 'es-ES'))).toBe('m');
    expect(voiceGender(v('Emmanuel', 'es-ES'))).toBeNull();
    expect(voiceGender(v('es-es-x-eea-local', 'es-ES'))).toBeNull();
    expect(voiceGender(null)).toBeNull();
  });
});

describe('выбор голоса нужного пола', () => {
  const voices = [v('Mónica', 'es-ES'), v('Juan', 'es-MX'), v('Jorge', 'es-ES'), v('Luca', 'it-IT')];

  it('основной голос подходит — он и остаётся', () => {
    expect(pickGendered(voices, voices[0], ['es-ES'], 'es', 'f')).toBe(voices[0]);
  });

  it('сначала тот же вариант языка, что у основного голоса', () => {
    expect(pickGendered(voices, voices[0], ['es-MX'], 'es', 'm')).toBe(voices[2]);
  });

  it('другой вариант языка — если своего нет; чужой язык не берётся', () => {
    expect(pickGendered(voices.slice(0, 2), voices[0], ['es-ES'], 'es', 'm')).toBe(voices[1]);
    expect(pickGendered([voices[0], voices[3]], voices[0], ['es-ES'], 'es', 'm')).toBeNull();
  });
});

describe('высота основного голоса вместо голоса нужного пола', () => {
  it('неизвестный голос считается женским: мужчина звучит ниже', () => {
    expect(shiftedPitch(1, 'm', null)).toBe(MALE_SHIFT);
    expect(shiftedPitch(1, 'f', null)).toBe(1);
  });

  it('мужской основной голос: женщина звучит выше, мужчина как есть', () => {
    expect(shiftedPitch(1, 'f', 'm')).toBe(FEMALE_SHIFT);
    expect(shiftedPitch(0.9, 'm', 'm')).toBe(0.9);
  });

  it('высота остаётся в пределах, которые принимает браузер', () => {
    expect(shiftedPitch(1.8, 'f', 'm')).toBe(2);
    expect(shiftedPitch(0.1, 'm', 'f')).toBe(0.1);
  });
});
