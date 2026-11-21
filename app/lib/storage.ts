"use client";

import { useSyncExternalStore } from "react";
import type { ExamHistoryItem, LearningProgress } from "../types";

const STORAGE_KEY = "hoclaixe_progress_v1";
const MAX_HISTORY_ITEMS = 30;

const EMPTY_PROGRESS: LearningProgress = {
  version: 1,
  studyAnswers: {},
  bookmarks: [],
  wrongIds: [],
  examHistory: [],
};

let cachedRaw: string | null | undefined = undefined;
let cachedProgress: LearningProgress = EMPTY_PROGRESS;
const listeners = new Set<() => void>();

function notifyListeners() {
  for (const listener of listeners) {
    listener();
  }
}

function parseProgress(raw: string | null): LearningProgress {
  if (!raw) return EMPTY_PROGRESS;
  try {
    const parsed = JSON.parse(raw) as Partial<LearningProgress>;
    if (!parsed || typeof parsed !== "object") return EMPTY_PROGRESS;

    const studyAnswers: Record<number, number> = {};
    if (parsed.studyAnswers && typeof parsed.studyAnswers === "object") {
      for (const [key, value] of Object.entries(parsed.studyAnswers)) {
        const id = Number(key);
        if (Number.isInteger(id) && typeof value === "number") {
          studyAnswers[id] = value;
        }
      }
    }

    const bookmarks = Array.isArray(parsed.bookmarks)
      ? Array.from(
          new Set(parsed.bookmarks.filter((n): n is number => Number.isInteger(n))),
        ).sort((a, b) => a - b)
      : [];

    const wrongIds = Array.isArray(parsed.wrongIds)
      ? Array.from(
          new Set(parsed.wrongIds.filter((n): n is number => Number.isInteger(n))),
        ).sort((a, b) => a - b)
      : [];

    const examHistory = Array.isArray(parsed.examHistory)
      ? parsed.examHistory
          .filter(
            (item): item is ExamHistoryItem =>
              Boolean(item) &&
              typeof item === "object" &&
              typeof item.id === "string" &&
              typeof item.correct === "number" &&
              typeof item.total === "number",
          )
          .slice(0, MAX_HISTORY_ITEMS)
      : [];

    return {
      version: 1,
      studyAnswers,
      bookmarks,
      wrongIds,
      examHistory,
    };
  } catch {
    return EMPTY_PROGRESS;
  }
}

function getClientSnapshot(): LearningProgress {
  if (typeof window === "undefined") {
    return EMPTY_PROGRESS;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      cachedProgress = parseProgress(raw);
    }
    return cachedProgress;
  } catch {
    return cachedProgress;
  }
}

function getServerSnapshot(): LearningProgress {
  return EMPTY_PROGRESS;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  if (typeof window === "undefined") {
    return () => {
      listeners.delete(listener);
    };
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === STORAGE_KEY) {
      cachedRaw = undefined;
      notifyListeners();
    }
  };

  window.addEventListener("storage", handleStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
  };
}

function writeProgress(next: LearningProgress) {
  cachedProgress = next;
  if (typeof window === "undefined") return;
  try {
    const serialized = JSON.stringify(next);
    cachedRaw = serialized;
    window.localStorage.setItem(STORAGE_KEY, serialized);
  } catch {
    // Bỏ qua lỗi quota hoặc trình duyệt chặn localStorage
  }
  notifyListeners();
}

export function useLearningProgress(): LearningProgress {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}

export function recordStudyAnswer(
  questionId: number,
  selectedOption: number,
  isCorrect: boolean,
) {
  const current = getClientSnapshot();
  const wrongSet = new Set(current.wrongIds);
  if (isCorrect) {
    wrongSet.delete(questionId);
  } else {
    wrongSet.add(questionId);
  }

  writeProgress({
    ...current,
    studyAnswers: {
      ...current.studyAnswers,
      [questionId]: selectedOption,
    },
    wrongIds: Array.from(wrongSet).sort((a, b) => a - b),
  });
}

export function toggleBookmark(questionId: number) {
  const current = getClientSnapshot();
  const bookmarkSet = new Set(current.bookmarks);
  if (bookmarkSet.has(questionId)) {
    bookmarkSet.delete(questionId);
  } else {
    bookmarkSet.add(questionId);
  }

  writeProgress({
    ...current,
    bookmarks: Array.from(bookmarkSet).sort((a, b) => a - b),
  });
}

export function recordExamSubmission(
  historyItem: ExamHistoryItem,
  newWrongIds: number[],
  masteredIds: number[],
) {
  const current = getClientSnapshot();
  const wrongSet = new Set(current.wrongIds);
  for (const id of masteredIds) {
    wrongSet.delete(id);
  }
  for (const id of newWrongIds) {
    wrongSet.add(id);
  }

  writeProgress({
    ...current,
    wrongIds: Array.from(wrongSet).sort((a, b) => a - b),
    examHistory: [historyItem, ...current.examHistory].slice(0, MAX_HISTORY_ITEMS),
  });
}

export function clearStudyAnswers() {
  const current = getClientSnapshot();
  writeProgress({
    ...current,
    studyAnswers: {},
    wrongIds: [],
  });
}

export function clearAllProgress() {
  writeProgress(EMPTY_PROGRESS);
}
