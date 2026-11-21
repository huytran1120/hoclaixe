export type QuestionOption = {
  id: number;
  text: string;
};

export type Question = {
  id: number;
  prompt: string;
  options: QuestionOption[];
  chapter: string;
  images: string[];
  answer: number;
};

export type ExamHistoryItem = {
  id: string;
  label: string;
  examSetId: number | null;
  correct: number;
  wrong: number;
  unanswered: number;
  total: number;
  passed: boolean;
  durationSeconds: number;
  completedAt: string;
};

export type LearningProgress = {
  version: 1;
  studyAnswers: Record<number, number>;
  bookmarks: number[];
  wrongIds: number[];
  examHistory: ExamHistoryItem[];
};
