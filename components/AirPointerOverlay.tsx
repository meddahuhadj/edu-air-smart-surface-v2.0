"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import type { GestureFrame } from "@/lib/vision/gestureEngine";
import { useDemoMode } from "@/hooks/useDemoMode";
import { PointerFilter2D } from "@/lib/vision/pointerFilter";
import { applyHomography, type Homography } from "@/lib/vision/calibration";

export interface AirPointerOverlayProps {
  isSimulation: boolean;
  realFrame: GestureFrame;
  homography: Homography | null;
  onSelect: () => void;
}

// ── Built-in demonstration quiz ────────────────────────────────────────────
const DEMO_QUIZ = [
  {
    q: "Quelle est la capitale de la France ?",
    answers: ["Berlin", "Paris", "Madrid", "Rome"],
    correct: 1,
  },
  {
    q: "Combien font 7 × 8 ?",
    answers: ["54", "63", "56", "48"],
    correct: 2,
  },
  {
    q: "Quel gaz respirons-nous principalement ?",
    answers: ["CO₂", "H₂O", "N₂", "O₂"],
    correct: 2,
  },
  {
    q: "Qui a découvert la gravité (chute de la pomme) ?",
    answers: ["Einstein", "Newton", "Galilée", "Faraday"],
    correct: 1,
  },
];

type QuizPhase = "targeting" | "quiz" | "results";

const ANSWER_LABELS = ["A", "B", "C", "D"] as const;
const DWELL_MS = 1200; // ms holding cursor on a target to trigger it

export function AirPointerOverlay({ isSimulation, realFrame, homography, onSelect }: AirPointerOverlayProps) {
  const { t } = useI18n();
  const stageRef = useRef<HTMLDivElement>(null);
  const targetRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const demoFrame = useDemoMode(stageRef, isSimulation);
  const frame = isSimulation ? demoFrame : realFrame;
  const filterRef = useRef(new PointerFilter2D({ minCutoff: 1.1, beta: 0.025, deadZone: 0.003 }));

  // ── Pointer state ──────────────────────────────────────────────────────
  const pinchWasActiveRef = useRef(false);
  const pinchStartedAtRef = useRef(0);
  const pinchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const cursorPxRef = useRef<{ x: number; y: number } | null>(null);
  const dwellTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dwellTargetRef = useRef<number | null>(null);

  const [cursorPx, setCursorPx] = useState<{ x: number; y: number } | null>(null);
  const [flashIndex, setFlashIndex] = useState<number | null>(null);
  const [dwellProgress, setDwellProgress] = useState(0); // 0..1

  // ── Quiz / pointer mode ───────────────────────────────────────────────
  const [phase, setPhase] = useState<QuizPhase>("targeting");
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(DEMO_QUIZ.map(() => null));
  const [lastResult, setLastResult] = useState<"correct" | "wrong" | null>(null);

  // ── Score ─────────────────────────────────────────────────────────────
  const [score, setScore] = useState(0);
  const [totalClicks, setTotalClicks] = useState(0);

  // hold-to-pause: open palm ≥1s
  const paused = frame.gesture === "PALM" && frame.palmHoldMs >= 1000;

  // ── Dwell helper ──────────────────────────────────────────────────────
  const cancelDwell = () => {
    if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current);
    dwellTimerRef.current = null;
    dwellTargetRef.current = null;
    setDwellProgress(0);
  };

  const startDwell = (idx: number, onComplete: () => void) => {
    if (dwellTargetRef.current === idx) return;
    cancelDwell();
    dwellTargetRef.current = idx;
    let start = performance.now();
    const tick = () => {
      const elapsed = performance.now() - start;
      const progress = Math.min(1, elapsed / DWELL_MS);
      setDwellProgress(progress);
      if (progress < 1) {
        dwellTimerRef.current = setTimeout(tick, 16);
      } else {
        dwellTimerRef.current = null;
        dwellTargetRef.current = null;
        setDwellProgress(0);
        onComplete();
      }
    };
    dwellTimerRef.current = setTimeout(tick, 16);
  };

  // ── Cursor movement ──────────────────────────────────────────────────
  useEffect(() => {
    if (!frame.cursor || paused) return;
    const oriented = isSimulation ? frame.cursor : { x: 1 - frame.cursor.x, y: frame.cursor.y };
    const mapped = homography ? applyHomography(homography, oriented) : oriented;
    const filtered = filterRef.current.apply(mapped.x, mapped.y, performance.now());
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const next = {
      x: Math.min(1, Math.max(0, filtered.x)) * rect.width,
      y: Math.min(1, Math.max(0, filtered.y)) * rect.height,
    };
    cursorPxRef.current = next;
    setCursorPx(next);

    // Dwell targeting — find which target the cursor hovers over
    const stageRect = stage.getBoundingClientRect();
    const hoveredIdx = targetRefs.current.findIndex((el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      const lx = r.left - stageRect.left;
      const ly = r.top - stageRect.top;
      return next.x >= lx && next.x <= lx + r.width && next.y >= ly && next.y <= ly + r.height;
    });

    if (hoveredIdx >= 0) {
      startDwell(hoveredIdx, () => {
        triggerTarget(hoveredIdx);
      });
    } else {
      cancelDwell();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame.cursor, paused, homography, isSimulation]);

  // ── Pinch click ──────────────────────────────────────────────────────
  useEffect(() => {
    const wasActive = pinchWasActiveRef.current;
    const now = performance.now();

    if (frame.pinchActive && !wasActive) {
      pinchStartedAtRef.current = now;
      pinchStartPosRef.current = cursorPxRef.current;
    } else if (!frame.pinchActive && wasActive) {
      const heldMs = now - pinchStartedAtRef.current;
      const start = pinchStartPosRef.current;
      const end = cursorPxRef.current;
      const moved = start && end ? Math.hypot(end.x - start.x, end.y - start.y) : 0;

      if (heldMs < 700 && moved < 48 && end) {
        const stage = stageRef.current;
        if (!stage) return;
        const stageRect = stage.getBoundingClientRect();
        const hitIndex = targetRefs.current.findIndex((el) => {
          if (!el) return false;
          const r = el.getBoundingClientRect();
          const lx = r.left - stageRect.left;
          const ly = r.top - stageRect.top;
          return end.x >= lx && end.x <= lx + r.width && end.y >= ly && end.y <= ly + r.height;
        });
        if (hitIndex >= 0) triggerTarget(hitIndex);
      }
    }
    pinchWasActiveRef.current = frame.pinchActive;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame.pinchActive, phase, qIndex]);

  const triggerTarget = (idx: number) => {
    cancelDwell();
    if (phase === "quiz") {
      handleAnswer(idx);
    } else {
      onSelect();
      setTotalClicks((c) => c + 1);
      setFlashIndex(idx);
      window.setTimeout(() => setFlashIndex((cur) => (cur === idx ? null : cur)), 350);
    }
  };

  // ── Quiz logic ────────────────────────────────────────────────────────
  const handleAnswer = (answerIdx: number) => {
    const correct = DEMO_QUIZ[qIndex].correct === answerIdx;
    const newAnswers = [...answers];
    newAnswers[qIndex] = answerIdx;
    setAnswers(newAnswers);
    setLastResult(correct ? "correct" : "wrong");
    if (correct) setScore((s) => s + 1);
    onSelect();
  };

  const nextQuestion = () => {
    if (qIndex < DEMO_QUIZ.length - 1) {
      setQIndex(qIndex + 1);
      setLastResult(null);
    } else {
      setPhase("results");
    }
  };

  const prevQuestion = () => {
    if (qIndex > 0) {
      setQIndex(qIndex - 1);
      setLastResult(null);
    }
  };

  const resetQuiz = () => {
    setQIndex(0);
    setAnswers(DEMO_QUIZ.map(() => null));
    setLastResult(null);
    setScore(0);
    setPhase("quiz");
  };

  const currentQ = DEMO_QUIZ[qIndex];

  return (
    <div className="flex flex-col gap-3">
      {/* Mode tabs */}
      <div className="glass flex flex-wrap items-center justify-between gap-3 p-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPhase("targeting")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              phase === "targeting"
                ? "bg-[color:var(--edu-accent)] text-[#04141a]"
                : "border border-[color:var(--edu-panel-border)] text-[color:var(--edu-text-dim)]"
            }`}
          >
            🎯 {t("pointer.targets.title")}
          </button>
          <button
            type="button"
            onClick={() => { setPhase("quiz"); setQIndex(0); setLastResult(null); setScore(0); setAnswers(DEMO_QUIZ.map(() => null)); }}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              phase === "quiz" || phase === "results"
                ? "bg-[color:var(--edu-accent)] text-[#04141a]"
                : "border border-[color:var(--edu-panel-border)] text-[color:var(--edu-text-dim)]"
            }`}
          >
            📝 {t("quiz.title")}
          </button>
        </div>

        {/* Live score display */}
        <div className="flex items-center gap-4">
          <span className="hud-mono text-xs text-[color:var(--edu-text-dim)]">
            {t("pointer.score")}: <span className="font-bold text-[color:var(--edu-good)]">{score}</span>
          </span>
          <span className="hud-mono text-xs text-[color:var(--edu-text-dim)]">
            {t("pointer.accuracy")}: <span className="font-bold">{totalClicks > 0 ? Math.round((score / totalClicks) * 100) : 0}%</span>
          </span>
          <button
            type="button"
            onClick={() => { setScore(0); setTotalClicks(0); setFlashIndex(null); }}
            className="rounded border border-[color:var(--edu-panel-border)] px-2 py-0.5 text-[10px] text-[color:var(--edu-text-dim)]"
          >
            {t("pointer.reset")}
          </button>
        </div>
      </div>

      {/* Hint line */}
      <p className="text-sm text-[color:var(--edu-text-dim)]">
        {phase === "targeting" ? t("pointer.targets.hint") : t("quiz.hint")}
      </p>

      {/* ── QUIZ RESULTS ─────────────────────────────────── */}
      {phase === "results" && (
        <div className="glass flex flex-col items-center gap-6 p-8 text-center">
          <h3 className="text-lg font-bold uppercase tracking-widest text-[color:var(--edu-accent)]">
            {t("quiz.results")}
          </h3>
          <div className="flex flex-col items-center gap-2">
            <span className="text-5xl font-black text-[color:var(--edu-good)]">
              {score}/{DEMO_QUIZ.length}
            </span>
            <span className="text-sm text-[color:var(--edu-text-dim)]">{t("quiz.score")}</span>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {DEMO_QUIZ.map((q, i) => (
              <div
                key={i}
                className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold ${
                  answers[i] === q.correct
                    ? "bg-[color:var(--edu-good)]/20 text-[color:var(--edu-good)]"
                    : "bg-[color:var(--edu-danger)]/20 text-[color:var(--edu-danger)]"
                }`}
              >
                {i + 1}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={resetQuiz}
            className="rounded-lg bg-[color:var(--edu-accent)] px-6 py-2 text-sm font-bold text-[#04141a]"
          >
            {t("quiz.restart")}
          </button>
        </div>
      )}

      {/* ── STAGE (Targeting or Quiz) ─────────────────────── */}
      {phase !== "results" && (
        <div ref={stageRef} className="glass relative w-full overflow-hidden" style={{ minHeight: 340 }}>

          {/* ── QUIZ PANEL ──────────────────────────────────── */}
          {phase === "quiz" && (
            <div className="flex h-full flex-col gap-3 p-5">
              {/* Progress bar */}
              <div className="flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-[color:var(--edu-accent)] transition-all duration-300"
                    style={{ width: `${((qIndex + 1) / DEMO_QUIZ.length) * 100}%` }}
                  />
                </div>
                <span className="hud-mono text-xs text-[color:var(--edu-text-dim)]">
                  {t("quiz.question")} {qIndex + 1} {t("quiz.of")} {DEMO_QUIZ.length}
                </span>
              </div>

              {/* Question */}
              <p className="text-base font-semibold leading-snug">{currentQ.q}</p>

              {/* Last result flash */}
              {lastResult && (
                <div className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                  lastResult === "correct"
                    ? "bg-[color:var(--edu-good)]/20 text-[color:var(--edu-good)]"
                    : "bg-[color:var(--edu-danger)]/20 text-[color:var(--edu-danger)]"
                }`}>
                  {lastResult === "correct" ? `✓ ${t("quiz.correct")}` : `✗ ${t("quiz.wrong")}`}
                </div>
              )}

              {/* Answer buttons */}
              <div className="grid grid-cols-2 gap-3">
                {currentQ.answers.map((ans, i) => {
                  const answered = answers[qIndex] !== null;
                  const isChosen = answers[qIndex] === i;
                  const isCorrect = currentQ.correct === i;
                  return (
                    <button
                      key={i}
                      ref={(el) => { targetRefs.current[i] = el; }}
                      type="button"
                      onClick={() => !answered && handleAnswer(i)}
                      disabled={answered}
                      className={`relative flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium transition ${
                        answered
                          ? isCorrect
                            ? "border-[color:var(--edu-good)] bg-[color:var(--edu-good)]/15 text-[color:var(--edu-good)]"
                            : isChosen
                              ? "border-[color:var(--edu-danger)] bg-[color:var(--edu-danger)]/15 text-[color:var(--edu-danger)]"
                              : "border-[color:var(--edu-panel-border)] opacity-40"
                          : "border-[color:var(--edu-panel-border)] bg-white/[0.03] hover:border-[color:var(--edu-accent)]/60"
                      }`}
                    >
                      <span className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        answered && isCorrect
                          ? "bg-[color:var(--edu-good)]/30"
                          : "bg-white/10"
                      }`}>
                        {ANSWER_LABELS[i]}
                      </span>
                      {ans}
                      {/* Dwell progress ring */}
                      {dwellTargetRef.current === i && dwellProgress > 0 && (
                        <span className="absolute bottom-1 right-2 h-1.5 overflow-hidden rounded-full" style={{ width: 40 }}>
                          <span
                            className="block h-full rounded-full bg-[color:var(--edu-accent)] transition-all"
                            style={{ width: `${dwellProgress * 100}%` }}
                          />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Navigation */}
              <div className="mt-auto flex gap-3">
                <button
                  type="button"
                  onClick={prevQuestion}
                  disabled={qIndex === 0}
                  className="rounded-lg border border-[color:var(--edu-panel-border)] px-3 py-1.5 text-xs text-[color:var(--edu-text-dim)] disabled:opacity-40"
                >
                  ◀ {t("quiz.prev")}
                </button>
                {answers[qIndex] !== null && (
                  <button
                    type="button"
                    onClick={nextQuestion}
                    className="ml-auto rounded-lg bg-[color:var(--edu-accent)] px-4 py-1.5 text-xs font-bold text-[#04141a]"
                  >
                    {qIndex < DEMO_QUIZ.length - 1 ? `${t("quiz.next")} ▶` : t("quiz.finish")}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── TARGETING MODE (2×2 grid) ──────────────────── */}
          {phase === "targeting" && (
            <div className="grid h-full grid-cols-2 grid-rows-2 gap-3 p-4">
              {(["A", "B", "C", "D"] as const).map((label, i) => (
                <button
                  key={label}
                  ref={(el) => { targetRefs.current[i] = el; }}
                  type="button"
                  tabIndex={-1}
                  onClick={() => triggerTarget(i)}
                  className={`relative flex flex-col items-center justify-center gap-1 rounded-xl border text-sm font-semibold transition ${
                    flashIndex === i
                      ? "border-[color:var(--edu-good)] bg-[color:var(--edu-good)]/20 text-[color:var(--edu-good)]"
                      : "border-[color:var(--edu-panel-border)] bg-white/[0.02] text-[color:var(--edu-text-dim)] hover:border-[color:var(--edu-accent)]/40"
                  }`}
                >
                  <span className="text-2xl font-black">{label}</span>
                  <span className="text-[10px] font-medium uppercase tracking-widest">{t("pointer.title")}</span>
                  {/* Dwell progress bar */}
                  {dwellTargetRef.current === i && dwellProgress > 0 && (
                    <div className="absolute bottom-2 left-4 right-4 h-1 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-[color:var(--edu-accent)] transition-none"
                        style={{ width: `${dwellProgress * 100}%` }}
                      />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Cursor dot */}
          {cursorPx && !paused && (
            <div
              className="pointer-events-none absolute z-10 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 shadow-[0_0_12px_rgba(110,231,242,0.6)] transition-[border-color,background-color] duration-100"
              style={{
                left: cursorPx.x,
                top: cursorPx.y,
                borderColor: frame.pinchActive ? "var(--edu-good)" : "var(--edu-accent)",
                background: frame.pinchActive ? "rgba(74,222,128,0.35)" : "rgba(110,231,242,0.2)",
              }}
            />
          )}

          {paused && (
            <div className="absolute inset-0 grid place-items-center bg-black/40 text-sm font-semibold uppercase tracking-widest text-[color:var(--edu-warn)]">
              {t("gesture.palm")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
