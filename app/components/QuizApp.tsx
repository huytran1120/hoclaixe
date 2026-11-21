"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QuestionCard from "./QuestionCard";
import {
  buildFixedExams,
  buildRandomExam,
  CHAPTER_SHORT_LABELS,
  EXAM_DISTRIBUTION,
  EXAM_SECONDS,
  EXAM_SIZE,
  FIXED_EXAM_COUNT,
  formatTime,
  PASS_SCORE,
} from "../lib/exam";
import {
  clearAllProgress,
  clearStudyAnswers,
  recordExamSubmission,
  recordStudyAnswer,
  toggleBookmark,
  toggleThemeMode,
  useLearningProgress,
  useTheme,
} from "../lib/storage";
import type { ExamHistoryItem, Question } from "../types";

type Mode = "study" | "exam" | "stats";
type StudyFilter = "all" | "unanswered" | "wrong" | "bookmarked";
type StudyStyle = "quiz" | "memorize";
type ExamStatus = "idle" | "active" | "done";
type ExamReviewFilter = "all" | "mistakes";

type ChapterBreakdown = {
  chapter: string;
  shortLabel: string;
  correct: number;
  total: number;
};

type ExamResult = {
  correct: number;
  wrong: number;
  unanswered: number;
  total: number;
  passed: boolean;
  durationSeconds: number;
  breakdown: ChapterBreakdown[];
};

function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function QuizApp({ questions }: { questions: Question[] }) {
  const progress = useLearningProgress();
  const theme = useTheme();

  const [mode, setMode] = useState<Mode>("study");

  // Trạng thái chế độ Ôn tập
  const [chapter, setChapter] = useState("Tất cả");
  const [studyFilter, setStudyFilter] = useState<StudyFilter>("all");
  const [studyStyle, setStudyStyle] = useState<StudyStyle>("quiz");
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [query, setQuery] = useState("");
  const [studyIndex, setStudyIndex] = useState(0);
  const [peekedIds, setPeekedIds] = useState<Record<number, true>>({});

  // Drawer di động (dùng chung cho Ôn tập & Thi thử)
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  // Trạng thái chế độ Thi thử
  const [examStatus, setExamStatus] = useState<ExamStatus>("idle");
  const [examLabel, setExamLabel] = useState("Đề ngẫu nhiên");
  const [examSetId, setExamSetId] = useState<number | null>(null);
  const [examQuestions, setExamQuestions] = useState<Question[]>([]);
  const [examIndex, setExamIndex] = useState(0);
  const [examAnswers, setExamAnswers] = useState<Record<number, number>>({});
  const [timeLeft, setTimeLeft] = useState(EXAM_SECONDS);
  const [examResult, setExamResult] = useState<ExamResult | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
  const [confirmExitExam, setConfirmExitExam] = useState(false);
  const [reviewFilter, setReviewFilter] = useState<ExamReviewFilter>("all");

  // Xác nhận 2 bước khi đặt lại dữ liệu
  const [confirmReset, setConfirmReset] = useState<"none" | "study" | "all">("none");

  const autoAdvanceTimerRef = useRef<number | null>(null);

  const clearAutoAdvanceTimer = useCallback(() => {
    if (autoAdvanceTimerRef.current !== null) {
      window.clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearAutoAdvanceTimer, [clearAutoAdvanceTimer]);

  const fixedExams = useMemo(
    () => buildFixedExams(questions, FIXED_EXAM_COUNT),
    [questions],
  );

  const bookmarkSet = useMemo(
    () => new Set(progress.bookmarks),
    [progress.bookmarks],
  );
  const wrongSet = useMemo(() => new Set(progress.wrongIds), [progress.wrongIds]);

  const chapterCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const q of questions) {
      counts.set(q.chapter, (counts.get(q.chapter) ?? 0) + 1);
    }
    return counts;
  }, [questions]);

  const chapters = useMemo(
    () => ["Tất cả", ...Array.from(chapterCounts.keys())],
    [chapterCounts],
  );

  const filteredQuestions = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return questions.filter((question) => {
      if (chapter !== "Tất cả" && question.chapter !== chapter) {
        return false;
      }

      if (studyFilter === "unanswered" && progress.studyAnswers[question.id] !== undefined) {
        return false;
      }
      if (studyFilter === "wrong" && !wrongSet.has(question.id)) {
        return false;
      }
      if (studyFilter === "bookmarked" && !bookmarkSet.has(question.id)) {
        return false;
      }

      if (!keyword) return true;
      return (
        question.id.toString() === keyword ||
        question.prompt.toLowerCase().includes(keyword) ||
        question.options.some((opt) => opt.text.toLowerCase().includes(keyword))
      );
    });
  }, [bookmarkSet, chapter, progress.studyAnswers, query, questions, studyFilter, wrongSet]);

  const safeStudyIndex =
    filteredQuestions.length > 0
      ? Math.min(studyIndex, filteredQuestions.length - 1)
      : 0;
  const currentStudyQuestion = filteredQuestions[safeStudyIndex];

  const studySummary = useMemo(() => {
    let answered = 0;
    let correct = 0;
    for (const q of questions) {
      const selected = progress.studyAnswers[q.id];
      if (selected !== undefined) {
        answered += 1;
        if (selected === q.answer) {
          correct += 1;
        }
      }
    }
    return {
      answered,
      correct,
      wrong: answered - correct,
      accuracy: answered > 0 ? Math.round((correct / answered) * 100) : 0,
    };
  }, [progress.studyAnswers, questions]);

  const chapterStats = useMemo(() => {
    return Array.from(chapterCounts.entries()).map(([chapterName, total]) => {
      let answered = 0;
      let correct = 0;
      let wrongCount = 0;
      for (const q of questions) {
        if (q.chapter !== chapterName) continue;
        const selected = progress.studyAnswers[q.id];
        if (selected !== undefined) {
          answered += 1;
          if (selected === q.answer) {
            correct += 1;
          }
        }
        if (wrongSet.has(q.id)) {
          wrongCount += 1;
        }
      }
      return {
        chapter: chapterName,
        shortLabel: CHAPTER_SHORT_LABELS[chapterName] ?? chapterName,
        total,
        answered,
        correct,
        wrongCount,
        completionPct: total > 0 ? Math.round((answered / total) * 100) : 0,
        accuracyPct: answered > 0 ? Math.round((correct / answered) * 100) : 0,
      };
    });
  }, [chapterCounts, progress.studyAnswers, questions, wrongSet]);

  const bestByExamSet = useMemo(() => {
    const map = new Map<number, ExamHistoryItem>();
    for (const item of progress.examHistory) {
      if (item.examSetId === null) continue;
      const existing = map.get(item.examSetId);
      if (
        !existing ||
        item.correct > existing.correct ||
        (item.correct === existing.correct && item.passed && !existing.passed)
      ) {
        map.set(item.examSetId, item);
      }
    }
    return map;
  }, [progress.examHistory]);

  const visibleExamEntries = useMemo(() => {
    return examQuestions
      .map((question, originalIndex) => ({ question, originalIndex }))
      .filter(({ question }) => {
        if (examStatus !== "done" || reviewFilter === "all") return true;
        return examAnswers[question.id] !== question.answer;
      });
  }, [examAnswers, examQuestions, examStatus, reviewFilter]);

  const safeExamEntryIndex =
    visibleExamEntries.length > 0
      ? Math.min(examIndex, visibleExamEntries.length - 1)
      : 0;
  const currentExamEntry = visibleExamEntries[safeExamEntryIndex];

  const handleSelectStudyOption = useCallback(
    (question: Question, optionId: number) => {
      clearAutoAdvanceTimer();
      const isCorrect = optionId === question.answer;
      recordStudyAnswer(question.id, optionId, isCorrect);

      if (autoAdvance && isCorrect && safeStudyIndex < filteredQuestions.length - 1) {
        autoAdvanceTimerRef.current = window.setTimeout(() => {
          setStudyIndex((v) => Math.min(filteredQuestions.length - 1, v + 1));
          autoAdvanceTimerRef.current = null;
        }, 550);
      }
    },
    [autoAdvance, clearAutoAdvanceTimer, filteredQuestions.length, safeStudyIndex],
  );

  const submitExam = useCallback(() => {
    if (examQuestions.length === 0) return;

    let correct = 0;
    let unanswered = 0;
    const newWrongIds: number[] = [];
    const masteredIds: number[] = [];
    const chapterMap = new Map<string, { correct: number; total: number }>();

    for (const question of examQuestions) {
      const stats = chapterMap.get(question.chapter) ?? { correct: 0, total: 0 };
      stats.total += 1;

      const selected = examAnswers[question.id];
      if (selected === undefined) {
        unanswered += 1;
        newWrongIds.push(question.id);
      } else if (selected === question.answer) {
        correct += 1;
        stats.correct += 1;
        masteredIds.push(question.id);
      } else {
        newWrongIds.push(question.id);
      }
      chapterMap.set(question.chapter, stats);
    }

    const total = examQuestions.length;
    const wrong = total - correct - unanswered;
    const passed = correct >= PASS_SCORE;
    const durationSeconds = Math.max(1, EXAM_SECONDS - timeLeft);

    const breakdown: ChapterBreakdown[] = EXAM_DISTRIBUTION.filter(({ chapter: c }) =>
      chapterMap.has(c),
    ).map(({ chapter: c, shortLabel }) => {
      const entry = chapterMap.get(c)!;
      return {
        chapter: c,
        shortLabel,
        correct: entry.correct,
        total: entry.total,
      };
    });

    setExamResult({
      correct,
      wrong,
      unanswered,
      total,
      passed,
      durationSeconds,
      breakdown,
    });
    setConfirmSubmitOpen(false);
    setConfirmExitExam(false);
    setMobileSheetOpen(false);
    setReviewFilter("all");
    setExamIndex(0);
    setExamStatus("done");
    setShowResultModal(true);

    recordExamSubmission(
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        label: examLabel,
        examSetId,
        correct,
        wrong,
        unanswered,
        total,
        passed,
        durationSeconds,
        completedAt: new Date().toISOString(),
      },
      newWrongIds,
      masteredIds,
    );
  }, [examAnswers, examLabel, examQuestions, examSetId, timeLeft]);

  const submitExamRef = useRef(submitExam);
  useEffect(() => {
    submitExamRef.current = submitExam;
  }, [submitExam]);

  useEffect(() => {
    if (examStatus !== "active") return;

    const timer = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          window.setTimeout(() => submitExamRef.current(), 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [examStatus]);

  // Khóa cuộn trang nền khi mở drawer hoặc modal
  const hasOverlayOpen = mobileSheetOpen || confirmSubmitOpen || showResultModal;
  useEffect(() => {
    if (!hasOverlayOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [hasOverlayOpen]);

  const startExamWith = useCallback(
    (picked: Question[], label: string, setId: number | null) => {
      clearAutoAdvanceTimer();
      setExamQuestions(picked);
      setExamLabel(label);
      setExamSetId(setId);
      setExamAnswers({});
      setExamResult(null);
      setExamIndex(0);
      setTimeLeft(EXAM_SECONDS);
      setShowResultModal(false);
      setConfirmSubmitOpen(false);
      setConfirmExitExam(false);
      setMobileSheetOpen(false);
      setReviewFilter("all");
      setExamStatus("active");
      setMode("exam");
    },
    [clearAutoAdvanceTimer],
  );

  const startRandomExam = useCallback(() => {
    startExamWith(buildRandomExam(questions), "Đề ngẫu nhiên", null);
  }, [questions, startExamWith]);

  const startFixedExam = useCallback(
    (setNumber: number) => {
      const picked = fixedExams[setNumber - 1];
      if (!picked) return;
      startExamWith(picked, `Đề số ${setNumber}`, setNumber);
    },
    [fixedExams, startExamWith],
  );

  const jumpToStudy = useCallback(
    (nextChapter: string, nextFilter: StudyFilter) => {
      clearAutoAdvanceTimer();
      setChapter(nextChapter);
      setStudyFilter(nextFilter);
      setQuery("");
      setStudyIndex(0);
      setMobileSheetOpen(false);
      setMode("study");
    },
    [clearAutoAdvanceTimer],
  );

  const goStudyPrev = useCallback(() => {
    clearAutoAdvanceTimer();
    setStudyIndex((v) => Math.max(0, v - 1));
  }, [clearAutoAdvanceTimer]);

  const goStudyNext = useCallback(() => {
    clearAutoAdvanceTimer();
    setStudyIndex((v) => Math.min(filteredQuestions.length - 1, v + 1));
  }, [clearAutoAdvanceTimer, filteredQuestions.length]);

  const goExamPrev = useCallback(() => {
    setExamIndex((v) => Math.max(0, v - 1));
  }, []);

  const goExamNext = useCallback(() => {
    setExamIndex((v) => Math.min(visibleExamEntries.length - 1, v + 1));
  }, [visibleExamEntries.length]);

  // Phím tắt tiện dụng cho người dùng laptop
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (event.key === "Escape") {
        if (confirmSubmitOpen) {
          setConfirmSubmitOpen(false);
          return;
        }
        if (showResultModal) {
          setShowResultModal(false);
          return;
        }
        if (mobileSheetOpen) {
          setMobileSheetOpen(false);
          return;
        }
      }

      if (confirmSubmitOpen || showResultModal || mobileSheetOpen) return;

      if (mode === "study" && currentStudyQuestion) {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          goStudyPrev();
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          goStudyNext();
        } else if (event.key === "b" || event.key === "B") {
          event.preventDefault();
          toggleBookmark(currentStudyQuestion.id);
        } else if (event.key === " ") {
          if (
            studyStyle === "quiz" &&
            progress.studyAnswers[currentStudyQuestion.id] === undefined
          ) {
            event.preventDefault();
            setPeekedIds((prev) => ({ ...prev, [currentStudyQuestion.id]: true }));
          }
        } else if (["1", "2", "3", "4"].includes(event.key)) {
          const optId = Number(event.key);
          if (currentStudyQuestion.options.some((o) => o.id === optId)) {
            event.preventDefault();
            handleSelectStudyOption(currentStudyQuestion, optId);
          }
        }
      } else if (mode === "exam" && examStatus !== "idle" && currentExamEntry) {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          goExamPrev();
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          goExamNext();
        } else if (event.key === "b" || event.key === "B") {
          event.preventDefault();
          toggleBookmark(currentExamEntry.question.id);
        } else if (examStatus === "active" && ["1", "2", "3", "4"].includes(event.key)) {
          const optId = Number(event.key);
          if (currentExamEntry.question.options.some((o) => o.id === optId)) {
            event.preventDefault();
            const qId = currentExamEntry.question.id;
            setExamAnswers((prev) => ({ ...prev, [qId]: optId }));
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    confirmSubmitOpen,
    currentExamEntry,
    currentStudyQuestion,
    examStatus,
    goExamNext,
    goExamPrev,
    goStudyNext,
    goStudyPrev,
    handleSelectStudyOption,
    mobileSheetOpen,
    mode,
    progress.studyAnswers,
    showResultModal,
    studyStyle,
  ]);

  const answeredExamCount = Object.keys(examAnswers).length;
  const remainingExamUnanswered = Math.max(0, examQuestions.length - answeredExamCount);
  const timerState =
    timeLeft <= 60 ? "urgent" : timeLeft <= 180 ? "warning" : "normal";
  const passedExamsCount = progress.examHistory.filter((item) => item.passed).length;

  const activeStudyFilterCount =
    (chapter !== "Tất cả" ? 1 : 0) +
    (studyFilter !== "all" ? 1 : 0) +
    (query.trim() ? 1 : 0);

  const handleRequestSubmit = () => {
    setMobileSheetOpen(false);
    if (remainingExamUnanswered > 0) {
      setConfirmSubmitOpen(true);
    } else {
      submitExam();
    }
  };

  const hasMobileBottomBar =
    mode === "study" || (mode === "exam" && examStatus !== "idle");

  // Khối nội dung bảng điều khiển Ôn tập (dùng chung cho Sidebar laptop & Drawer điện thoại)
  const studySidebarContent = (
    <>
      <div className="sidebar-progress">
        <div className="progress-row">
          <span>Tiến độ ôn tập</span>
          <strong>
            {studySummary.answered} / {questions.length} câu
          </strong>
        </div>
        <div
          className="progress-track"
          role="progressbar"
          aria-valuenow={studySummary.answered}
          aria-valuemin={0}
          aria-valuemax={questions.length}
        >
          <div
            className="progress-fill"
            style={{
              width: `${Math.round((studySummary.answered / questions.length) * 100)}%`,
            }}
          />
        </div>
        <div className="mini-metrics">
          <span className="metric-ok">Đúng: {studySummary.correct}</span>
          <span className="metric-bad">Làm sai: {progress.wrongIds.length}</span>
          <span className="metric-mark">Đã lưu: {progress.bookmarks.length}</span>
        </div>
      </div>

      <div className="study-style-box">
        <div className="segmented-mini" role="group" aria-label="Cách học">
          <button
            type="button"
            className={studyStyle === "quiz" ? "active" : ""}
            onClick={() => setStudyStyle("quiz")}
          >
            Tự kiểm tra
          </button>
          <button
            type="button"
            className={studyStyle === "memorize" ? "active" : ""}
            onClick={() => setStudyStyle("memorize")}
          >
            Hiện sẵn đáp án
          </button>
        </div>

        {studyStyle === "quiz" ? (
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={autoAdvance}
              onChange={(event) => setAutoAdvance(event.target.checked)}
            />
            <span>Tự chuyển câu tiếp khi chọn đúng</span>
          </label>
        ) : null}
      </div>

      <label className="field-stack">
        <span className="field-label">Chương học</span>
        <select
          value={chapter}
          onChange={(event) => {
            clearAutoAdvanceTimer();
            setChapter(event.target.value);
            setStudyIndex(0);
          }}
        >
          {chapters.map((item) => {
            const count =
              item === "Tất cả" ? questions.length : (chapterCounts.get(item) ?? 0);
            return (
              <option key={item} value={item}>
                {item} ({count})
              </option>
            );
          })}
        </select>
      </label>

      <div className="filter-chips" role="group" aria-label="Lọc câu hỏi theo trạng thái">
        {(
          [
            { id: "all", label: "Tất cả" },
            { id: "unanswered", label: "Chưa làm" },
            { id: "wrong", label: `Làm sai (${progress.wrongIds.length})` },
            { id: "bookmarked", label: `Đã lưu (${progress.bookmarks.length})` },
          ] as const
        ).map((chip) => (
          <button
            key={chip.id}
            type="button"
            className={`chip-btn${studyFilter === chip.id ? " active" : ""}`}
            onClick={() => {
              clearAutoAdvanceTimer();
              setStudyFilter(chip.id);
              setStudyIndex(0);
            }}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <label className="field-stack">
        <span className="field-label">Tìm câu hỏi</span>
        <div className="search-box">
          <input
            value={query}
            onChange={(event) => {
              clearAutoAdvanceTimer();
              setQuery(event.target.value);
              setStudyIndex(0);
            }}
            placeholder="Nhập số câu (VD: 120) hoặc từ khóa..."
          />
          {query ? (
            <button
              type="button"
              className="search-clear"
              onClick={() => {
                setQuery("");
                setStudyIndex(0);
              }}
              aria-label="Xóa từ khóa"
            >
              ✕
            </button>
          ) : null}
        </div>
      </label>

      <div className="grid-header">
        <span>Chọn nhanh câu hỏi</span>
        <span>{filteredQuestions.length} câu</span>
      </div>

      <div className="legend-row" aria-hidden="true">
        <span>
          <i className="dot dot-current" /> Đang xem
        </span>
        <span>
          <i className="dot dot-ok" /> Đúng
        </span>
        <span>
          <i className="dot dot-bad" /> Sai
        </span>
        <span>
          <i className="dot dot-mark" /> Đã lưu
        </span>
      </div>

      <div className="question-grid" aria-label="Danh sách câu hỏi">
        {filteredQuestions.map((question, index) => {
          const answered = progress.studyAnswers[question.id];
          const isCorrect = answered !== undefined && answered === question.answer;
          const isWrong = answered !== undefined && answered !== question.answer;
          const isBookmarked = bookmarkSet.has(question.id);

          return (
            <button
              key={question.id}
              type="button"
              className={[
                index === safeStudyIndex ? "current" : "",
                isCorrect ? "tile-correct" : "",
                isWrong ? "tile-wrong" : "",
                isBookmarked ? "tile-bookmarked" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => {
                clearAutoAdvanceTimer();
                setStudyIndex(index);
                setMobileSheetOpen(false);
              }}
            >
              {question.id}
            </button>
          );
        })}
      </div>
    </>
  );

  // Khối nội dung điều khiển Thi thử (Sidebar laptop & Drawer điện thoại)
  const examSidebarContent = (
    <>
      <div className="exam-header-box">
        <span className="pill pill-primary">{examLabel}</span>
        {examStatus === "active" ? (
          confirmExitExam ? (
            <div className="inline-confirm">
              <button
                type="button"
                className="danger-link"
                onClick={() => {
                  setExamStatus("idle");
                  setConfirmExitExam(false);
                  setMobileSheetOpen(false);
                }}
              >
                Xác nhận thoát
              </button>
              <button
                type="button"
                className="muted-link"
                onClick={() => setConfirmExitExam(false)}
              >
                Hủy
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="muted-link"
              onClick={() => setConfirmExitExam(true)}
            >
              Thoát đề
            </button>
          )
        ) : (
          <button
            type="button"
            className="muted-link"
            onClick={() => {
              setExamStatus("idle");
              setMobileSheetOpen(false);
            }}
          >
            Chọn đề khác
          </button>
        )}
      </div>

      <div className={`timer-card ${examStatus === "active" ? timerState : "done"}`}>
        <span>{examStatus === "active" ? "Thời gian còn lại" : "Thời gian hoàn thành"}</span>
        <strong>
          {examStatus === "active"
            ? formatTime(timeLeft)
            : formatTime(examResult?.durationSeconds ?? 0)}
        </strong>
        <p>
          Đã chọn {answeredExamCount} / {examQuestions.length} câu
        </p>
      </div>

      {examStatus === "done" && examResult ? (
        <div className={`result-summary-card ${examResult.passed ? "passed" : "failed"}`}>
          <div className="result-summary-head">
            <span>{examResult.passed ? "Đạt yêu cầu" : "Chưa đạt yêu cầu"}</span>
            <strong>
              {examResult.correct}/{examResult.total}
            </strong>
          </div>
          <p>
            Đúng {examResult.correct} · Sai {examResult.wrong} · Bỏ trống {examResult.unanswered} (
            {Math.round((examResult.correct / examResult.total) * 100)}%)
          </p>
          <div className="result-summary-actions">
            <button
              type="button"
              className="ghost-btn small"
              onClick={() => {
                setMobileSheetOpen(false);
                setShowResultModal(true);
              }}
            >
              Chi tiết kết quả
            </button>
            <button type="button" className="primary-btn small" onClick={startRandomExam}>
              Đề mới
            </button>
          </div>
        </div>
      ) : null}

      {examStatus === "done" ? (
        <div className="filter-chips" role="group" aria-label="Lọc câu xem lại">
          <button
            type="button"
            className={`chip-btn${reviewFilter === "all" ? " active" : ""}`}
            onClick={() => {
              setReviewFilter("all");
              setExamIndex(0);
            }}
          >
            Tất cả ({examQuestions.length})
          </button>
          <button
            type="button"
            className={`chip-btn${reviewFilter === "mistakes" ? " active" : ""}`}
            onClick={() => {
              setReviewFilter("mistakes");
              setExamIndex(0);
            }}
          >
            Câu sai & bỏ trống ({(examResult?.wrong ?? 0) + (examResult?.unanswered ?? 0)})
          </button>
        </div>
      ) : null}

      <div className="question-grid exam-grid" aria-label="Danh sách câu trong đề">
        {visibleExamEntries.map(({ question, originalIndex }, idx) => {
          const selected = examAnswers[question.id];
          const isCorrect = examStatus === "done" && selected === question.answer;
          const isWrong = examStatus === "done" && selected !== question.answer;

          return (
            <button
              key={question.id}
              type="button"
              className={[
                idx === safeExamEntryIndex ? "current" : "",
                examStatus === "active" && selected !== undefined ? "tile-answered" : "",
                isCorrect ? "tile-correct" : "",
                isWrong ? "tile-wrong" : "",
                bookmarkSet.has(question.id) ? "tile-bookmarked" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => {
                setExamIndex(idx);
                setMobileSheetOpen(false);
              }}
            >
              {originalIndex + 1}
            </button>
          );
        })}
      </div>

      {examStatus === "active" ? (
        <button type="button" className="primary-btn full-width" onClick={handleRequestSubmit}>
          Nộp bài ({answeredExamCount}/{examQuestions.length})
        </button>
      ) : null}
    </>
  );

  return (
    <div className={`app-shell${hasMobileBottomBar ? " has-mobile-bar" : ""}`}>
      <header className="topbar">
        <div className="topbar-row">
          <div className="brand-group">
            <div className="brand-mark" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 64 64" fill="none">
                <circle cx="32" cy="32" r="20" stroke="currentColor" strokeWidth="5.5" />
                <circle cx="32" cy="32" r="5" fill="currentColor" />
                <path
                  d="M14 29H50"
                  stroke="currentColor"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
                <path
                  d="M32 35V51"
                  stroke="currentColor"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div>
              <h1>Học Lái Xe</h1>
              <p className="eyebrow">600 câu lý thuyết sát hạch</p>
            </div>
          </div>

          <nav className="mode-switch desktop-nav" aria-label="Điều hướng chính">
            <button
              type="button"
              className={mode === "study" ? "active" : ""}
              onClick={() => {
                setMobileSheetOpen(false);
                setMode("study");
              }}
            >
              Ôn tập
            </button>
            <button
              type="button"
              className={mode === "exam" ? "active" : ""}
              onClick={() => {
                setMobileSheetOpen(false);
                setMode("exam");
              }}
            >
              Thi thử
              {examStatus === "active" ? (
                <span className="live-dot" aria-label="Đang làm bài" />
              ) : null}
            </button>
            <button
              type="button"
              className={mode === "stats" ? "active" : ""}
              onClick={() => {
                setMobileSheetOpen(false);
                setConfirmReset("none");
                setMode("stats");
              }}
            >
              Thống kê
            </button>
          </nav>

          <button
            type="button"
            className="theme-btn"
            onClick={toggleThemeMode}
            aria-label={theme === "dark" ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
            title={theme === "dark" ? "Giao diện sáng" : "Giao diện tối"}
          >
            {theme === "dark" ? (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
              </svg>
            ) : (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
              </svg>
            )}
            <span className="theme-label">{theme === "dark" ? "Sáng" : "Tối"}</span>
          </button>
        </div>

        <nav className="mode-switch mobile-nav" aria-label="Điều hướng di động">
          <button
            type="button"
            className={mode === "study" ? "active" : ""}
            onClick={() => {
              setMobileSheetOpen(false);
              setMode("study");
            }}
          >
            Ôn tập
          </button>
          <button
            type="button"
            className={mode === "exam" ? "active" : ""}
            onClick={() => {
              setMobileSheetOpen(false);
              setMode("exam");
            }}
          >
            Thi thử
            {examStatus === "active" ? (
              <span className="live-dot" aria-label="Đang làm bài" />
            ) : null}
          </button>
          <button
            type="button"
            className={mode === "stats" ? "active" : ""}
            onClick={() => {
              setMobileSheetOpen(false);
              setConfirmReset("none");
              setMode("stats");
            }}
          >
            Thống kê
          </button>
        </nav>
      </header>

      {mode === "study" ? (
        <>
          {/* Thanh điều khiển gọn trên điện thoại / máy tính bảng */}
          <div className="mobile-toolbar">
            <button
              type="button"
              className={`toolbar-pill${activeStudyFilterCount > 0 ? " active" : ""}`}
              onClick={() => setMobileSheetOpen(true)}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
              <span>
                {chapter === "Tất cả" ? "Lọc & tìm" : CHAPTER_SHORT_LABELS[chapter] ?? chapter}
              </span>
              {activeStudyFilterCount > 0 ? (
                <span className="badge-count">{activeStudyFilterCount}</span>
              ) : null}
            </button>

            <button
              type="button"
              className={`toolbar-pill${studyStyle === "memorize" ? " active" : ""}`}
              onClick={() =>
                setStudyStyle((prev) => (prev === "quiz" ? "memorize" : "quiz"))
              }
            >
              {studyStyle === "memorize" ? "✓ Hiện sẵn đáp án" : "Hiện sẵn đáp án"}
            </button>

            <span className="toolbar-progress">
              {studySummary.answered}/{questions.length}
            </span>
          </div>

          <main className="workspace">
            <aside className="sidebar desktop-sidebar">{studySidebarContent}</aside>

            <section className="main-column">
              {currentStudyQuestion ? (
                <>
                  <QuestionCard
                    question={currentStudyQuestion}
                    selected={progress.studyAnswers[currentStudyQuestion.id]}
                    reveal={
                      studyStyle === "memorize" ||
                      progress.studyAnswers[currentStudyQuestion.id] !== undefined ||
                      Boolean(peekedIds[currentStudyQuestion.id])
                    }
                    studyShowAllMode={studyStyle === "memorize"}
                    isBookmarked={bookmarkSet.has(currentStudyQuestion.id)}
                    canPeekAnswer={
                      studyStyle === "quiz" &&
                      progress.studyAnswers[currentStudyQuestion.id] === undefined
                    }
                    onPeekAnswer={() =>
                      setPeekedIds((prev) => ({
                        ...prev,
                        [currentStudyQuestion.id]: true,
                      }))
                    }
                    onToggleBookmark={() => toggleBookmark(currentStudyQuestion.id)}
                    onSelect={(optionId) =>
                      handleSelectStudyOption(currentStudyQuestion, optionId)
                    }
                    onSwipePrev={goStudyPrev}
                    onSwipeNext={goStudyNext}
                  />

                  <div className="pager-bar desktop-pager">
                    <p className="shortcut-hint">
                      Phím tắt: <kbd>←</kbd> <kbd>→</kbd> chuyển câu · <kbd>1</kbd>–<kbd>4</kbd>{" "}
                      chọn · <kbd>Space</kbd> xem đáp án · <kbd>B</kbd> lưu
                    </p>
                    <div className="pager">
                      <button
                        type="button"
                        disabled={safeStudyIndex === 0}
                        onClick={goStudyPrev}
                      >
                        ← Câu trước
                      </button>
                      <span className="pager-counter">
                        {safeStudyIndex + 1} / {filteredQuestions.length}
                      </span>
                      <button
                        type="button"
                        disabled={safeStudyIndex >= filteredQuestions.length - 1}
                        onClick={goStudyNext}
                      >
                        Câu tiếp →
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="empty-card">
                  <h2>Không có câu hỏi phù hợp</h2>
                  <p>Hãy thử đổi bộ lọc trạng thái, chọn chương khác hoặc xóa từ khóa tìm kiếm.</p>
                  <button
                    type="button"
                    className="primary-btn"
                    onClick={() => {
                      setChapter("Tất cả");
                      setStudyFilter("all");
                      setQuery("");
                      setStudyIndex(0);
                    }}
                  >
                    Hiển thị lại tất cả 600 câu
                  </button>
                </div>
              )}
            </section>
          </main>

          {/* Thanh điều hướng cố định dưới đáy cho điện thoại */}
          <div className="mobile-bottom-bar">
            <button
              type="button"
              className="mbar-nav"
              disabled={safeStudyIndex === 0 || filteredQuestions.length === 0}
              onClick={goStudyPrev}
              aria-label="Câu trước"
            >
              ← Trước
            </button>
            <button
              type="button"
              className="mbar-center"
              onClick={() => setMobileSheetOpen(true)}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
              <span>
                {filteredQuestions.length > 0
                  ? `${safeStudyIndex + 1} / ${filteredQuestions.length}`
                  : "0 / 0"}
              </span>
            </button>
            <button
              type="button"
              className="mbar-nav primary"
              disabled={
                filteredQuestions.length === 0 || safeStudyIndex >= filteredQuestions.length - 1
              }
              onClick={goStudyNext}
              aria-label="Câu tiếp theo"
            >
              Tiếp →
            </button>
          </div>
        </>
      ) : mode === "exam" ? (
        examStatus === "idle" ? (
          <main className="exam-lobby">
            <section className="hero-card">
              <div className="hero-copy">
                <span className="pill pill-primary">Cấu trúc lý thuyết hạng B</span>
                <h2>Thi thử 30 câu hỏi trong 20 phút</h2>
                <p>
                  Đề thi được phân bổ đúng 6 chương chuẩn. Trả lời đúng tối thiểu{" "}
                  <strong>
                    {PASS_SCORE}/{EXAM_SIZE} câu
                  </strong>{" "}
                  để đạt yêu cầu. Bạn có thể tạo đề ngẫu nhiên hoặc luyện lần lượt theo bộ{" "}
                  {FIXED_EXAM_COUNT} đề chuẩn bên dưới.
                </p>

                <div className="distribution-grid">
                  {EXAM_DISTRIBUTION.map((item) => (
                    <div key={item.chapter} className="dist-item">
                      <strong>{item.count} câu</strong>
                      <span>{item.shortLabel}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="hero-actions">
                <button type="button" className="primary-btn large" onClick={startRandomExam}>
                  Tạo đề ngẫu nhiên
                </button>
                <p className="hero-note">
                  Chấm điểm ngay sau khi nộp, thống kê theo từng chương và tự động lưu câu làm sai
                  để bạn ôn lại.
                </p>
              </div>
            </section>

            <section className="section-card">
              <div className="section-head">
                <div>
                  <h3>Bộ {FIXED_EXAM_COUNT} đề luyện tập chuẩn</h3>
                  <p>Phân bổ đều từ ngân hàng 600 câu hỏi giúp bạn ôn luyện có hệ thống.</p>
                </div>
                <span className="pill pill-muted">
                  Đã vượt qua: {Array.from(bestByExamSet.values()).filter((x) => x.passed).length}/
                  {FIXED_EXAM_COUNT} đề
                </span>
              </div>

              <div className="exam-set-grid">
                {fixedExams.map((_, idx) => {
                  const setNum = idx + 1;
                  const best = bestByExamSet.get(setNum);
                  return (
                    <button
                      key={setNum}
                      type="button"
                      className={`exam-set-card${
                        best ? (best.passed ? " passed" : " attempted") : ""
                      }`}
                      onClick={() => startFixedExam(setNum)}
                    >
                      <span className="set-title">Đề số {setNum}</span>
                      <span className="set-meta">
                        {best
                          ? `${best.passed ? "✓ Đạt" : "Chưa đạt"} · ${best.correct}/${best.total}`
                          : `${EXAM_SIZE} câu · 20 phút`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {progress.examHistory.length > 0 ? (
              <section className="section-card">
                <div className="section-head">
                  <div>
                    <h3>Lần thi thử gần đây</h3>
                    <p>5 lượt làm bài mới nhất được lưu trên trình duyệt của bạn.</p>
                  </div>
                  <button type="button" className="ghost-btn small" onClick={() => setMode("stats")}>
                    Xem toàn bộ
                  </button>
                </div>

                <div className="history-list">
                  {progress.examHistory.slice(0, 5).map((item) => (
                    <div key={item.id} className="history-row">
                      <div>
                        <strong>{item.label}</strong>
                        <span className="muted-text">{formatDateTime(item.completedAt)}</span>
                      </div>
                      <div className="history-badges">
                        <span className="muted-text">{formatTime(item.durationSeconds)}</span>
                        <span className={`pill ${item.passed ? "pill-ok" : "pill-bad"}`}>
                          {item.passed ? "Đạt" : "Chưa đạt"} · {item.correct}/{item.total}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </main>
        ) : (
          <>
            {/* Thanh trạng thái bài thi ghim trên điện thoại */}
            <div className="mobile-exam-bar">
              <div className="mexam-left">
                <span
                  className={`mexam-timer ${examStatus === "active" ? timerState : "done"}`}
                >
                  {examStatus === "active"
                    ? formatTime(timeLeft)
                    : `${examResult?.correct ?? 0}/${examQuestions.length}`}
                </span>
                <span className="mexam-sub">
                  {examStatus === "active"
                    ? `${answeredExamCount}/${examQuestions.length} đã chọn`
                    : examResult?.passed
                      ? "Đạt yêu cầu"
                      : "Chưa đạt"}
                </span>
              </div>

              <div className="mexam-actions">
                {examStatus === "active" ? (
                  <button
                    type="button"
                    className="primary-btn small"
                    onClick={handleRequestSubmit}
                  >
                    Nộp bài
                  </button>
                ) : (
                  <button
                    type="button"
                    className="primary-btn small"
                    onClick={() => setShowResultModal(true)}
                  >
                    Kết quả
                  </button>
                )}
              </div>
            </div>

            <main className="workspace">
              <aside className="sidebar desktop-sidebar">{examSidebarContent}</aside>

              <section className="main-column">
                {currentExamEntry ? (
                  <>
                    <QuestionCard
                      question={currentExamEntry.question}
                      badgeText={`Câu ${currentExamEntry.originalIndex + 1}/${examQuestions.length} · Mã ${currentExamEntry.question.id}`}
                      selected={examAnswers[currentExamEntry.question.id]}
                      reveal={examStatus === "done"}
                      readOnly={examStatus === "done"}
                      isBookmarked={bookmarkSet.has(currentExamEntry.question.id)}
                      onToggleBookmark={() => toggleBookmark(currentExamEntry.question.id)}
                      onSelect={(optionId) => {
                        if (examStatus !== "active") return;
                        const qId = currentExamEntry.question.id;
                        setExamAnswers((prev) => ({ ...prev, [qId]: optionId }));
                      }}
                      onSwipePrev={goExamPrev}
                      onSwipeNext={goExamNext}
                    />

                    <div className="pager-bar desktop-pager">
                      <p className="shortcut-hint">
                        Phím tắt: <kbd>←</kbd> <kbd>→</kbd> chuyển câu
                        {examStatus === "active" ? (
                          <>
                            {" "}
                            · <kbd>1</kbd>–<kbd>4</kbd> chọn đáp án
                          </>
                        ) : null}{" "}
                        · <kbd>B</kbd> lưu
                      </p>
                      <div className="pager">
                        <button
                          type="button"
                          disabled={safeExamEntryIndex === 0}
                          onClick={goExamPrev}
                        >
                          ← Câu trước
                        </button>
                        <span className="pager-counter">
                          {safeExamEntryIndex + 1} / {visibleExamEntries.length}
                        </span>
                        <button
                          type="button"
                          disabled={safeExamEntryIndex >= visibleExamEntries.length - 1}
                          onClick={goExamNext}
                        >
                          Câu tiếp →
                        </button>
                        {examStatus === "active" ? (
                          <button
                            type="button"
                            className="primary-btn"
                            onClick={handleRequestSubmit}
                          >
                            Nộp bài
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="empty-card">
                    <h2>Tuyệt vời! Bạn không làm sai câu nào</h2>
                    <p>Toàn bộ 30 câu trong đề này đều đã được trả lời chính xác.</p>
                    <button
                      type="button"
                      className="primary-btn"
                      onClick={() => {
                        setReviewFilter("all");
                        setExamIndex(0);
                      }}
                    >
                      Xem lại toàn bộ 30 câu
                    </button>
                  </div>
                )}
              </section>
            </main>

            {/* Thanh điều hướng dưới đáy cho Thi thử trên điện thoại */}
            <div className="mobile-bottom-bar">
              <button
                type="button"
                className="mbar-nav"
                disabled={safeExamEntryIndex === 0 || visibleExamEntries.length === 0}
                onClick={goExamPrev}
                aria-label="Câu trước"
              >
                ← Trước
              </button>
              <button
                type="button"
                className="mbar-center"
                onClick={() => setMobileSheetOpen(true)}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
                <span>
                  {visibleExamEntries.length > 0
                    ? `Câu ${safeExamEntryIndex + 1}/${visibleExamEntries.length}`
                    : "Danh sách"}
                </span>
              </button>
              <button
                type="button"
                className="mbar-nav primary"
                disabled={
                  visibleExamEntries.length === 0 ||
                  safeExamEntryIndex >= visibleExamEntries.length - 1
                }
                onClick={goExamNext}
                aria-label="Câu tiếp theo"
              >
                Tiếp →
              </button>
            </div>

            {confirmSubmitOpen ? (
              <div
                className="modal-overlay"
                role="dialog"
                aria-modal="true"
                aria-label="Xác nhận nộp bài"
                onClick={() => setConfirmSubmitOpen(false)}
              >
                <div className="modal-card" onClick={(event) => event.stopPropagation()}>
                  <h2>Xác nhận nộp bài?</h2>
                  <p>
                    Bạn đã trả lời{" "}
                    <strong>
                      {answeredExamCount}/{examQuestions.length}
                    </strong>{" "}
                    câu và vẫn còn <strong>{remainingExamUnanswered} câu bỏ trống</strong>. Những
                    câu bỏ trống sẽ tính là chưa đúng.
                  </p>
                  <div className="modal-actions">
                    <button
                      type="button"
                      className="ghost-btn"
                      onClick={() => setConfirmSubmitOpen(false)}
                    >
                      Tiếp tục làm bài
                    </button>
                    <button type="button" className="primary-btn" onClick={submitExam}>
                      Vẫn nộp bài
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {showResultModal && examResult ? (
              <div
                className="modal-overlay"
                role="dialog"
                aria-modal="true"
                aria-label="Kết quả bài thi thử"
                onClick={() => setShowResultModal(false)}
              >
                <div
                  className={`modal-card result-modal ${examResult.passed ? "passed" : "failed"}`}
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="result-icon" aria-hidden="true">
                    {examResult.passed ? "✓" : "!"}
                  </div>
                  <p className="result-label">{examLabel}</p>
                  <h2>
                    {examResult.passed
                      ? "Chúc mừng! Bạn đã đạt bài thi thử"
                      : "Chưa đạt yêu cầu bài thi thử"}
                  </h2>
                  <p className="result-score-line">
                    <strong>
                      {examResult.correct}/{examResult.total}
                    </strong>{" "}
                    câu đúng ({Math.round((examResult.correct / examResult.total) * 100)}%) · Thời
                    gian {formatTime(examResult.durationSeconds)}
                  </p>
                  <p className="result-note">
                    {examResult.passed
                      ? `Bạn đã vượt qua ngưỡng đạt tối thiểu ${PASS_SCORE}/${EXAM_SIZE} câu. Hãy tiếp tục ôn luyện để giữ vững kết quả.`
                      : `Cần đúng tối thiểu ${PASS_SCORE}/${EXAM_SIZE} câu để đạt. Các câu làm sai đã được lưu vào mục "Làm sai" để bạn dễ dàng ôn lại.`}
                  </p>

                  <div className="result-counters">
                    <div className="counter-box ok">
                      <strong>{examResult.correct}</strong>
                      <span>Đúng</span>
                    </div>
                    <div className="counter-box bad">
                      <strong>{examResult.wrong}</strong>
                      <span>Sai</span>
                    </div>
                    <div className="counter-box muted">
                      <strong>{examResult.unanswered}</strong>
                      <span>Bỏ trống</span>
                    </div>
                  </div>

                  <div className="breakdown-list">
                    {examResult.breakdown.map((row) => (
                      <div key={row.chapter} className="breakdown-row">
                        <span>{row.shortLabel}</span>
                        <strong className={row.correct === row.total ? "text-ok" : ""}>
                          {row.correct}/{row.total}
                        </strong>
                      </div>
                    ))}
                  </div>

                  <div className="modal-actions">
                    {examResult.wrong + examResult.unanswered > 0 ? (
                      <button
                        type="button"
                        className="ghost-btn"
                        onClick={() => {
                          setReviewFilter("mistakes");
                          setExamIndex(0);
                          setShowResultModal(false);
                        }}
                      >
                        Xem câu sai ({examResult.wrong + examResult.unanswered})
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="ghost-btn"
                      onClick={() => setShowResultModal(false)}
                    >
                      Xem lại bài
                    </button>
                    <button type="button" className="primary-btn" onClick={startRandomExam}>
                      Làm đề mới
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </>
        )
      ) : (
        <main className="stats-page">
          <section className="kpi-grid">
            <div className="kpi-card">
              <span>Đã ôn tập</span>
              <strong>
                {studySummary.answered}/{questions.length}
              </strong>
              <p>{Math.round((studySummary.answered / questions.length) * 100)}% bộ 600 câu hỏi</p>
            </div>
            <div className="kpi-card">
              <span>Độ chính xác</span>
              <strong>{studySummary.accuracy}%</strong>
              <p>
                Đúng {studySummary.correct} · Sai {studySummary.wrong} khi ôn tập
              </p>
            </div>
            <div className="kpi-card">
              <span>Câu cần ôn lại</span>
              <strong>{progress.wrongIds.length}</strong>
              <p>Gồm các câu trả lời sai ở Ôn tập & Thi thử</p>
            </div>
            <div className="kpi-card">
              <span>Thi thử đạt yêu cầu</span>
              <strong>
                {passedExamsCount}/{progress.examHistory.length}
              </strong>
              <p>
                Đạt từ {PASS_SCORE}/{EXAM_SIZE} câu trở lên
              </p>
            </div>
          </section>

          <section className="quick-study-bar">
            <button
              type="button"
              className="primary-btn"
              disabled={progress.wrongIds.length === 0}
              onClick={() => jumpToStudy("Tất cả", "wrong")}
            >
              Ôn {progress.wrongIds.length} câu làm sai
            </button>
            <button
              type="button"
              className="ghost-btn"
              disabled={progress.bookmarks.length === 0}
              onClick={() => jumpToStudy("Tất cả", "bookmarked")}
            >
              Xem {progress.bookmarks.length} câu đã lưu
            </button>
            <button type="button" className="ghost-btn" onClick={startRandomExam}>
              Làm đề thi thử mới
            </button>
          </section>

          <section className="section-card">
            <div className="section-head">
              <div>
                <h3>Tiến độ theo từng chương</h3>
                <p>Theo dõi mức độ hoàn thành và mở nhanh chương cần ôn thêm.</p>
              </div>
            </div>

            <div className="chapter-stats-list">
              {chapterStats.map((stat) => (
                <div key={stat.chapter} className="chapter-stat-row">
                  <div className="chapter-stat-info">
                    <div className="chapter-stat-title">
                      <strong>{stat.chapter}</strong>
                      <span>
                        {stat.answered}/{stat.total} câu ({stat.completionPct}%)
                        {stat.answered > 0 ? ` · Đúng ${stat.accuracyPct}%` : ""}
                      </span>
                    </div>
                    <div className="progress-track">
                      <div
                        className="progress-fill"
                        style={{ width: `${stat.completionPct}%` }}
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    className="ghost-btn small"
                    onClick={() => jumpToStudy(stat.chapter, "all")}
                  >
                    Ôn chương này
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="section-card">
            <div className="section-head">
              <div>
                <h3>Lịch sử thi thử</h3>
                <p>Lưu tối đa 30 bài thi thử gần nhất ngay trên trình duyệt này.</p>
              </div>
            </div>

            {progress.examHistory.length > 0 ? (
              <div className="history-list">
                {progress.examHistory.map((item) => (
                  <div key={item.id} className="history-row">
                    <div>
                      <strong>{item.label}</strong>
                      <span className="muted-text">{formatDateTime(item.completedAt)}</span>
                    </div>
                    <div className="history-badges">
                      <span className="muted-text">
                        Đúng {item.correct} · Sai {item.wrong} · Bỏ trống {item.unanswered} ·{" "}
                        {formatTime(item.durationSeconds)}
                      </span>
                      <span className={`pill ${item.passed ? "pill-ok" : "pill-bad"}`}>
                        {item.passed ? "Đạt" : "Chưa đạt"} · {item.correct}/{item.total}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted-text">
                Bạn chưa hoàn thành bài thi thử nào. Chuyển sang mục &ldquo;Thi thử&rdquo; để bắt
                đầu làm bài.
              </p>
            )}
          </section>

          <section className="section-card danger-zone">
            <div className="section-head">
              <div>
                <h3>Quản lý dữ liệu lưu trên trình duyệt</h3>
                <p>
                  Tiến độ ôn tập, câu đã lưu và lịch sử thi thử được lưu cục bộ ngay trên thiết bị
                  của bạn.
                </p>
              </div>
            </div>

            <div className="danger-actions">
              {confirmReset === "study" ? (
                <div className="confirm-bar">
                  <span>Xóa đáp án đã chọn ở Ôn tập và danh sách câu làm sai?</span>
                  <button
                    type="button"
                    className="danger-btn"
                    onClick={() => {
                      clearStudyAnswers();
                      setPeekedIds({});
                      setConfirmReset("none");
                    }}
                  >
                    Xác nhận xóa
                  </button>
                  <button
                    type="button"
                    className="ghost-btn small"
                    onClick={() => setConfirmReset("none")}
                  >
                    Hủy
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => setConfirmReset("study")}
                >
                  Đặt lại tiến độ ôn tập
                </button>
              )}

              {confirmReset === "all" ? (
                <div className="confirm-bar">
                  <span>Xóa toàn bộ tiến độ ôn tập, câu đã lưu và toàn bộ lịch sử thi thử?</span>
                  <button
                    type="button"
                    className="danger-btn"
                    onClick={() => {
                      clearAllProgress();
                      setPeekedIds({});
                      setConfirmReset("none");
                    }}
                  >
                    Xóa tất cả
                  </button>
                  <button
                    type="button"
                    className="ghost-btn small"
                    onClick={() => setConfirmReset("none")}
                  >
                    Hủy
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="danger-outline-btn"
                  onClick={() => setConfirmReset("all")}
                >
                  Xóa toàn bộ dữ liệu học tập
                </button>
              )}
            </div>
          </section>
        </main>
      )}

      {/* Ngăn kéo trượt lên cho điện thoại / máy tính bảng */}
      {mobileSheetOpen && hasMobileBottomBar ? (
        <div
          className="sheet-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={mode === "study" ? "Bộ lọc và danh sách câu hỏi" : "Danh sách câu trong đề"}
          onClick={() => setMobileSheetOpen(false)}
        >
          <div className="sheet-panel" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-handle" aria-hidden="true" />
            <div className="sheet-header">
              <h2>{mode === "study" ? "Bộ lọc & chọn câu hỏi" : "Danh sách câu trong đề"}</h2>
              <button
                type="button"
                className="sheet-close"
                onClick={() => setMobileSheetOpen(false)}
                aria-label="Đóng bảng chọn câu"
              >
                Đóng
              </button>
            </div>
            <div className="sheet-body">
              {mode === "study" ? studySidebarContent : examSidebarContent}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
