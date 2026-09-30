import { useEffect, useState } from 'react';
import { sagesElsewhere } from '../db/otherLang';
import { SAGE_TITLE } from '../domain/chapters';
import { LANGS, type Lang } from '../lang';
import { Medal } from './Medal';

/** «Мудрец» других языков (задача 8.4): путь, пройденный на первом языке, виден в профиле второго. */
export function SageBadges() {
  const [langs, setLangs] = useState<Lang[]>([]);
  useEffect(() => {
    sagesElsewhere().then(setLangs, () => setLangs([]));
  }, []);
  if (!langs.length) return null;
  return (
    <section className="flex flex-col gap-2 rounded-3xl bg-white p-4 shadow-sm" data-testid="sage-elsewhere">
      {langs.map((l) => (
        <div key={l} className="flex items-center gap-3">
          <Medal icon="secret" tier="gold" size={48} label={`${SAGE_TITLE}: ${LANGS[l].name}`} />
          <div className="flex-1">
            <div className="font-bold">
              {SAGE_TITLE} {LANGS[l].flag}
            </div>
            <div className="text-sm text-stone-500">Путь к Хранилищу пройден: {LANGS[l].name.toLowerCase()}</div>
          </div>
        </div>
      ))}
    </section>
  );
}
