import { describe, expect, it } from 'vitest';
import { addressHero, cleanName } from './address';

const man = { name: '', gender: 'm' as const };
const woman = { name: '', gender: 'f' as const };
const lucas = { name: 'Lucas', gender: 'm' as const };

describe('имя путника', () => {
  it('латиница с ударениями, первая буква заглавная, лишнее убирается', () => {
    expect(cleanName('  josé   maría ')).toBe('José María');
    expect(cleanName("d'Artagnan")).toBe("D'Artagnan");
    expect(cleanName('Вася')).toBe('');
    expect(cleanName('Ana<script>')).toBe('Anascript');
    expect(cleanName('Maximiliano Alejandro').length).toBeLessThanOrEqual(16);
  });
});

describe('обращение к путнику', () => {
  it('без имени у мужчины текст не меняется', () => {
    expect(addressHero('Sigue la voz, viajero.', 'es', man)).toBe('Sigue la voz, viajero.');
  });

  it('обращение после запятой и в начале фразы заменяется именем', () => {
    expect(addressHero('Sigue la voz, viajero.', 'es', lucas)).toBe('Sigue la voz, Lucas.');
    expect(addressHero('¡Cuidado, viajero! Ese chico corre.', 'es', lucas)).toBe('¡Cuidado, Lucas! Ese chico corre.');
    expect(addressHero('¡Viajero! ¡Rápido!', 'es', lucas)).toBe('¡Lucas! ¡Rápido!');
    expect(addressHero('¿Vamos? Hoy no, viajero: hoy, al mar.', 'es', lucas)).toBe('¿Vamos? Hoy no, Lucas: hoy, al mar.');
    expect(addressHero('Viajero, ha llegado usted.', 'es', lucas)).toBe('Lucas, ha llegado usted.');
    expect(addressHero('¡El viajero! ¿Ahora vas?', 'es', lucas)).toBe('¡Lucas! ¿Ahora vas?');
    expect(addressHero('Il viaggiatore! Adesso vai?', 'it', lucas)).toBe('Lucas! Adesso vai?');
    expect(addressHero('Путешественник! Быстрее!', 'ru', lucas)).toBe('Lucas! Быстрее!');
    expect(addressHero('А, путешественник! Теперь идёшь в горы?', 'ru', lucas)).toBe('А, Lucas! Теперь идёшь в горы?');
    expect(addressHero('Путник, вы дошли до Врат.', 'ru', lucas)).toBe('Lucas, вы дошли до Врат.');
  });

  it('рассказ о путнике в третьем лице не трогается', () => {
    const t = 'Un día cocinó para un viajero del mapa, como tú. ¡El viajero del mapa!';
    expect(addressHero(t, 'es', lucas)).toBe(t);
    expect(addressHero('Il Cronista ha l\'anima del viaggiatore.', 'it', lucas)).toBe('Il Cronista ha l\'anima del viaggiatore.');
    expect(addressHero('Путешественник с картой!', 'ru', lucas)).toBe('Путешественник с картой!');
  });

  it('путница без имени слышит женскую форму, итальянское прилагательное согласуется', () => {
    expect(addressHero('Hoy no, viajero.', 'es', woman)).toBe('Hoy no, viajera.');
    expect(addressHero('¡El viajero! ¿Ahora vas?', 'es', woman)).toBe('¡La viajera! ¿Ahora vas?');
    expect(addressHero('Tranquillo, viaggiatore. La torre ti chiama.', 'it', woman)).toBe('Tranquilla, viaggiatrice. La torre ti chiama.');
    expect(addressHero('Attento, viaggiatore!', 'it', { name: 'Anna', gender: 'f' })).toBe('Attenta, Anna!');
    expect(addressHero('Спокойно, путешественник.', 'ru', woman)).toBe('Спокойно, путешественница.');
    expect(addressHero('Путник, вы дошли.', 'ru', woman)).toBe('Путница, вы дошли.');
  });
});
