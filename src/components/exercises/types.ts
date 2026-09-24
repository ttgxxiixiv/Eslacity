import type { Word } from '../../content/schema';
import type { Outcome, Step } from '../../domain/lessonQueue';
import type { Feedback } from '../FeedbackSheet';

export interface ExerciseProps<K extends Step['kind']> {
  step: Extract<Step, { kind: K }>;
  words: Record<string, Word>;
  locked: boolean;
  onAnswer(outcome: Outcome, fb?: Partial<Feedback>): void;
}
