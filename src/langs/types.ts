import type { District, Gender, LocationId } from '../content/schema';
import type { EsTense } from './es/verbs';
import type { ItTense } from './it/verbs';
import type { EnTense } from './en/verbs';

/**
 * Профиль языка курса (задача 16.6): всё, что в коде зависит от языка. Профиль — данные и чистые функции,
 * из `src/domain` и `src/content` он берёт только типы: его импортирует `src/lang.ts`, а тот нужен почти везде.
 * Новый язык — папка `src/langs/<id>/`, строка в `src/langs/index.ts` и id в `Lang`.
 */

export type Lang = 'es' | 'it' | 'en';

export type Tense = EsTense | ItTense | EnTense;

export interface VerbData {
  inf: string;
  ru: string;
  /** Строки времён, которые не строятся по правилам: 6 форм, от «я» до «они». */
  forms?: Partial<Record<Tense, string[]>>;
  /** Неправильная форма «я» в настоящем (tengo, conozco); испанский субхунтив берёт основу от неё. */
  yo?: string;
  /** Основа будущего и условного (tendr, sar). */
  fut?: string;
  /** Причастие (hecho, fatto). */
  pp?: string;
  /** Чередование в основе у испанских глаголов: pensar → ie, dormir → ue, pedir → i. */
  ch?: 'ie' | 'ue' | 'i';
  /** Итальянские глаголы на -ire с -isc-: finisco. */
  isc?: boolean;
  /** Итальянский passato prossimo с essere: sono andato. */
  aux?: 'essere';
  /** Неправильное английское прошедшее (went); причастие без `pp` — то же (bought). */
  past?: string;
  /** Английский глагол с удвоением последней согласной не по правилу односложных: prefer → preferred. */
  dbl?: boolean;
  /** Английский глагол состояния (know, want): в Continuous не употребляется, кузница его там не даёт. */
  stative?: boolean;
}

/** Поля записи глагола, которые бывают не у всех языков. */
export type VerbField = 'ch' | 'isc' | 'aux' | 'past' | 'dbl' | 'stative';

/** Кузница глаголов: времена, лица и генератор форм. */
export interface VerbProfile {
  /** Времена по порядку открытия: название для задания и урок, после которого время открывается. */
  tenses: { id: Tense; ru: string; lesson: string }[];
  /** Лица от «я» до «они». */
  persons: string[];
  /** Окончание инфинитива: глагол с другим окончанием валидатор не пропустит. */
  infinitive: RegExp;
  /** Поля записи глагола, которые у языка бывают (остальные — ошибка валидатора). */
  fields: VerbField[];
  /** Шесть форм во времени, с учётом записанных в глаголе отличий. */
  conjugate(v: VerbData, tense: Tense): string[];
  /** Причастие: записанное или правильное. */
  participle(v: VerbData): string;
  /** Равноправные формы ответа: женский род причастия при essere (sono andata). */
  feminine?(v: VerbData, tense: Tense, form: string): string[];
  /** Времени у глагола не бывает: английский глагол состояния в Continuous. Кузница такое не даёт. */
  skip?(v: VerbData, tense: Tense): boolean;
}

/**
 * Виды противопоставлений Звонницы: замена букв, знак ударения, двойная согласная, ударный слог заглавными
 * (английское REcord / reCORD: написание одно, произношение задаёт `say` — «a record», «to record»).
 */
export type PairKind = 'swap' | 'stress' | 'double' | 'caps';

/** Праздник языка (задача 10.5): что показывать и когда идёт. */
export interface FestivalDef {
  id: string;
  /** Название по-русски и на языке курса. */
  title: string;
  native: string;
  /** Где празднуют на самом деле: для описания. */
  town: string;
  /** Здание хозяина в городе: его житель приглашает и ведёт миссию. */
  host: LocationId;
  /** Цвета флажков над картой города. */
  colors: string[];
  /** Знак праздника у здания хозяина и в приглашении. */
  icon: string;
  /** Тайная медаль за миссию праздника. */
  medal: { title: string; text: string };
  /** Неделя праздника в году: первый и последний день включительно, по местному времени. */
  week(year: number): { start: Date; end: Date };
}

export interface LangProfile {
  id: Lang;
  /**
   * Курс открыт игрокам: язык есть в выборе, у него полный контент. Закрытый курс (идёт работа над контентом)
   * в выборе не виден, проверки полноты контента его пропускают.
   */
  released: boolean;
  /** «Испанский» */
  name: string;
  /** Какой вариант языка в курсе (задача 12.7): одна фраза для настроек. */
  variety: string;
  flag: string;
  /** «по-испански» */
  adverb: string;
  /** Язык в родительном падеже для подсказок: «испанского». */
  genitive: string;
  /** Предпочтительные голоса синтеза речи, по порядку. */
  voices: string[];
  /** Любой голос с таким префиксом подойдёт, если предпочтительных нет. */
  voicePrefix: string;
  /** Локаль для сортировки. */
  locale: string;
  /** Имя базы IndexedDB. У испанского — прежнее, чтобы не потерять прогресс. */
  db: string;
  /** Ключ положения путника на карте города в localStorage (у испанского — прежний). */
  heroKey: string;
  /** Номера уведомлений напоминания в APK начинаются отсюда: у каждого языка свои. */
  reminderBase: number;
  /** Как установить голос на Android. */
  voiceHint: string;
  /** Спасибо жителя за выполненное поручение: на языке курса и перевод. */
  thanks: { es: string; ru: string };
  /** Фразы для проверки голоса в настройках: жителя и путника. */
  samples: { voice: string; hero: string };

  /** Определённые артикли: единственное и множественное число. */
  singular: string[];
  plural: string[];
  /** Неопределённые артикли. */
  indefinite: string[];
  /** Есть ли у существительных род. Есть — у слова обязателен `gender` и валидатор сверяет с ним артикль. */
  gender: boolean;
  /**
   * Ошибка артикля существительного (артикль уже отделён и он определённый): текст ошибки или null.
   * Нужна, если у языка есть род.
   */
  articleIssue?(gender: Gender, article: string, core: string): string | null;

  /** Буквы с диакритикой: ответ без них — «почти». */
  letters: string;
  /** Клавиши над полем в испытании: все буквы с ударением и апостроф, одни и те же для любого ответа. */
  examKeys: string[];
  /** Правила нормализации ответа: регулярное выражение и замена («l' acqua» → «l'acqua»). */
  answerRules: [RegExp, string][];
  /** Сокращения и полные формы: «don't» и «do not» — один ответ. Сводятся к полной форме при сравнении и разборе текста. */
  contractions?: [string, string][];
  /** Равноправное написание: британское и американское («colour», «color»). Сравнение сводит второе к первому. */
  spelling?: [string, string][];
  /** Ошибки в тексте на языке курса, которые видит валидатор у слов и примеров: «a apple» вместо «an apple». */
  textIssues?(text: string): string[];
  /** Окончание возвратного глагола (bañarse, lavarsi): в примере слово ищется без него. */
  reflexive: string;
  /** Длина окончания инфинитива: в примере глагол ищется по основе. */
  infinitiveEnd: number;
  verbs: VerbProfile;
  /** Какие противопоставления бывают в Звоннице. */
  pairKinds: PairKind[];
  festivals: FestivalDef[];

  /** Обращение жителей к путнику без имени. */
  hero: {
    /** Слова обращения: мужская и женская форма. Первое — для подсказки в настройках. */
    words: [string, string][];
    /** Артикль перед обращением-восклицанием «¡El viajero!»: мужской и женский. */
    article: [string, string] | null;
    /** Прилагательные перед обращением, которые согласуются с родом путницы: «Tranquilla, viaggiatrice». */
    adjectives: [string, string][];
  };
  /** Обращение в оригинале для проверки перевода (задача 15.3): на «ты», вежливое «вы», множественное «вы». */
  you: { ty: RegExp; formal: RegExp; plural: RegExp };
  /** Подписи районов грамматики. */
  districts: Record<District, string>;
}
