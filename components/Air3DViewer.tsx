"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import type { GestureFrame } from "@/lib/vision/gestureEngine";
import { useDemoMode } from "@/hooks/useDemoMode";
import { SceneController } from "@/lib/scene3d/sceneController";
import { OBJECT_LIBRARY } from "@/lib/scene3d/library";
import type { Object3DDef } from "@/lib/scene3d/types";
import type { DictKey } from "@/lib/i18n/dictionaries";

const SUBJECTS: { id: Object3DDef["subject"] | "all"; labelKey: DictKey }[] = [
  { id: "all", labelKey: "scene3d.parts" },
  { id: "astronomy", labelKey: "scene3d.subject.astronomy" },
  { id: "chemistry", labelKey: "scene3d.subject.chemistry" },
  { id: "biology", labelKey: "scene3d.subject.biology" },
  { id: "anatomy", labelKey: "scene3d.subject.anatomy" },
  { id: "geology", labelKey: "scene3d.subject.geology" },
  { id: "physics", labelKey: "scene3d.subject.physics" },
  { id: "engineering", labelKey: "scene3d.subject.engineering" },
  { id: "math", labelKey: "scene3d.subject.math" },
];

export interface Air3DViewerProps {
  isSimulation: boolean;
  realFrame: GestureFrame;
  onManipulate: () => void;
}

export function Air3DViewer({ isSimulation, realFrame, onManipulate }: Air3DViewerProps) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<SceneController | null>(null);

  const demoFrame = useDemoMode(containerRef, isSimulation);
  const frame = isSimulation ? demoFrame : realFrame;

  const [subject, setSubject] = useState<(typeof SUBJECTS)[number]["id"]>("all");
  const filtered = useMemo(
    () => (subject === "all" ? OBJECT_LIBRARY : OBJECT_LIBRARY.filter((o) => o.subject === subject)),
    [subject],
  );
  const [index, setIndex] = useState(0);
  const current = filtered[Math.min(index, filtered.length - 1)] ?? OBJECT_LIBRARY[0];

  const selectSubject = (id: (typeof SUBJECTS)[number]["id"]) => {
    setSubject(id);
    setIndex(0);
  };

  const [parts, setParts] = useState<{ id: string; labelKey: DictKey; hidden: boolean }[]>([]);
  const [explode, setExplodeState] = useState(false);
  const [transparent, setTransparentState] = useState(false);
  const [isolated, setIsolated] = useState<string | null>(null);

  const prevCursorRef = useRef<{ x: number; y: number } | null>(null);
  const wasPinchingRef = useRef(false);
  const wasTwoFingerRef = useRef(false);
  const lastSwipeHandledAtRef = useRef(0);
  const autoRotateTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [autoRotate, setAutoRotate] = useState(false);
  const [showGrid, setShowGrid] = useState(false);

  // mount the WebGL scene once
  useEffect(() => {
    if (!canvasRef.current) return;
    const controller = new SceneController(canvasRef.current);
    controllerRef.current = controller;
    return () => {
      controller.dispose();
      if (autoRotateTimerRef.current) clearInterval(autoRotateTimerRef.current);
    };
  }, []);

  // auto-rotate
  useEffect(() => {
    if (autoRotateTimerRef.current) clearInterval(autoRotateTimerRef.current);
    if (autoRotate && controllerRef.current) {
      autoRotateTimerRef.current = setInterval(() => {
        controllerRef.current?.rotateBy(0.005, 0);
      }, 16);
    }
    return () => {
      if (autoRotateTimerRef.current) clearInterval(autoRotateTimerRef.current);
    };
  }, [autoRotate]);

  // load the selected object whenever it changes
  useEffect(() => {
    if (!controllerRef.current || !current) return;
    controllerRef.current.loadObject(current);
    setExplodeState(false);
    setTransparentState(false);
    setIsolated(null);
    setParts(controllerRef.current.listParts());
  }, [current]);

  // gesture-driven continuous rotate (pinch+drag) / zoom (two-finger+drag)
  useEffect(() => {
    const controller = controllerRef.current;

    // swipe is a discrete edge-triggered event (both in the real gesture
    // engine and demo mode), never a held pose — it rides alongside
    // whatever the continuous gesture is, so it's read from `events`
    const swipe = frame.events.find((e) => e.type === "SWIPE_LEFT" || e.type === "SWIPE_RIGHT");
    if (swipe) {
      const now = performance.now();
      if (now - lastSwipeHandledAtRef.current > 50) {
        lastSwipeHandledAtRef.current = now;
        const dir = swipe.type === "SWIPE_RIGHT" ? 1 : -1;
        setIndex((i) => (i + dir + filtered.length) % filtered.length);
        setIsolated(null);
        onManipulate();
      }
    }

    if (!controller || !frame.cursor) {
      prevCursorRef.current = null;
      wasPinchingRef.current = frame.pinchActive;
      wasTwoFingerRef.current = frame.gesture === "TWO_FINGER";
      return;
    }

    const prev = prevCursorRef.current;
    const isTwoFinger = frame.gesture === "TWO_FINGER";

    if (frame.pinchActive) {
      if (prev && wasPinchingRef.current) {
        controller.rotateBy(frame.cursor.x - prev.x, frame.cursor.y - prev.y);
      } else {
        onManipulate();
      }
    } else if (isTwoFinger) {
      if (prev && wasTwoFingerRef.current) {
        controller.zoomBy(prev.y - frame.cursor.y);
      }
    }

    prevCursorRef.current = frame.cursor;
    wasPinchingRef.current = frame.pinchActive;
    wasTwoFingerRef.current = isTwoFinger;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame.cursor, frame.pinchActive, frame.gesture, frame.events]);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-[color:var(--edu-text-dim)]">{t("scene3d.hint")}</p>
      {isSimulation && (
        <p className="hud-mono text-xs text-[color:var(--edu-text-dim)]">
          {t("scene3d.hint.simulation")}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {SUBJECTS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => selectSubject(s.id)}
            className={`rounded-md border px-3 py-1 text-xs font-medium ${
              subject === s.id
                ? "border-[color:var(--edu-accent)] text-[color:var(--edu-accent)]"
                : "border-[color:var(--edu-panel-border)] text-[color:var(--edu-text-dim)]"
            }`}
          >
            {t(s.labelKey)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_260px]">
        <div ref={containerRef} className="glass relative h-80 w-full overflow-hidden lg:h-96">
          <canvas ref={canvasRef} className="h-full w-full" />
          {/* Grid overlay */}
          {showGrid && (
            <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-20" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#6ee7f2" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          )}
          <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-0.5">
            <span className="text-sm font-semibold">{current && t(current.nameKey)}</span>
            {current && t(current.noteKey) && (
              <span className="text-[10px] uppercase tracking-wide text-[color:var(--edu-warn)]">
                {t(current.noteKey)}
              </span>
            )}
          </div>
          {frame.pinchActive && (
            <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-[color:var(--edu-good)]/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-[color:var(--edu-good)]">
              {t("gesture.pinch")}
            </div>
          )}
          {/* Action bar on the canvas */}
          <div className="pointer-events-auto absolute bottom-3 right-3 flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => {
                const c = canvasRef.current;
                if (!c) return;
                const a = document.createElement("a");
                a.download = `edu-air-3d-${current?.nameKey ?? "object"}.png`;
                a.href = c.toDataURL("image/png");
                a.click();
              }}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[color:var(--edu-panel-border)] bg-black/50 text-sm text-[color:var(--edu-good)] backdrop-blur hover:bg-black/70"
              title={t("scene3d.screenshot")}
            >
              📸
            </button>
            <button
              type="button"
              onClick={() => setAutoRotate((v) => !v)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg border backdrop-blur text-sm ${autoRotate ? "border-[color:var(--edu-accent)] bg-[color:var(--edu-accent)]/20 text-[color:var(--edu-accent)]" : "border-[color:var(--edu-panel-border)] bg-black/50 text-[color:var(--edu-text-dim)] hover:bg-black/70"}`}
              title={t("scene3d.autoRotate")}
            >
              🔄
            </button>
            <button
              type="button"
              onClick={() => setShowGrid((v) => !v)}
              className={`flex h-8 w-8 items-center justify-center rounded-lg border backdrop-blur text-sm ${showGrid ? "border-[color:var(--edu-accent)] bg-[color:var(--edu-accent)]/20 text-[color:var(--edu-accent)]" : "border-[color:var(--edu-panel-border)] bg-black/50 text-[color:var(--edu-text-dim)] hover:bg-black/70"}`}
              title={t("scene3d.grid")}
            >
              ⊞
            </button>
          </div>
        </div>

        <div className="glass flex flex-col gap-3 p-4">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[color:var(--edu-text-dim)]">
              {t("scene3d.parts")}
            </span>
            <div className="mt-2 flex flex-col gap-1.5">
              {parts.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      controllerRef.current?.togglePartVisible(p.id);
                      setParts(controllerRef.current?.listParts() ?? []);
                      onManipulate();
                    }}
                    className={`flex-1 truncate rounded-md border px-2 py-1 text-left text-xs ${
                      p.hidden
                        ? "border-[color:var(--edu-panel-border)] text-[color:var(--edu-text-dim)] line-through"
                        : "border-[color:var(--edu-panel-border)] text-[color:var(--edu-text)]"
                    }`}
                  >
                    {t(p.labelKey)}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      controllerRef.current?.setIsolated(p.id);
                      setIsolated(controllerRef.current?.isolatedPartId ?? null);
                      onManipulate();
                    }}
                    className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${
                      isolated === p.id
                        ? "border-[color:var(--edu-accent)] text-[color:var(--edu-accent)]"
                        : "border-[color:var(--edu-panel-border)] text-[color:var(--edu-text-dim)]"
                    }`}
                  >
                    {t("scene3d.isolate")}
                  </button>
                </div>
              ))}
              {isolated && (
                <button
                  type="button"
                  onClick={() => {
                    controllerRef.current?.setIsolated(isolated);
                    setIsolated(null);
                  }}
                  className="mt-1 rounded-md border border-[color:var(--edu-panel-border)] px-2 py-1 text-xs text-[color:var(--edu-text-dim)]"
                >
                  {t("scene3d.showAll")}
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5 border-t border-[color:var(--edu-panel-border)] pt-3">
            <ToggleButton
              active={explode}
              label={t("scene3d.explode")}
              onClick={() => {
                const next = !explode;
                controllerRef.current?.setExplode(next);
                setExplodeState(next);
                onManipulate();
              }}
            />
            <ToggleButton
              active={transparent}
              label={t("scene3d.transparent")}
              onClick={() => {
                const next = !transparent;
                controllerRef.current?.setTransparent(next);
                setTransparentState(next);
                onManipulate();
              }}
            />
            <button
              type="button"
              onClick={() => {
                controllerRef.current?.reset();
                setExplodeState(false);
                setTransparentState(false);
                setIsolated(null);
                onManipulate();
              }}
              className="rounded-md border border-[color:var(--edu-danger)]/40 px-2 py-1.5 text-xs font-semibold text-[color:var(--edu-danger)]"
            >
              {t("scene3d.reset")}
            </button>
          </div>
        </div>
      </div>

      <div className="glass p-3 text-xs text-[color:var(--edu-text-dim)]">
        <strong className="text-[color:var(--edu-text)]">{t("scene3d.comingSoon.title")}</strong>
        <p className="mt-1">{t("scene3d.comingSoon.body")}</p>
      </div>
    </div>
  );
}

function ToggleButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-2 py-1.5 text-xs font-semibold ${
        active
          ? "border-[color:var(--edu-accent)] bg-[color:var(--edu-accent)]/10 text-[color:var(--edu-accent)]"
          : "border-[color:var(--edu-panel-border)] text-[color:var(--edu-text-dim)]"
      }`}
    >
      {label}
    </button>
  );
}
