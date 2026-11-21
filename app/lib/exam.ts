import type { Question } from "../types";

export const EXAM_SIZE = 30;
export const EXAM_SECONDS = 20 * 60;
export const PASS_SCORE = 27;
export const FIXED_EXAM_COUNT = 20;

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

// Bố cục đề thi lý thuyết sát hạch lái xe hạng B: 30 câu phân bổ theo 6 chương.
export const EXAM_DISTRIBUTION: {
  chapter: string;
  shortLabel: string;
  count: number;
}[] = [
  {
    chapter: "Quy định chung và quy tắc giao thông",
    shortLabel: "Quy tắc giao thông",
    count: 9,
  },
  {
    chapter: "Văn hóa giao thông, đạo đức người lái xe",
    shortLabel: "Văn hóa & đạo đức",
    count: 1,
  },
  {
    chapter: "Kỹ thuật lái xe",
    shortLabel: "Kỹ thuật lái xe",
    count: 1,
  },
  {
    chapter: "Cấu tạo và sửa chữa",
    shortLabel: "Cấu tạo & sửa chữa",
    count: 1,
  },
  {
    chapter: "Báo hiệu đường bộ",
    shortLabel: "Báo hiệu đường bộ",
    count: 9,
  },
  {
    chapter: "Giải thế sa hình và xử lý tình huống",
    shortLabel: "Sa hình & tình huống",
    count: 9,
  },
];

export const CHAPTER_SHORT_LABELS: Record<string, string> = Object.fromEntries(
  EXAM_DISTRIBUTION.map((item) => [item.chapter, item.shortLabel]),
);

export function formatTime(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

export function withBasePath(path: string): string {
  if (!BASE_PATH || !path.startsWith("/")) {
    return path;
  }
  return `${BASE_PATH}${path}`;
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function groupByChapter(questions: readonly Question[]): Map<string, Question[]> {
  const map = new Map<string, Question[]>();
  for (const question of questions) {
    const bucket = map.get(question.chapter);
    if (bucket) {
      bucket.push(question);
    } else {
      map.set(question.chapter, [question]);
    }
  }
  return map;
}

/**
 * Tạo đề thi thử ngẫu nhiên 30 câu theo đúng cấu trúc đề lý thuyết hạng B.
 * Các câu hỏi được sắp xếp theo thứ tự chương và số câu tăng dần, giữ nguyên
 * thứ tự đáp án của từng câu hỏi.
 */
export function buildRandomExam(questions: readonly Question[]): Question[] {
  const byChapter = groupByChapter(questions);
  const picked: Question[] = [];
  const used = new Set<number>();

  for (const { chapter, count } of EXAM_DISTRIBUTION) {
    const pool = shuffle(byChapter.get(chapter) ?? []);
    const chosen = pool.slice(0, count).sort((a, b) => a.id - b.id);
    for (const question of chosen) {
      picked.push(question);
      used.add(question.id);
    }
  }

  if (picked.length < EXAM_SIZE) {
    const rest = shuffle(questions.filter((q) => !used.has(q.id)));
    for (const question of rest) {
      if (picked.length >= EXAM_SIZE) break;
      picked.push(question);
      used.add(question.id);
    }
  }

  return picked.slice(0, EXAM_SIZE);
}

/**
 * Tạo bộ 20 đề luyện tập chuẩn (cố định giữa các lần truy cập), phân bổ đều
 * các câu hỏi của từng chương để người học có thể luyện theo từng đề.
 */
export function buildFixedExams(
  questions: readonly Question[],
  totalSets: number = FIXED_EXAM_COUNT,
): Question[][] {
  const byChapter = groupByChapter(questions);
  const chapterStreams = new Map<string, Question[]>();

  EXAM_DISTRIBUTION.forEach(({ chapter }, idx) => {
    const pool = byChapter.get(chapter) ?? [];
    chapterStreams.set(chapter, shuffle(pool, createSeededRandom(202501 + idx * 97)));
  });

  const sets: Question[][] = [];
  for (let setIndex = 0; setIndex < totalSets; setIndex += 1) {
    const picked: Question[] = [];
    const used = new Set<number>();

    for (const { chapter, count } of EXAM_DISTRIBUTION) {
      const stream = chapterStreams.get(chapter) ?? [];
      if (stream.length === 0) continue;

      const chosen: Question[] = [];
      let cursor = setIndex * count;
      let attempts = 0;
      while (chosen.length < count && attempts < stream.length * 2) {
        const candidate = stream[cursor % stream.length];
        cursor += 1;
        attempts += 1;
        if (!used.has(candidate.id)) {
          chosen.push(candidate);
          used.add(candidate.id);
        }
      }
      chosen.sort((a, b) => a.id - b.id);
      picked.push(...chosen);
    }

    sets.push(picked.slice(0, EXAM_SIZE));
  }

  return sets;
}
