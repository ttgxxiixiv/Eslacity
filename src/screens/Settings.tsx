import { SoundCard } from '../components/SoundCard';
import { ReminderCard } from '../components/ReminderCard';
import { ReportsCard } from '../components/ReportsCard';
import { ReviewForecast } from '../components/ReviewForecast';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { currentVoice, hasLangVoice, languageVoices, onVoicesChanged, speak, speakHero, ttsSupported, voiceFor } from '../audio/tts';
import { L, LANG, LANGS, switchLang, type Lang } from '../lang';
import { resetProgress } from '../store/bootstrap';
import { downloadJson, exportBackup, importBackup, parseBackup } from '../db/backup';
import { TEXT_SCALE, TEXT_SIZE_LABEL, useSettings, type Settings, type TextSize } from '../store/settings';
import { cleanName, HERO_WORD, NAME_MAX } from '../domain/address';
import { SETTINGS_SECTIONS, settingsHint, type SettingsSection } from '../domain/settingsSections';
import { useProgress } from '../store/progress';
import { Button, Screen, TopBar } from '../components/ui';
import { AboutApp } from '../components/AboutApp';
import { HeroPortrait } from '../components/HeroPortrait';
import { APK_FILE, NATIVE, saveJsonFile } from '../lib/native';

/** Размеры текста по порядку (задача 14.3). */
const TEXT_SIZES: TextSize[] = ['normal', 'large', 'xlarge'];

const GOALS: Settings['dailyGoal'][] = [50, 100, 150, 250];
const NEW_PER_DAY: Settings['newPerDay'][] = [5, 10, 15, 20];

const SAMPLE: Record<Lang, string> = {
  es: '¡Hola! ¿Qué tal? Un café con leche, por favor.',
  it: 'Ciao! Come stai? Un caffè, per favore.',
};

/** Реплика путника для проверки голоса. */
const HERO_SAMPLE: Record<Lang, string> = {
  es: 'Buenos días. Busco el camino a la Bóveda.',
  it: 'Buongiorno. Cerco la strada per il Caveau.',
};

const HERO_GENDERS: { id: Settings['heroGender']; label: string }[] = [
  { id: 'm', label: 'Мужчина' },
  { id: 'f', label: 'Женщина' },
];

/**
 * Настройки по разделам (задача 14.4): `/settings` — оглавление, `/settings/<раздел>` — свой экран.
 * Неизвестный раздел показывает оглавление.
 */
export function SettingsScreen() {
  const { section } = useParams();
  const info = SETTINGS_SECTIONS.find((s) => s.id === section);
  if (!info) return <SettingsIndex />;
  return (
    <Screen>
      <TopBar title={info.title} />
      <div className="flex flex-col gap-4 px-5 pb-6" data-testid="settings-section" data-section={info.id}>
        {SECTION_BODY[info.id]()}
      </div>
    </Screen>
  );
}

function SettingsIndex() {
  const settings = useSettings();
  return (
    <Screen>
      <TopBar title="Настройки" />
      <nav className="flex flex-col gap-2 px-5 pb-6" aria-label="Разделы настроек">
        {SETTINGS_SECTIONS.map((s) => (
          <Link
            key={s.id}
            to={`/settings/${s.id}`}
            className="press flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm"
            data-testid={`settings-${s.id}`}
          >
            <span aria-hidden className="text-2xl">
              {s.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold">{s.title}</span>
              <span className="block text-sm text-stone-500">{settingsHint(s.id, settings, { lang: LANGS[LANG].name, textSize: TEXT_SIZE_LABEL[settings.textSize] })}</span>
            </span>
            <span aria-hidden className="text-stone-500">
              ›
            </span>
          </Link>
        ))}
      </nav>
    </Screen>
  );
}

const SECTION_BODY: Record<SettingsSection, () => ReactNode> = {
  hero: () => <HeroSection />,
  learning: () => <LearningSection />,
  sound: () => (
    <>
      <SoundCard />
      <VoiceSection />
    </>
  ),
  reminder: () => <ReminderCard />,
  language: () => <LanguageSection />,
  data: () => <DataSection />,
  app: () => <AppSection />,
  reports: () => <ReportsCard />,
};

function HeroSection() {
  const { heroGender, heroName, update } = useSettings();
  const [heroVoice, setHeroVoice] = useState(() => voiceFor(heroGender)?.name);
  const [nameDraft, setNameDraft] = useState(heroName);
  // Имя сохраняется, когда поле теряет фокус или нажат Enter: при вводе пробел в конце ещё нужен.
  const saveName = () => {
    const name = cleanName(nameDraft);
    setNameDraft(name);
    if (name !== heroName) update({ heroName: name });
  };
  return (
    <section className="rounded-3xl bg-white p-4 shadow-sm" data-testid="hero-gender">
      <div className="flex items-center gap-3">
        <HeroPortrait size={72} />
        <h2 className="font-bold">Пол и имя</h2>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Пол путника">
        {HERO_GENDERS.map((g) => (
          <button
            key={g.id}
            type="button"
            role="radio"
            aria-checked={heroGender === g.id}
            onClick={() => {
              update({ heroGender: g.id });
              setHeroVoice(voiceFor(g.id)?.name);
            }}
            className={`press rounded-xl border-2 py-2.5 font-semibold ${
              heroGender === g.id ? 'border-brand bg-orange-50 text-brand' : 'border-stone-200'
            }`}
            data-testid={`hero-gender-${g.id}`}
          >
            {g.label}
          </button>
        ))}
      </div>
      <label className="mt-3 block">
        <span className="text-sm text-stone-600">Имя</span>
        <input
          type="text"
          value={nameDraft}
          maxLength={NAME_MAX + 4}
          placeholder={HERO_WORD[LANG][heroGender]}
          autoComplete="off"
          autoCapitalize="words"
          spellCheck={false}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={saveName}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          className="mt-1 w-full rounded-xl border-2 border-stone-200 bg-white px-3 py-2 text-lg focus:border-brand focus:outline-none"
          data-testid="hero-name"
        />
      </label>
      <p className="mt-1 text-sm text-stone-500" data-testid="hero-name-note">
        {heroName ? `Жители зовут вас: ${heroName}.` : `Без имени жители зовут вас «${HERO_WORD[LANG][heroGender]}».`} Имя
        пишется латиницей: жители произносят его по-своему.
      </p>
      <p className="mt-2 text-sm text-stone-500">
        Этим голосом звучат реплики путника в миссиях и разговорах. Если голос звучит не так, выберите мужской и женский голос
        в разделе{' '}
        <Link to="/settings/sound" className="font-semibold text-brand underline">
          «Звук и озвучка»
        </Link>
        .
      </p>
      {ttsSupported() && (
        <>
          <Button
            variant="secondary"
            className="mt-2 w-full"
            onClick={() => {
              speakHero(HERO_SAMPLE[LANG]);
              setHeroVoice(voiceFor(heroGender)?.name);
            }}
          >
            🔊 Голос путника
          </Button>
          {heroVoice && <p className="mt-2 text-sm text-stone-500">Голос: {heroVoice}</p>}
        </>
      )}
    </section>
  );
}

function LearningSection() {
  const { dailyGoal, newPerDay, update } = useSettings();
  return (
    <>
      <section className="rounded-3xl bg-white p-4 shadow-sm">
        <h2 className="font-bold">Дневная цель</h2>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {GOALS.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => {
                update({ dailyGoal: g });
                // Если XP за сегодня уже хватает на новую цель, стрик засчитывается сразу.
                useProgress.getState().bumpDay({});
              }}
              className={`press rounded-xl border-2 py-2.5 font-semibold ${
                dailyGoal === g ? 'border-brand bg-orange-50 text-brand' : 'border-stone-200'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-stone-500">XP в день</p>
      </section>
      <section className="rounded-3xl bg-white p-4 shadow-sm" data-testid="new-per-day">
        <h2 className="font-bold">Новые слова в день</h2>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {NEW_PER_DAY.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={newPerDay === n}
              onClick={() => update({ newPerDay: n })}
              className={`press rounded-xl border-2 py-2.5 font-semibold ${
                newPerDay === n ? 'border-brand bg-orange-50 text-brand' : 'border-stone-200'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-stone-500">
          Столько новых слов в день просят жители. Это мягкий лимит: учить дальше в городе можно всегда, просто «Продолжить» сначала позовёт на поручения.
        </p>
      </section>
      <ReviewForecast />

      <section className="rounded-3xl bg-white p-4 shadow-sm">
        <h2 className="font-bold">Входной тест</h2>
        <p className="mt-1 text-sm text-stone-500">
          Уже знаете {L.name.toLowerCase()}? Летописец расспросит, где вы бывали, и засчитает знакомые главы. Полученное не отнимается.
        </p>
        <Link to="/placement" className="press mt-3 block rounded-xl bg-wood/10 px-4 py-3 text-center font-semibold" data-testid="settings-placement">
          Пройти входной тест
        </Link>
      </section>
    </>
  );
}

function VoiceSection() {
  const { speechRate, listenOffUntil, voiceM, voiceF, update } = useSettings();
  // Голоса языка в телефоне: на Android список приходит не сразу после запуска.
  const [voices, setVoices] = useState(languageVoices);
  useEffect(() => {
    return onVoicesChanged(() => setVoices([...languageVoices()]));
  }, []);
  const listenOn = listenOffUntil <= Date.now();
  const pausedHour = !listenOn && listenOffUntil < Number.MAX_SAFE_INTEGER;
  const [voiceName, setVoiceName] = useState(() => currentVoice()?.name);
  return (
    <section className="rounded-3xl bg-white p-4 shadow-sm">
      <h2 className="font-bold">Озвучка</h2>
      {!ttsSupported() ? (
        <p className="mt-2 text-sm text-bad">Браузер не поддерживает синтез речи.</p>
      ) : (
        <>
          <label className="mt-3 block text-sm text-stone-600">
            Скорость: {speechRate.toFixed(1)}
            <input
              type="range"
              min={0.5}
              max={1.2}
              step={0.1}
              value={speechRate}
              onChange={(e) => update({ speechRate: Number(e.target.value) })}
              className="mt-1 w-full accent-[var(--color-brand)]"
            />
          </label>
          <Button
            variant="secondary"
            className="mt-2 w-full"
            onClick={() => {
              speak(SAMPLE[LANG]);
              setVoiceName(currentVoice()?.name);
            }}
          >
            🔊 Проверить голос
          </Button>
          <label className="mt-3 flex items-center justify-between gap-3">
            <span>
              Задания на слух
              {pausedHour && <span className="block text-xs text-stone-500">выключены на час кнопкой «Не могу слушать»</span>}
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={listenOn}
              onChange={(e) => update({ listenOffUntil: e.target.checked ? 0 : Number.MAX_SAFE_INTEGER })}
              className="h-6 w-11 accent-[var(--color-brand)]"
            />
          </label>
          {hasLangVoice() === false && (
            <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
              В системе нет голоса для {L.genitive}, поэтому задания на слух не показываются. {L.voiceHint}
            </p>
          )}
          {voices.length > 1 && (
            <div className="mt-3 flex flex-col gap-2" data-testid="gender-voices">
              {([['m', 'Мужской голос', voiceM], ['f', 'Женский голос', voiceF]] as const).map(([g, label, value]) => (
                <label key={g} className="block text-sm text-stone-600">
                  {label}
                  <span className="mt-1 flex gap-2">
                    <select
                      value={value}
                      onChange={(e) => {
                        update(g === 'm' ? { voiceM: e.target.value } : { voiceF: e.target.value });
                        speak(HERO_SAMPLE[LANG], speechRate, 1, g);
                      }}
                      className="h-11 min-w-0 flex-1 rounded-xl border-2 border-stone-200 bg-white px-2 text-base"
                      data-testid={`voice-${g}`}
                    >
                      <option value="">Подобрать самому</option>
                      {voices.map((v) => (
                        <option key={v.name} value={v.name}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      aria-label={`Послушать: ${label.toLowerCase()}`}
                      onClick={() => speak(HERO_SAMPLE[LANG], speechRate, 1, g)}
                      className="press flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-lg"
                    >
                      🔊
                    </button>
                  </span>
                </label>
              ))}
              <p className="text-xs text-stone-500">
                Ими говорят путник и жители своего пола. Если путник звучит не тем голосом, выберите здесь голос, который
                звучит по-мужски или по-женски: послушайте каждый кнопкой 🔊.
              </p>
            </div>
          )}
          <p className="mt-2 text-sm text-stone-500">
            Голос: {voiceName ?? 'системный по умолчанию'}
          </p>
        </>
      )}
    </section>
  );
}

function LanguageSection() {
  return (
    <section className="rounded-3xl bg-white p-4 shadow-sm">
      <h2 className="font-bold">Язык курса</h2>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {(Object.keys(LANGS) as Lang[]).map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={id === LANG}
            onClick={() => switchLang(id)}
            className={`press flex items-center justify-center gap-2 rounded-xl border-2 py-2.5 font-semibold ${
              id === LANG ? 'border-brand bg-orange-50 text-brand' : 'border-stone-200'
            }`}
          >
            <span className="text-xl">{LANGS[id].flag}</span>
            {LANGS[id].name}
          </button>
        ))}
      </div>
      <p className="mt-2 text-sm text-stone-500">
        {L.variety} У каждого языка свой город, слова, монеты и стрик. При переключении приложение перезапустится, прогресс
        другого языка сохранится.
      </p>
    </section>
  );
}

function DataSection() {
  return (
    <section className="rounded-3xl bg-white p-4 shadow-sm">
      <h2 className="font-bold">Прогресс</h2>
      <p className="mt-1 text-sm text-stone-500">
        Хранится только на этом устройстве. Сохраните файл, чтобы перенести прогресс на другой телефон.
      </p>
      <Button
        variant="secondary"
        className="mt-3 w-full"
        onClick={async () => {
          try {
            const where = await saveJsonFile(await exportBackup(), `eslacity-${LANG}-${new Date().toISOString().slice(0, 10)}.json`, downloadJson);
            if (where) alert(`Прогресс сохранён: ${where}`);
          } catch (err) {
            alert(`Не удалось сохранить: ${(err as Error).message}`);
          }
        }}
      >
        Сохранить в файл
      </Button>
      <label className="press mt-2 block w-full cursor-pointer rounded-2xl border border-stone-300 bg-white px-5 py-3.5 text-center font-semibold">
        Загрузить из файла
        <input
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            try {
              const b = parseBackup(await file.text());
              if (!confirm(`Заменить текущий прогресс копией от ${b.exportedAt.slice(0, 10)}?`)) return;
              await importBackup(b);
              location.reload();
            } catch (err) {
              alert((err as Error).message);
            }
          }}
        />
      </label>
      <Button
        variant="secondary"
        className="mt-3 w-full !text-bad"
        onClick={() => {
          if (confirm(`Удалить весь прогресс курса «${L.name}»? Это нельзя отменить. Прогресс других языков останется.`)) resetProgress();
        }}
      >
        Сбросить прогресс
      </Button>
    </section>
  );
}

function AppSection() {
  const { textSize, update } = useSettings();
  return (
    <>
      <section className="rounded-3xl bg-white p-4 shadow-sm" data-testid="text-size">
        <h2 className="font-bold">Размер текста</h2>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {TEXT_SIZES.map((size) => (
            <button
              key={size}
              type="button"
              aria-pressed={textSize === size}
              onClick={() => update({ textSize: size })}
              className={`press rounded-xl border-2 px-1 py-2.5 leading-tight font-semibold ${
                textSize === size ? 'border-brand bg-orange-50 text-brand' : 'border-stone-200'
              }`}
              style={{ fontSize: `${TEXT_SCALE[size]}%` }}
              data-size={size}
            >
              {TEXT_SIZE_LABEL[size]}
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-stone-500">Крупнее становится текст уроков, заданий, разговоров и настроек. Надписи на рисованных рамках главной и на карте города остаются прежними: они нарисованы под свой размер.</p>
      </section>
      <section className="rounded-3xl bg-white p-4 shadow-sm" data-testid="android-app">
        <h2 className="font-bold">Приложение для Android</h2>
        {NATIVE ? (
          <p className="mt-1 text-sm text-stone-500">
            Вы играете в приложении. О новой версии оно скажет само: новый файл APK скачивается с сайта и ставится поверх,
            прогресс остаётся.
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-stone-500">
              Та же игра отдельным приложением для Android 9 и новее: работает без сети и без браузера. Прогресс у приложения свой: перенесите его
              кнопкой «Сохранить в файл» ниже, а в приложении — «Загрузить из файла».
            </p>
            <a
              href={APK_FILE}
              download
              className="press mt-3 block w-full rounded-2xl border border-stone-300 bg-white px-5 py-3.5 text-center font-semibold"
              data-testid="apk-link"
            >
              Скачать APK
            </a>
            <p className="mt-2 text-xs text-stone-500">
              Телефон спросит, можно ли ставить приложения из браузера: разрешите один раз. Новые версии ставятся поверх старой.
            </p>
          </>
        )}
      </section>
      <AboutApp />
    </>
  );
}
