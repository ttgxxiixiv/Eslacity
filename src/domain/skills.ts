/**
 * «Что я умею» (задача 21.3): умения по главам в духе дескрипторов CEFR, общие для всех курсов. Каждое умение
 * привязано к доказательству в игре: миссия места, страж главы, записка, письмо, книга Летописца, загадка Сфинкса.
 * Умение отмечено, когда доказательство пройдено. Миссии у всех курсов с одинаковыми id и темой места, поэтому
 * формулировка умения — по теме места и механике главы, а не по конкретным репликам.
 */
export type SkillProof =
  | { kind: 'mission'; id: string }
  | { kind: 'guardian'; chapter: number }
  | { kind: 'note' }
  | { kind: 'letter' }
  | { kind: 'book'; chapter: number }
  | { kind: 'sphinx-hear' };

export interface Skill {
  id: string;
  chapter: 1 | 2 | 3 | 4 | 5;
  /** «Могу…» — что игрок умеет делать на языке. */
  text: string;
  proof: SkillProof;
}

export const SKILLS: Skill[] = [
  { id: 'c1.order', chapter: 1, text: 'Могу заказать напиток, попросить воды и поблагодарить', proof: { kind: 'mission', id: 'ms:cafe.1' } },
  { id: 'c1.shop', chapter: 1, text: 'Могу купить продукты, спросить цену и сказать, что дорого', proof: { kind: 'mission', id: 'ms:market.1' } },
  { id: 'c1.room', chapter: 1, text: 'Могу снять номер в гостинице и спросить про завтрак', proof: { kind: 'mission', id: 'ms:hotel.1' } },
  { id: 'c1.basic', chapter: 1, text: 'Понимаю и говорю простые фразы о себе, доме и городе', proof: { kind: 'guardian', chapter: 1 } },
  { id: 'c2.way', chapter: 2, text: 'Могу спросить дорогу и разобраться с транспортом', proof: { kind: 'mission', id: 'ms:station.2' } },
  { id: 'c2.pharmacy', chapter: 2, text: 'Могу объяснить в аптеке, что мне нужно и как принимать лекарство', proof: { kind: 'mission', id: 'ms:pharmacy.2' } },
  { id: 'c2.note', chapter: 2, text: 'Могу написать короткую записку жителю', proof: { kind: 'note' } },
  { id: 'c2.everyday', chapter: 2, text: 'Объясняюсь в привычных ситуациях и рассказываю о том, что было', proof: { kind: 'guardian', chapter: 2 } },
  { id: 'c3.doctor', chapter: 3, text: 'Могу рассказать врачу, что случилось, и расспросить о лечении', proof: { kind: 'mission', id: 'ms:hospital.3' } },
  { id: 'c3.bank', chapter: 3, text: 'Могу решить денежный вопрос в банке', proof: { kind: 'mission', id: 'ms:bank.3' } },
  { id: 'c3.read', chapter: 3, text: 'Могу прочитать короткую историю и ответить на вопросы по ней', proof: { kind: 'book', chapter: 3 } },
  { id: 'c3.travel', chapter: 3, text: 'Справляюсь с большинством ситуаций в поездке и объясняю своё мнение', proof: { kind: 'guardian', chapter: 3 } },
  { id: 'c4.dispute', chapter: 4, text: 'Могу спорить: возразить, уступить или предложить компромисс', proof: { kind: 'mission', id: 'ms:police.4' } },
  { id: 'c4.listen', chapter: 4, text: 'Понимаю живую речь на слух, без текста перед глазами', proof: { kind: 'guardian', chapter: 4 } },
  { id: 'c4.read', chapter: 4, text: 'Читаю истории о жизни города и понимаю, кто что думает', proof: { kind: 'book', chapter: 4 } },
  { id: 'c5.tone', chapter: 5, text: 'Подбираю тон: официально с начальством, по-свойски с друзьями', proof: { kind: 'mission', id: 'ms:office.5' } },
  { id: 'c5.letter', chapter: 5, text: 'Могу написать официальное письмо или жалобу', proof: { kind: 'letter' } },
  { id: 'c5.hear', chapter: 5, text: 'Понимаю длинный рассказ и спор двух людей, и чью сторону кто держит', proof: { kind: 'sphinx-hear' } },
  { id: 'c5.echo', chapter: 5, text: 'Понимаю намёки и говорю ту же мысль другими словами', proof: { kind: 'guardian', chapter: 5 } },
];

/** Что пройдено: из хранилищ миссий, испытаний (стражи — `gd:<глава>`), писем, книг и Сфинкса. */
export interface SkillInput {
  missionDone: (id: string) => boolean;
  guardianDone: (chapter: number) => boolean;
  /** id записок (`nt:`) и писем (`lt:`) в дневнике писем. */
  letterIds: readonly string[];
  /** id прочитанных книг (`book:<глава>.<n>`). */
  booksRead: readonly string[];
  sphinxHear: boolean;
}

export function skillDone(s: Skill, input: SkillInput): boolean {
  const p = s.proof;
  switch (p.kind) {
    case 'mission':
      return input.missionDone(p.id);
    case 'guardian':
      return input.guardianDone(p.chapter);
    case 'note':
      return input.letterIds.some((id) => id.startsWith('nt:'));
    case 'letter':
      return input.letterIds.some((id) => id.startsWith('lt:'));
    case 'book':
      return input.booksRead.some((id) => id.startsWith(`book:${p.chapter}.`));
    case 'sphinx-hear':
      return input.sphinxHear;
  }
}

/** Где взять доказательство: подсказка у неотмеченного умения. `placeName` — название места по id. */
export function proofHint(p: SkillProof, placeName: (id: string) => string): string {
  switch (p.kind) {
    case 'mission': {
      const [place, ch] = p.id.slice('ms:'.length).split('.');
      return `Миссия: ${placeName(place)}, глава ${ROMAN[Number(ch)]}`;
    }
    case 'guardian':
      return `Страж главы ${ROMAN[p.chapter]}`;
    case 'note':
      return 'Записка жителю (с главы II)';
    case 'letter':
      return 'Письмо жителю (глава V)';
    case 'book':
      return `Книга Летописца главы ${ROMAN[p.chapter]}`;
    case 'sphinx-hear':
      return 'Загадка слуха у Сфинкса';
  }
}

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];

/** Умения главы с отметкой. */
export function chapterSkills(chapter: number, input: SkillInput): { skill: Skill; done: boolean }[] {
  return SKILLS.filter((s) => s.chapter === chapter).map((skill) => ({ skill, done: skillDone(skill, input) }));
}
