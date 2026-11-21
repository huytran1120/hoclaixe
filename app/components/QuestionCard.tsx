"use client";

import { memo, useState } from "react";
import Image from "next/image";
import { withBasePath } from "../lib/exam";
import type { Question } from "../types";

type QuestionCardProps = {
  question: Question;
  badgeText?: string;
  selected?: number;
  reveal: boolean;
  readOnly?: boolean;
  isBookmarked: boolean;
  canPeekAnswer?: boolean;
  onPeekAnswer?: () => void;
  onToggleBookmark: () => void;
  onSelect: (optionId: number) => void;
};

const QuestionCard = memo(function QuestionCard({
  question,
  badgeText,
  selected,
  reveal,
  readOnly = false,
  isBookmarked,
  canPeekAnswer = false,
  onPeekAnswer,
  onToggleBookmark,
  onSelect,
}: QuestionCardProps) {
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  const isSelectedCorrect = selected !== undefined && selected === question.answer;
  const isSelectedWrong = selected !== undefined && selected !== question.answer;

  return (
    <>
      <article className="question-card">
        <header className="question-meta">
          <div className="question-badges">
            <span className="pill pill-primary">{badgeText ?? `Câu ${question.id}`}</span>
            <span className="pill pill-muted">{question.chapter}</span>
          </div>

          <button
            type="button"
            className={`bookmark-btn${isBookmarked ? " active" : ""}`}
            onClick={onToggleBookmark}
            aria-pressed={isBookmarked}
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
            <span>{isBookmarked ? "Đã đánh dấu" : "Đánh dấu"}</span>
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
                  <span className="image-zoom-hint">Phóng to</span>
                </button>
              );
            })}
          </div>
        ) : null}

        <div className="answer-list" role="radiogroup" aria-label={`Các phương án câu ${question.id}`}>
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
                isSelectedCorrect ? "ok" : isSelectedWrong ? "bad" : "info"
              }`}
              role="status"
            >
              {isSelectedCorrect ? (
                <>
                  <strong>Chính xác!</strong> Đáp án đúng là phương án {question.answer}.
                </>
              ) : isSelectedWrong ? (
                <>
                  <strong>Chưa chính xác.</strong> Bạn chọn phương án {selected}, đáp án đúng là
                  phương án {question.answer}.
                </>
              ) : (
                <>
                  <strong>Đáp án đúng:</strong> Phương án {question.answer}.
                </>
              )}
            </div>
          ) : canPeekAnswer && onPeekAnswer ? (
            <button type="button" className="ghost-btn" onClick={onPeekAnswer}>
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
