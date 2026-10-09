import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { seeded } from './generators';
import { conjugate, forgeTasks, openTenses, parseVerbCard, verbCardId, type Tense, type VerbData } from './verbs';

const file = (lang: string) =>
  JSON.parse(readFileSync(join(import.meta.dirname, '..', 'content', lang, 'verbs.json'), 'utf8')) as { verbs: VerbData[] };
const es = new Map(file('es').verbs.map((v) => [v.inf, v]));
const it_ = new Map(file('it').verbs.map((v) => [v.inf, v]));
const esc = (inf: string, t: Tense) => conjugate(es.get(inf)!, t, 'es').join(' ');
const itc = (inf: string, t: Tense) => conjugate(it_.get(inf)!, t, 'it').join(' ');

describe('испанские спряжения по данным', () => {
  it('правильные глаголы во всех временах', () => {
    expect(esc('hablar', 'presente')).toBe('hablo hablas habla hablamos habláis hablan');
    expect(esc('comer', 'presente')).toBe('como comes come comemos coméis comen');
    expect(esc('vivir', 'presente')).toBe('vivo vives vive vivimos vivís viven');
    expect(esc('hablar', 'indefinido')).toBe('hablé hablaste habló hablamos hablasteis hablaron');
    expect(esc('comer', 'indefinido')).toBe('comí comiste comió comimos comisteis comieron');
    expect(esc('hablar', 'imperfecto')).toBe('hablaba hablabas hablaba hablábamos hablabais hablaban');
    expect(esc('vivir', 'imperfecto')).toBe('vivía vivías vivía vivíamos vivíais vivían');
    expect(esc('hablar', 'perfecto')).toBe('he hablado has hablado ha hablado hemos hablado habéis hablado han hablado');
    expect(esc('comer', 'futuro')).toBe('comeré comerás comerá comeremos comeréis comerán');
    expect(esc('vivir', 'condicional')).toBe('viviría vivirías viviría viviríamos viviríais vivirían');
    expect(esc('hablar', 'subjuntivo')).toBe('hable hables hable hablemos habléis hablen');
    expect(esc('comer', 'subjuntivo')).toBe('coma comas coma comamos comáis coman');
  });
  it('чередования и орфография', () => {
    expect(esc('pensar', 'presente')).toBe('pienso piensas piensa pensamos pensáis piensan');
    expect(esc('pensar', 'subjuntivo')).toBe('piense pienses piense pensemos penséis piensen');
    expect(esc('dormir', 'presente')).toBe('duermo duermes duerme dormimos dormís duermen');
    expect(esc('dormir', 'indefinido')).toBe('dormí dormiste durmió dormimos dormisteis durmieron');
    expect(esc('dormir', 'subjuntivo')).toBe('duerma duermas duerma durmamos durmáis duerman');
    expect(esc('pedir', 'presente')).toBe('pido pides pide pedimos pedís piden');
    expect(esc('pedir', 'subjuntivo')).toBe('pida pidas pida pidamos pidáis pidan');
    expect(esc('sentir', 'indefinido')).toBe('sentí sentiste sintió sentimos sentisteis sintieron');
    expect(esc('jugar', 'presente')).toBe('juego juegas juega jugamos jugáis juegan');
    expect(esc('jugar', 'indefinido')).toBe('jugué jugaste jugó jugamos jugasteis jugaron');
    expect(esc('jugar', 'subjuntivo')).toBe('juegue juegues juegue juguemos juguéis jueguen');
    expect(esc('empezar', 'indefinido')).toBe('empecé empezaste empezó empezamos empezasteis empezaron');
    expect(esc('empezar', 'subjuntivo')).toBe('empiece empieces empiece empecemos empecéis empiecen');
    expect(esc('buscar', 'subjuntivo')).toBe('busque busques busque busquemos busquéis busquen');
    expect(esc('seguir', 'presente')).toBe('sigo sigues sigue seguimos seguís siguen');
    expect(esc('seguir', 'subjuntivo')).toBe('siga sigas siga sigamos sigáis sigan');
    expect(esc('seguir', 'indefinido')).toBe('seguí seguiste siguió seguimos seguisteis siguieron');
  });
  it('неправильные: форма «я», основа будущего, причастие, субхунтив от «я»', () => {
    expect(esc('tener', 'presente')).toBe('tengo tienes tiene tenemos tenéis tienen');
    expect(esc('tener', 'subjuntivo')).toBe('tenga tengas tenga tengamos tengáis tengan');
    expect(esc('tener', 'futuro')).toBe('tendré tendrás tendrá tendremos tendréis tendrán');
    expect(esc('decir', 'presente')).toBe('digo dices dice decimos decís dicen');
    expect(esc('decir', 'condicional')).toBe('diría dirías diría diríamos diríais dirían');
    expect(esc('hacer', 'perfecto').split(' ').slice(0, 2).join(' ')).toBe('he hecho');
    expect(esc('conocer', 'subjuntivo')).toBe('conozca conozcas conozca conozcamos conozcáis conozcan');
    expect(esc('ver', 'subjuntivo')).toBe('vea veas vea veamos veáis vean');
    expect(esc('oír', 'subjuntivo')).toBe('oiga oigas oiga oigamos oigáis oigan');
    expect(esc('oír', 'imperfecto')).toBe('oía oías oía oíamos oíais oían');
    expect(esc('oír', 'futuro')).toBe('oiré oirás oirá oiremos oiréis oirán');
    expect(esc('salir', 'futuro')).toBe('saldré saldrás saldrá saldremos saldréis saldrán');
    expect(esc('volver', 'perfecto').split(' ').slice(0, 2).join(' ')).toBe('he vuelto');
    expect(esc('leer', 'perfecto').split(' ').slice(0, 2).join(' ')).toBe('he leído');
  });
});

describe('итальянские спряжения по данным', () => {
  it('правильные глаголы', () => {
    expect(itc('parlare', 'presente')).toBe('parlo parli parla parliamo parlate parlano');
    expect(itc('credere', 'presente')).toBe('credo credi crede crediamo credete credono');
    expect(itc('dormire', 'presente')).toBe('dormo dormi dorme dormiamo dormite dormono');
    expect(itc('finire', 'presente')).toBe('finisco finisci finisce finiamo finite finiscono');
    expect(itc('parlare', 'imperfetto')).toBe('parlavo parlavi parlava parlavamo parlavate parlavano');
    expect(itc('parlare', 'futuro')).toBe('parlerò parlerai parlerà parleremo parlerete parleranno');
    expect(itc('dormire', 'condizionale')).toBe('dormirei dormiresti dormirebbe dormiremmo dormireste dormirebbero');
    expect(itc('parlare', 'congiuntivo')).toBe('parli parli parli parliamo parliate parlino');
    expect(itc('credere', 'congiuntivo')).toBe('creda creda creda crediamo crediate credano');
    expect(itc('finire', 'congiuntivo')).toBe('finisca finisca finisca finiamo finiate finiscano');
    expect(itc('parlare', 'passato')).toBe('ho parlato hai parlato ha parlato abbiamo parlato avete parlato hanno parlato');
    expect(itc('credere', 'passato').split(' ').slice(0, 2).join(' ')).toBe('ho creduto');
  });
  it('-care, -gare, -iare и essere', () => {
    expect(itc('cercare', 'presente')).toBe('cerco cerchi cerca cerchiamo cercate cercano');
    expect(itc('cercare', 'futuro')).toBe('cercherò cercherai cercherà cercheremo cercherete cercheranno');
    expect(itc('pagare', 'congiuntivo')).toBe('paghi paghi paghi paghiamo paghiate paghino');
    expect(itc('mangiare', 'presente')).toBe('mangio mangi mangia mangiamo mangiate mangiano');
    expect(itc('mangiare', 'futuro')).toBe('mangerò mangerai mangerà mangeremo mangerete mangeranno');
    expect(itc('studiare', 'presente')).toBe('studio studi studia studiamo studiate studiano');
    expect(itc('studiare', 'futuro')).toBe('studierò studierai studierà studieremo studierete studieranno');
    expect(itc('andare', 'passato')).toBe('sono andato sei andato è andato siamo andati siete andati sono andati');
    expect(itc('essere', 'futuro')).toBe('sarò sarai sarà saremo sarete saranno');
    expect(itc('fare', 'condizionale')).toBe('farei faresti farebbe faremmo fareste farebbero');
    expect(itc('venire', 'passato').split(' ').slice(0, 2).join(' ')).toBe('sono venuto');
    expect(itc('vedere', 'futuro')).toBe('vedrò vedrai vedrà vedremo vedrete vedranno');
  });
});

describe('задания кузницы', () => {
  const v: VerbData[] = [{ inf: 'hablar', ru: 'говорить' }, { inf: 'comer', ru: 'есть' }];
  it('карточка формы и открытые времена', () => {
    expect(verbCardId('hablar', 'presente', 2)).toBe('v:hablar.presente.3');
    expect(parseVerbCard('v:hablar.presente.3')).toEqual({ inf: 'hablar', tense: 'presente', person: 2 });
    expect(parseVerbCard('g:a1.02-ser.3')).toBeNull();
    expect(openTenses('es', (l) => l === 'a1.11-presente-ar')).toEqual(['presente']);
    expect(openTenses('it', () => false)).toEqual([]);
  });
  it('сначала формы к перековке, потом случайные без повторов', () => {
    const tasks = forgeTasks(v, 'es', ['presente', 'futuro'], ['v:comer.futuro.4', 'v:comer.indefinido.1', 'v:nope.presente.1'], 8, seeded(1));
    expect(tasks[0]).toMatchObject({ inf: 'comer', tense: 'futuro', person: 3, answer: 'comeremos' });
    expect(tasks).toHaveLength(8);
    expect(new Set(tasks.map((t) => `${t.inf}.${t.tense}.${t.person}`)).size).toBe(8);
    expect(tasks.every((t) => t.tense === 'presente' || t.tense === 'futuro')).toBe(true);
    expect(forgeTasks(v, 'es', [], [], 5, seeded(1))).toEqual([]);
  });
  it('passato с essere принимает и женский род', () => {
    const v = [it_.get('andare')!, it_.get('parlare')!];
    const [a, b] = forgeTasks(v, 'it', ['passato'], ['v:andare.passato.4', 'v:parlare.passato.1'], 2, seeded(1));
    expect(a).toMatchObject({ answer: 'siamo andati', alt: ['siamo andate'] });
    expect(b).toMatchObject({ answer: 'ho parlato', alt: [] });
  });
});
