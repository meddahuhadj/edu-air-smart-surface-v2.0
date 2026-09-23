"use client";

import { useCallback, useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import type { GestureFrame } from "@/lib/vision/gestureEngine";

export interface AirQuizViewProps {
  isSimulation: boolean;
  realFrame: GestureFrame;
  onAnswerSubmit: (correct: boolean) => void;
}

interface Question {
  id: number;
  subject: string;
  questionKey: string;
  options: string[];
  correctIndex: number;
  explanationKey: string;
}

const QUIZ_QUESTIONS: Question[] = [
  {
    id: 1,
    subject: "astronomy",
    questionKey: "quiz.q1.text",
    options: ["quiz.q1.a", "quiz.q1.b", "quiz.q1.c", "quiz.q1.d"],
    correctIndex: 2, // Earth is 3rd planet
    explanationKey: "quiz.q1.exp",
  },
  {
    id: 2,
    subject: "chemistry",
    questionKey: "quiz.q2.text",
    options: ["quiz.q2.a", "quiz.q2.b", "quiz.q2.c", "quiz.q2.d"],
    correctIndex: 0, // H2O
    explanationKey: "quiz.q2.exp",
  },
  {
    id: 3,
    subject: "biology",
    questionKey: "quiz.q3.text",
    options: ["quiz.q3.a", "quiz.q3.b", "quiz.q3.c", "quiz.q3.d"],
    correctIndex: 1, // DNA
    explanationKey: "quiz.q3.exp",
  },
  {
    id: 4,
    subject: "physics",
    questionKey: "quiz.q4.text",
    options: ["quiz.q4.a", "quiz.q4.b", "quiz.q4.c", "quiz.q4.d"],
    correctIndex: 1, // Snell Law n1*sin1 = n2*sin2
    explanationKey: "quiz.q4.exp",
  },
  {
    id: 5,
    subject: "math",
    questionKey: "quiz.q5.text",
    options: ["quiz.q5.a", "quiz.q5.b", "quiz.q5.c", "quiz.q5.d"],
    correctIndex: 3, // 12 edges on a cube
    explanationKey: "quiz.q5.exp",
  },
];

// Simple Web Audio API sound generator for quiz feedback
function playAudioTone(freq: number, durationMs: number, type: OscillatorType = "sine") {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + durationMs / 1000);
  } catch {
    // Ignore audio autoplay policy restrictions
  }
}

export function AirQuizView({ onAnswerSubmit }: AirQuizViewProps) {
  const { t } = useI18n();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [timer, setTimer] = useState(20);

  const currentQ = QUIZ_QUESTIONS[currentIndex];

  // Question countdown timer
  useEffect(() => {
    if (showResult || selectedAnswer !== null) return;
    const interval = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          handleSelectOption(-1); // Time out
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, selectedAnswer, showResult]);

  const handleSelectOption = useCallback(
    (index: number) => {
      if (selectedAnswer !== null) return;
      setSelectedAnswer(index);

      const isCorrect = index === currentQ.correctIndex;
      if (isCorrect) {
        setScore((s) => s + 1);
        playAudioTone(587.33, 200, "triangle"); // High tone D5
        setTimeout(() => playAudioTone(880, 300, "triangle"), 150); // A5
      } else {
        playAudioTone(220, 300, "sawtooth"); // Low tone A3
      }
      onAnswerSubmit(isCorrect);
    },
    [currentQ.correctIndex, selectedAnswer, onAnswerSubmit]
  );

  const handleNext = () => {
    if (currentIndex < QUIZ_QUESTIONS.length - 1) {
      setCurrentIndex((i) => i + 1);
      setSelectedAnswer(null);
      setTimer(20);
    } else {
      setShowResult(true);
    }
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setScore(0);
    setShowResult(false);
    setTimer(20);
  };

  if (showResult) {
    const percentage = Math.round((score / QUIZ_QUESTIONS.length) * 100);
    return (
      <div className="glass flex flex-col items-center gap-6 p-8 text-center">
        <span className="text-4xl">🏆</span>
        <h2 className="text-xl font-bold text-[color:var(--edu-accent)]">{t("quiz.results")}</h2>
        <div className="hud-mono text-5xl font-black text-white">{percentage}%</div>
        <p className="text-sm text-[color:var(--edu-text-dim)]">
          {t("quiz.score")}: <span className="font-bold text-white">{score}</span> / {QUIZ_QUESTIONS.length}
        </p>

        <button
          type="button"
          onClick={handleRestart}
          className="rounded-xl bg-[color:var(--edu-accent)] px-6 py-3 text-sm font-bold text-[#04141a] transition hover:opacity-90"
        >
          🔄 {t("quiz.restart")}
        </button>
      </div>
    );
  }

  return (
    <div className="glass flex flex-col gap-6 p-6">
      {/* Quiz Header & Progress */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--edu-panel-border)] pb-4">
        <div>
          <span className="hud-mono text-xs uppercase tracking-widest text-[color:var(--edu-accent)]">
            📝 {t("quiz.title")} · {currentQ.subject.toUpperCase()}
          </span>
          <h2 className="text-sm font-bold text-white">
            {t("quiz.question")} {currentIndex + 1} {t("quiz.of")} {QUIZ_QUESTIONS.length}
          </h2>
        </div>

        {/* Timer Badge */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[color:var(--edu-text-dim)]">{t("quiz.hint")}</span>
          <div
            className={`hud-mono flex h-10 w-10 items-center justify-center rounded-full border text-sm font-bold ${
              timer <= 5
                ? "animate-ping border-[color:var(--edu-danger)] text-[color:var(--edu-danger)]"
                : "border-[color:var(--edu-accent)] text-[color:var(--edu-accent)]"
            }`}
          >
            {timer}s
          </div>
        </div>
      </div>

      {/* Question Text */}
      <div className="py-2">
        <p className="text-lg font-semibold text-white">{t(currentQ.questionKey as any)}</p>
      </div>

      {/* Answer Options Grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {currentQ.options.map((optKey, idx) => {
          const letter = String.fromCharCode(65 + idx);
          const isSelected = selectedAnswer === idx;
          const isCorrect = idx === currentQ.correctIndex;
          const revealed = selectedAnswer !== null;

          let btnStyle = "border-[color:var(--edu-panel-border)] hover:border-[color:var(--edu-accent)]/50 hover:bg-white/[0.04]";
          if (revealed) {
            if (isCorrect) {
              btnStyle = "border-[color:var(--edu-good)] bg-[color:var(--edu-good)]/20 text-[color:var(--edu-good)]";
            } else if (isSelected) {
              btnStyle = "border-[color:var(--edu-danger)] bg-[color:var(--edu-danger)]/20 text-[color:var(--edu-danger)]";
            } else {
              btnStyle = "opacity-40 border-[color:var(--edu-panel-border)]";
            }
          }

          return (
            <button
              key={optKey}
              type="button"
              disabled={revealed}
              onClick={() => handleSelectOption(idx)}
              className={`flex items-center gap-4 rounded-xl border p-4 text-left transition ${btnStyle}`}
            >
              <span className="hud-mono flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-sm font-bold">
                {letter}
              </span>
              <span className="text-sm font-medium">{t(optKey as any)}</span>
            </button>
          );
        })}
      </div>

      {/* Explanation & Next Controls */}
      {selectedAnswer !== null && (
        <div className="flex flex-col gap-4 rounded-xl border border-[color:var(--edu-panel-border)] bg-white/[0.03] p-4">
          <div className="flex items-center justify-between">
            <span
              className={`text-sm font-bold ${
                selectedAnswer === currentQ.correctIndex ? "text-[color:var(--edu-good)]" : "text-[color:var(--edu-danger)]"
              }`}
            >
              {selectedAnswer === currentQ.correctIndex ? `✓ ${t("quiz.correct")}` : `✗ ${t("quiz.wrong")}`}
            </span>
            <button
              type="button"
              onClick={handleNext}
              className="rounded-lg bg-[color:var(--edu-accent)] px-4 py-2 text-xs font-bold text-[#04141a]"
            >
              {t("quiz.next")} →
            </button>
          </div>
          <p className="text-xs text-[color:var(--edu-text-dim)]">{t(currentQ.explanationKey as any)}</p>
        </div>
      )}
    </div>
  );
}
