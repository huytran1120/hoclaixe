"use client";

import { memo, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { CHAPTER_SHORT_LABELS, withBasePath } from "../lib/exam";
import type { Question } from "../types";

type QuestionCardProps = {
  question: Question;
  badgeText?: string;
  selected?: number;
  reveal: boolean;
  readOnly?: boolean;
  studyShowAllMode?: boolean;
  isBookmarked: boolean;
  canPeekAnswer?: boolean;
  onPeekAnswer?: () => void;
  onToggleBookmark: () => void;
  onSelect: (optionId: number) => void;
  onSwipePrev?: () => void;
  onSwipeNext?: () => void;
};

const QuestionCard = memo(function QuestionCard({
  question,
  badgeText,
  selected,
  reveal,
  readOnly = false,
  studyShowAllMode = false,
  isBookmarked,
  canPeekAnswer = false,
  onPeekAnswer,
  onToggleBookmark,
  onSelect,
  onSwipePrev,
  onSwipeNext,
}: QuestionCardProps) {
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!zoomedImage) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setZoomedImage(null);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [zoomedImage]);

  const isSelectedCorrect = selected !== undefined && selected === question.answer;
  const isSelectedWrong = selected !== undefined && selected !== question.answer;
  const shortChapter = CHAPTER_SHORT_LABELS[question.chapter] ?? question.chapter;

  const handleTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLElement>) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start || event.changedTouches.length !== 1) return;

    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;

    if (Math.abs(dx) >= 64 && Math.abs(dx) > Math.abs(dy) * 1.6) {
      if (dx < 0) {
        onSwipeNext?.();
      } else {
        onSwipePrev?.();
      }
    }
  };

  return (
    <>
      <article
        className="question-card"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <header className="question-meta">
          <div className="question-badges">
            <span className="pill pill-primary">{badgeText ?? `Câu ${question.id}`}</span>
            <span className="pill pill-muted" title={question.chapter}>
              <span className="chapter-full">{question.chapter}</span>
              <span className="chapter-short">{shortChapter}</span>
            </span>
          </div>

          <button
            type="button"
            className={`bookmark-btn${isBookmarked ? " active" : ""}`}
            onClick={onToggleBookmark}
            aria-pressed={isBookmarked}
            aria-label={isBookmarked ? "Bỏ đánh dấu câu hỏi" : "Đánh dấu câu hỏi để ôn lại"}
            title="Đánh dấu câu hỏi để ôn lại (phím B)"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill={isBookmarked ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
            <span className="bookmark-label">{isBookmarked ? "Đã lưu" : "Đánh dấu"}</span>
          </button>
        </header>

        <h2 className="question-prompt">{question.prompt}</h2>

        {question.images.length > 0 ? (
          <div className="question-images">
            {question.images.map((image) => {
              const resolvedSrc = withBasePath(image);
              return (
                <button
                  key={image}
                  type="button"
                  className="image-zoom-trigger"
                  onClick={() => setZoomedImage(resolvedSrc)}
                  title="Nhấn để phóng to hình minh họa"
                >
                  <Image
                    src={resolvedSrc}
                    alt={`Hình minh họa câu ${question.id}`}
                    width={900}
                    height={520}
                    sizes="(max-width: 900px) 100vw, 760px"
                    unoptimized
                  />
                  <span className="image-zoom-hint">
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <circle cx="11" cy="11" r="8" />
                      <path d="m21 21-4.3-4.3" />
                      <path d="M11 8v6M8 11h6" />
                    </svg>
                    Phóng to
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        <div
          className="answer-list"
          role="radiogroup"
          aria-label={`Các phương án câu ${question.id}`}
        >
          {question.options.map((option) => {
            const isSelected = selected === option.id;
            const isCorrect = option.id === question.answer;
            const stateClass = [
              "answer-option",
              isSelected ? "selected" : "",
              reveal && isCorrect ? "correct" : "",
              reveal && isSelected && !isCorrect ? "wrong" : "",
              readOnly ? "readonly" : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                className={stateClass}
                onClick={() => {
                  if (!readOnly) {
                    onSelect(option.id);
                  }
                }}
              >
                <span className="option-index" aria-hidden="true">
                  {reveal && isCorrect ? "✓" : reveal && isSelected && !isCorrect ? "✕" : option.id}
                </span>
                <span className="option-text">{option.text}</span>
              </button>
            );
          })}
        </div>

        <footer className="question-footer">
          {reveal ? (
            <div
              className={`feedback-banner ${
                isSelectedCorrect
                  ? "ok"
                  : isSelectedWrong
                    ? "bad"
                    : studyShowAllMode
                      ? "ok"
                      : "info"
              }`}
              role="status"
            >
              <span className="feedback-icon" aria-hidden="true">
                {isSelectedWrong ? "!" : "✓"}
              </span>
              <div>
                {isSelectedCorrect ? (
                  <>
                    <strong>Chính xác!</strong> Đáp án đúng là phương án {question.answer}.
                  </>
                ) : isSelectedWrong ? (
                  <>
                    <strong>Chưa đúng.</strong> Bạn chọn phương án {selected} — đáp án đúng là
                    phương án <strong>{question.answer}</strong>.
                  </>
                ) : (
                  <>
                    <strong>Đáp án đúng: Phương án {question.answer}.</strong>
                  </>
                )}
              </div>
            </div>
          ) : canPeekAnswer && onPeekAnswer ? (
            <button type="button" className="ghost-btn small" onClick={onPeekAnswer}>
              Xem đáp án
            </button>
          ) : null}
        </footer>
      </article>

      {zoomedImage ? (
        <div
          className="lightbox-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={`Phóng to hình minh họa câu ${question.id}`}
          onClick={() => setZoomedImage(null)}
        >
          <div className="lightbox-content" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="lightbox-close"
              onClick={() => setZoomedImage(null)}
              aria-label="Đóng ảnh phóng to"
            >
              ✕
            </button>
            <Image
              src={zoomedImage}
              alt={`Hình minh họa câu ${question.id}`}
              width={1280}
              height={760}
              unoptimized
            />
          </div>
        </div>
      ) : null}
    </>
  );
});

export default QuestionCard;
