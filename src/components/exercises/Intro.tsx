import { useEffect } from 'react';
import type { Word } from '../../content/schema';
import { afterPaint } from '../../lib/afterPaint';
import { speak } from '../../audio/tts';
import { Button, SpeakButton, genderLabel } from '../ui';

export function Intro({ word, onNext }: { word: Word; onNext: () => void }) {
  useEffect(() => afterPaint(() => speak(word.es)), [word.es]);
  return (
    <div className="flex flex-1 flex-col">
      <div className="text-sm font-medium text-stone-500">Новое слово</div>
      <div className="mt-6 flex items-center gap-4">
        <div className="flex-1">
          <div className="text-3xl font-bold">{word.es}</div>
          <div className="mt-1 text-xl text-stone-600">{word.ru}</div>
          {word.gender && <div className="mt-1 text-sm text-stone-500">{genderLabel(word.gender)}</div>}
        </div>
        <SpeakButton text={word.es} size="lg" />
      </div>
      <div className="mt-8 flex items-start gap-3 rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex-1">
          <div className="text-lg">{word.example.es}</div>
          <div className="text-stone-500">{word.example.ru}</div>
        </div>
        <SpeakButton text={word.example.es} />
      </div>
      <div className="flex-1" />
      <Button className="w-full" onClick={onNext}>
        Понятно
      </Button>
    </div>
  );
}
