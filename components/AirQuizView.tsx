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
  questionText: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

const DEFAULT_QUESTIONS: Question[] = [
  {
    id: 1,
    subject: "astronomy",
    questionText: "quiz.q1.text",
    options: ["quiz.q1.a", "quiz.q1.b", "quiz.q1.c", "quiz.q1.d"],
    correctIndex: 2,
    explanation: "quiz.q1.exp",
  },
  {
    id: 2,
    subject: "chemistry",
    questionText: "quiz.q2.text",
    options: ["quiz.q2.a", "quiz.q2.b", "quiz.q2.c", "quiz.q2.d"],
    correctIndex: 0,
    explanation: "quiz.q2.exp",
  },
  {
    id: 3,
    subject: "biology",
    questionText: "quiz.q3.text",
    options: ["quiz.q3.a", "quiz.q3.b", "quiz.q3.c", "quiz.q3.d"],
    correctIndex: 1,
    explanation: "quiz.q3.exp",
  },
  {
    id: 4,
    subject: "physics",
    questionText: "quiz.q4.text",
    options: ["quiz.q4.a", "quiz.q4.b", "quiz.q4.c", "quiz.q4.d"],
    correctIndex: 1,
    explanation: "quiz.q4.exp",
  },
  {
    id: 5,
    subject: "math",
    questionText: "quiz.q5.text",
    options: ["quiz.q5.a", "quiz.q5.b", "quiz.q5.c", "quiz.q5.d"],
    correctIndex: 3,
    explanation: "quiz.q5.exp",
  },
];

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
    // Ignore
  }
}

export function AirQuizView({ onAnswerSubmit }: AirQuizViewProps) {
  const { t } = useI18n();

  const [questions, setQuestions] = useState<Question[]>(DEFAULT_QUESTIONS);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [timer, setTimer] = useState(20);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isTniMode, setIsTniMode] = useState<boolean>(() => {
    if (typeof document !== "undefined") {
      return document.body.classList.contains("tni-mode");
    }
    return false;
  });
  const [blueScore, setBlueScore] = useState(0);
  const [redScore, setRedScore] = useState(0);

  useEffect(() => {
    const handleTniChange = () => {
      setIsTniMode(document.body.classList.contains("tni-mode"));
    };
    window.addEventListener("tni-mode-change", handleTniChange);
    return () => window.removeEventListener("tni-mode-change", handleTniChange);
  }, []);

  // New Question Form state
  const [newQText, setNewQText] = useState("");
  const [newOptA, setNewOptA] = useState("");
  const [newOptB, setNewOptB] = useState("");
  const [newOptC, setNewOptC] = useState("");
  const [newOptD, setNewOptD] = useState("");
  const [newCorrect, setNewCorrect] = useState(0);

  const currentQ = questions[currentIndex] || DEFAULT_QUESTIONS[0];

  const getLabel = (keyOrText: string) => {
    return keyOrText.startsWith("quiz.") ? t(keyOrText as any) : keyOrText;
  };

  useEffect(() => {
    if (showResult || selectedAnswer !== null) return;
    const interval = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          handleSelectOption(-1);
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
        playAudioTone(587.33, 200, "triangle");
        setTimeout(() => playAudioTone(880, 300, "triangle"), 150);
      } else {
        playAudioTone(220, 300, "sawtooth");
      }
      onAnswerSubmit(isCorrect);
    },
    [currentQ.correctIndex, selectedAnswer, onAnswerSubmit]
  );

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
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

  const handleAddQuestion = () => {
    if (!newQText.trim() || !newOptA.trim() || !newOptB.trim()) return;

    const created: Question = {
      id: Date.now(),
      subject: "custom",
      questionText: newQText,
      options: [newOptA, newOptB, newOptC || "—", newOptD || "—"],
      correctIndex: newCorrect,
      explanation: "Question personnalisée ajoutée par l'enseignant.",
    };

    setQuestions((prev) => [...prev, created]);
    setShowAddForm(false);
    setNewQText("");
    setNewOptA("");
    setNewOptB("");
    setNewOptC("");
    setNewOptD("");
  };

  if (showResult) {
    const percentage = Math.round((score / questions.length) * 100);
    return (
      <div className="glass flex flex-col items-center gap-6 p-8 text-center">
        <span className="text-4xl">🏆</span>
        <h2 className="text-xl font-bold text-[color:var(--edu-accent)]">{t("quiz.results")}</h2>
        <div className="hud-mono text-5xl font-black text-white">{percentage}%</div>
        <p className="text-sm text-[color:var(--edu-text-dim)]">
          {t("quiz.score")}: <span className="font-bold text-white">{score}</span> / {questions.length}
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
            {t("quiz.question")} {currentIndex + 1} {t("quiz.of")} {questions.length}
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className="rounded-lg border border-[color:var(--edu-accent)]/40 px-3 py-1.5 text-xs font-bold text-[color:var(--edu-accent)] hover:bg-[color:var(--edu-accent)]/10"
          >
            ➕ Question personnalisée
          </button>

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

      {/* Add Custom Question Form */}
      {showAddForm && (
        <div className="flex flex-col gap-3 rounded-xl border border-[color:var(--edu-accent)]/40 bg-white/[0.04] p-4">
          <h4 className="text-xs font-bold uppercase tracking-widest text-[color:var(--edu-accent)]">
            Ajouter une question de classe
          </h4>
          <input
            type="text"
            placeholder="Intitulé de la question..."
            value={newQText}
            onChange={(e) => setNewQText(e.target.value)}
            className="rounded-lg border border-[color:var(--edu-panel-border)] bg-[#070d18] p-2 text-xs text-white"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Option A"
              value={newOptA}
              onChange={(e) => setNewOptA(e.target.value)}
              className="rounded-lg border border-[color:var(--edu-panel-border)] bg-[#070d18] p-2 text-xs text-white"
            />
            <input
              type="text"
              placeholder="Option B"
              value={newOptB}
              onChange={(e) => setNewOptB(e.target.value)}
              className="rounded-lg border border-[color:var(--edu-panel-border)] bg-[#070d18] p-2 text-xs text-white"
            />
            <input
              type="text"
              placeholder="Option C"
              value={newOptC}
              onChange={(e) => setNewOptC(e.target.value)}
              className="rounded-lg border border-[color:var(--edu-panel-border)] bg-[#070d18] p-2 text-xs text-white"
            />
            <input
              type="text"
              placeholder="Option D"
              value={newOptD}
              onChange={(e) => setNewOptD(e.target.value)}
              className="rounded-lg border border-[color:var(--edu-panel-border)] bg-[#070d18] p-2 text-xs text-white"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-300">Bonne réponse:</span>
              {[0, 1, 2, 3].map((idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setNewCorrect(idx)}
                  className={`h-6 w-6 rounded text-xs font-bold ${
                    newCorrect === idx ? "bg-[color:var(--edu-good)] text-[#04141a]" : "bg-white/10 text-white"
                  }`}
                >
                  {String.fromCharCode(65 + idx)}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleAddQuestion}
              className="rounded-lg bg-[color:var(--edu-good)] px-4 py-1.5 text-xs font-bold text-[#04141a]"
            >
              ✓ Enregistrer
            </button>
          </div>
        </div>
      )}

      {/* Question Text */}
      <div className="py-2">
        <p className="text-lg font-semibold text-white">{getLabel(currentQ.questionText)}</p>
      </div>

      {/* Answer Options Grid */}
      {/* TNI vs Standard Mode Switcher inside Quiz */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-b border-[color:var(--edu-panel-border)] py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[color:var(--edu-accent)]">Mode Affichage :</span>
          <button
            type="button"
            onClick={() => {
              if (typeof document !== "undefined") {
                document.body.classList.toggle("tni-mode");
                window.dispatchEvent(new Event("tni-mode-change"));
              }
            }}
            className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
              isTniMode
                ? "border-[color:var(--edu-accent)] bg-[color:var(--edu-accent)] text-black shadow-md"
                : "border-[color:var(--edu-accent)] bg-[color:var(--edu-accent)]/20 text-[color:var(--edu-accent)] hover:bg-[color:var(--edu-accent)]/30"
            }`}
          >
            📺 {isTniMode ? "Vue 4 Quadrants Active (86\")" : "Basculer Vue 4 Quadrants TNI (86\")"}
          </button>
        </div>

        {/* Dual Team Competition Scoring */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 rounded-lg border border-blue-500/40 bg-blue-500/10 px-2.5 py-1 text-blue-300">
            <span>🔵 {t("quiz.teams.blue")}: <strong>{blueScore} pts</strong></span>
            <button
              type="button"
              onClick={() => setBlueScore((s) => s + 1)}
              className="ml-1 rounded bg-blue-500/30 px-1.5 py-0.5 text-[10px] font-bold text-white hover:bg-blue-500/50"
              title="Ajouter 1 point"
            >
              +1
            </button>
          </div>
          <span className="text-white/40 font-bold">VS</span>
          <div className="flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/10 px-2.5 py-1 text-red-300">
            <span>🔴 {t("quiz.teams.red")}: <strong>{redScore} pts</strong></span>
            <button
              type="button"
              onClick={() => setRedScore((s) => s + 1)}
              className="ml-1 rounded bg-red-500/30 px-1.5 py-0.5 text-[10px] font-bold text-white hover:bg-red-500/50"
              title="Ajouter 1 point"
            >
              +1
            </button>
          </div>
          {(blueScore > 0 || redScore > 0) && (
            <button
              type="button"
              onClick={() => {
                setBlueScore(0);
                setRedScore(0);
              }}
              className="text-[10px] text-slate-400 underline hover:text-white"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Answer Options Grid (Standard vs TNI 4-Quadrant) */}
      <div className={isTniMode ? "tni-quadrant-grid" : "grid grid-cols-1 gap-3 sm:grid-cols-2"}>
        {currentQ.options.map((optKey, idx) => {
          const letter = String.fromCharCode(65 + idx);
          const isSelected = selectedAnswer === idx;
          const isCorrect = idx === currentQ.correctIndex;
          const revealed = selectedAnswer !== null;

          let btnStyle = isTniMode
            ? "tni-quadrant-btn hover:border-[color:var(--edu-accent)]"
            : "flex items-center gap-4 rounded-2xl border p-6 text-left transition active:scale-95 border-[color:var(--edu-panel-border)] hover:border-[color:var(--edu-accent)]/50 hover:bg-white/[0.04] touch-target";

          if (revealed) {
            if (isCorrect) {
              btnStyle += isTniMode
                ? " !border-[color:var(--edu-good)] !bg-[color:var(--edu-good)]/25 !text-[color:var(--edu-good)] shadow-[0_0_35px_rgba(74,222,128,0.4)]"
                : " border-[color:var(--edu-good)] bg-[color:var(--edu-good)]/20 text-[color:var(--edu-good)] shadow-[0_0_20px_rgba(74,222,128,0.3)]";
            } else if (isSelected) {
              btnStyle += isTniMode
                ? " !border-[color:var(--edu-danger)] !bg-[color:var(--edu-danger)]/25 !text-[color:var(--edu-danger)]"
                : " border-[color:var(--edu-danger)] bg-[color:var(--edu-danger)]/20 text-[color:var(--edu-danger)]";
            } else {
              btnStyle += " opacity-40";
            }
          }

          return (
            <button
              key={optKey + idx}
              type="button"
              disabled={revealed}
              onClick={() => handleSelectOption(idx)}
              className={btnStyle}
              style={{ minHeight: isTniMode ? undefined : "100px" }}
            >
              <span className={`hud-mono ${isTniMode ? "text-3xl mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10" : "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10 text-xl"} font-bold`}>
                {letter}
              </span>
              <span className={isTniMode ? "text-xl sm:text-2xl font-bold leading-normal" : "text-base sm:text-lg font-semibold leading-snug"}>
                {getLabel(optKey)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Explanation & Next Controls */}
      {selectedAnswer !== null && (
        <div className="flex flex-col gap-4 rounded-xl border border-[color:var(--edu-accent)]/40 bg-white/[0.05] p-5 shadow-lg">
          <div className="flex items-center justify-between">
            <span
              className={`text-base font-bold ${
                selectedAnswer === currentQ.correctIndex ? "text-[color:var(--edu-good)]" : "text-[color:var(--edu-danger)]"
              }`}
            >
              {selectedAnswer === currentQ.correctIndex ? `✓ ${t("quiz.correct")}` : `✗ ${t("quiz.wrong")}`}
            </span>
            <button
              type="button"
              onClick={handleNext}
              className="rounded-xl bg-[color:var(--edu-accent)] px-6 py-2.5 text-sm font-bold text-[#04141a] transition hover:opacity-90 active:scale-95"
            >
              {t("quiz.next")} →
            </button>
          </div>
          <div className="rounded-lg bg-black/30 p-3 text-sm text-[color:var(--edu-text-dim)]">
            <strong className="text-white">💡 Explication pédagogique :</strong> {getLabel(currentQ.explanation)}
          </div>
        </div>
      )}
    </div>
  );
}
