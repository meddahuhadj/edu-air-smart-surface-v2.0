"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import type { GestureFrame } from "@/lib/vision/gestureEngine";
import { useDemoMode } from "@/hooks/useDemoMode";
import { computeHomography, IDENTITY_HOMOGRAPHY, type Homography, type Point } from "@/lib/vision/calibration";

export interface CalibrationWizardProps {
  isSimulation: boolean;
  realFrame: GestureFrame;
  onComplete: (homography: Homography) => void;
}

const CORNER_LABELS = ["↖", "↗", "↘", "↙"];
// destination = full stage rectangle, in the same order corners are collected
const DEST_CORNERS: Point[] = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

export function CalibrationWizard({ isSimulation, realFrame, onComplete }: CalibrationWizardProps) {
  const { t } = useI18n();
  const cardRef = useRef<HTMLDivElement>(null);
  const demoFrame = useDemoMode(cardRef, isSimulation);
  const frame = isSimulation ? demoFrame : realFrame;

  const [corners, setCorners] = useState<(Point | null)[]>([null, null, null, null]);
  const [error, setError] = useState(false);
  const wasPinchingRef = useRef(false);
  const lastCaptureAtRef = useRef(0);

  const step = corners.findIndex((c) => c === null);
  const activeStep = step === -1 ? 4 : step;

  const captureCorner = () => {
    if (!frame.cursor) return;
    // in simulation mode a click both fires this button's onClick AND bubbles
    // as a pinch edge (mouse-down/up *is* the simulated pinch) — debounce so
    // one physical click can't advance two corners at once
    const now = performance.now();
    if (now - lastCaptureAtRef.current < 200) return;
    lastCaptureAtRef.current = now;
    // stored in the same "oriented" space AirPointer/AirDraw project into,
    // so this homography composes directly with their cursor orientation
    const oriented: Point = isSimulation ? frame.cursor : { x: 1 - frame.cursor.x, y: frame.cursor.y };
    setCorners((prev) => {
      const idx = prev.findIndex((c) => c === null);
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = oriented;
      return next;
    });
  };

  // pinch-to-confirm each corner
  useEffect(() => {
    if (frame.pinchActive && !wasPinchingRef.current) {
      captureCorner();
    }
    wasPinchingRef.current = frame.pinchActive;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame.pinchActive]);

  const reset = () => {
    setCorners([null, null, null, null]);
    setError(false);
  };

  const confirmAll = () => {
    if (corners.some((c) => c === null)) return;
    const h = computeHomography(corners as Point[], DEST_CORNERS);
    if (!h) {
      setError(true);
      return;
    }
    onComplete(h);
  };

  const useFullFrame = () => onComplete(IDENTITY_HOMOGRAPHY);

  return (
    <div ref={cardRef} className="glass flex flex-col gap-4 p-6">
      <div>
        <h3 className="text-sm font-semibold uppercase tracking-widest text-[color:var(--edu-accent)]">
          {t("calibration.title")}
        </h3>
        <p className="mt-2 text-sm text-[color:var(--edu-text-dim)]">{t("calibration.manual")}</p>
      </div>

      <div className="flex items-center gap-3">
        {CORNER_LABELS.map((label, i) => (
          <div
            key={label}
            className={`flex h-12 w-12 items-center justify-center rounded-lg border text-lg font-bold ${
              corners[i]
                ? "border-[color:var(--edu-good)] bg-[color:var(--edu-good)]/10 text-[color:var(--edu-good)]"
                : i === activeStep
                  ? "border-[color:var(--edu-accent)] bg-[color:var(--edu-accent)]/10 text-[color:var(--edu-accent)] pulse"
                  : "border-[color:var(--edu-panel-border)] text-[color:var(--edu-text-dim)]"
            }`}
          >
            {label}
          </div>
        ))}
        <span className="hud-mono text-xs text-[color:var(--edu-text-dim)]">
          {t("calibration.corner")} {Math.min(activeStep + 1, 4)}/4
        </span>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={captureCorner}
          disabled={activeStep >= 4 || !frame.cursor}
          className="rounded-lg bg-[color:var(--edu-accent)] px-4 py-2 text-sm font-semibold text-[#04141a] transition disabled:opacity-40"
        >
          {t("calibration.corner")} {Math.min(activeStep + 1, 4)}
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded-lg border border-[color:var(--edu-panel-border)] px-4 py-2 text-sm text-[color:var(--edu-text-dim)]"
        >
          {t("calibration.reset")}
        </button>
        <button
          type="button"
          onClick={confirmAll}
          disabled={activeStep < 4}
          className="rounded-lg border border-[color:var(--edu-good)] px-4 py-2 text-sm font-semibold text-[color:var(--edu-good)] disabled:opacity-40"
        >
          {t("calibration.confirm")}
        </button>
      </div>

      {error && (
        <p className="text-xs text-[color:var(--edu-danger)]">
          {t("error.camera.cause")} — {t("calibration.reset")}
        </p>
      )}

      <div className="border-t border-[color:var(--edu-panel-border)] pt-4">
        <button
          type="button"
          onClick={useFullFrame}
          className="rounded-lg border border-[color:var(--edu-accent-2)]/40 px-4 py-2 text-sm font-semibold text-[color:var(--edu-accent-2)]"
        >
          {t("calibration.auto")}
        </button>
        <p className="mt-2 text-xs text-[color:var(--edu-text-dim)]">{t("calibration.auto.note")}</p>
      </div>
    </div>
  );
}
