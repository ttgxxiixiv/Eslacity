import { describe, expect, it } from 'vitest';
import { addressIssue, ruAddress, sourceAddress, translationIssues, typographyIssues } from './translation';

describe('правила перевода (задача 15.3)', () => {
  it('обращение в переводе: местоимения и формы глагола', () => {
    expect(ruAddress('Что будешь пить?')).toBe('ty');
    expect(ruAddress('Твой кошелёк здесь.')).toBe('ty');
    expect(ruAddress('Скажите, пожалуйста.')).toBe('vy');
    expect(ruAddress('Вам помочь?')).toBe('vy');
    expect(ruAddress('Холодный или горячий?')).toBeNull();
    expect(ruAddress('Ты сказал, а вы молчите.')).toBeNull();
  });

  it('обращение в оригинале: tú/tu и usted/Lei, множественное не в счёт', () => {
    expect(sourceAddress('¿Te recorto las patillas?', 'es')).toBe('ty');
    expect(sourceAddress('¿Usted quiere un café?', 'es')).toBe('vy');
    expect(sourceAddress('¿Vosotros queréis café?', 'es')).toBeNull();
    expect(sourceAddress('Ti piace?', 'it')).toBe('ty');
    expect(sourceAddress('Signora, Le spunto anche le basette?', 'it')).toBe('vy');
    expect(sourceAddress('Lei è mia sorella.', 'it')).toBeNull(); // в начале «Lei» может быть «она»
    expect(sourceAddress('Voi venite?', 'it')).toBeNull();
  });

  it('расхождение — замечание', () => {
    expect(addressIssue('¿Te recorto también las patillas?', 'Подровнять вам и бакенбарды?', 'es')).toBe('в оригинале на «ты», в переводе на «вы»');
    expect(addressIssue('¿Te recorto también las patillas?', 'Подровнять тебе и бакенбарды?', 'es')).toBeNull();
    expect(addressIssue('Le spunto anche le basette?', 'Подровнять вам и бакенбарды?', 'it')).toBeNull();
    expect(addressIssue('Signore, Lei ha il passaporto?', 'У тебя есть паспорт?', 'it')).toBe('в оригинале на «вы», в переводе на «ты»');
  });

  it('типографика: «ёлочки» и «ё»', () => {
    expect(typographyIssues('Он сказал: «Здесь говорят „пожалуйста“».')).toEqual([]);
    expect(typographyIssues('Он сказал "привет".')).toHaveLength(1);
    expect(typographyIssues('Он сказал “привет”.')).toHaveLength(1);
    expect(typographyIssues('Дай еще воды.')).toEqual(['«еще» без «ё»']);
    expect(typographyIssues('Ещё воды.')).toEqual([]);
  });

  it('обход файла: пары es/ru, женская форма, русские строки', () => {
    const data = {
      lines: [
        { who: 'npc', es: '¿Qué quieres?', ru: 'Что хотите?' },
        { who: 'npc', es: '¿Te sientes listo?', ru: 'Ты готов?', fem: { es: '¿Te sientes lista?', ru: 'Вы готовы?' } },
        { who: 'npc', es: '¿Te gusta?', ru: 'Тебе нравится?' },
      ],
      gloss: { tú: 'ты' },
      task: 'Скажите "спасибо".',
    };
    // «¿Qué quieres?» без местоимения в оригинале — не проверяется; в женской форме «ты» стало «вы».
    expect(translationIssues({ ...data, lines: [{ es: '¿Te gusta?', ru: 'Вам нравится?' }, ...data.lines] }, 'es')).toEqual([
      { where: 'lines[0]', msg: 'в оригинале на «ты», в переводе на «вы»: «Вам нравится?»' },
      { where: 'lines[2].fem', msg: 'в оригинале на «ты», в переводе на «вы»: «Вы готовы?»' },
      { where: 'task', msg: 'прямые кавычки: в переводе «ёлочки», внутри них „лапки“' },
    ]);
  });
});
