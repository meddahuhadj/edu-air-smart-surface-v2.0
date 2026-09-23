"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";
import { useClassroomSession, type InteractionMode } from "@/lib/session/classroomSession";
import { useHandTracking } from "@/lib/vision/handTracker";
import { loadCalibration, saveCalibration } from "@/lib/db/localDb";
import type { Homography } from "@/lib/vision/calibration";
import { ModeBadge } from "@/components/ModeBadge";
import { StatusHud } from "@/components/StatusHud";
import { CameraFeed } from "@/components/CameraFeed";
import { CameraErrorPanel } from "@/components/ErrorPanel";
import { CalibrationWizard } from "@/components/CalibrationWizard";
import { AirPointerOverlay } from "@/components/AirPointerOverlay";
import { AirDrawCanvas } from "@/components/AirDrawCanvas";
import { Air3DViewer } from "@/components/Air3DViewer";
import { AirLabViewer } from "@/components/AirLabViewer";
import { AirQuizView } from "@/components/AirQuizView";
import { AiTeacherPanel } from "@/components/AiTeacherPanel";
import { AiLessonModal } from "@/components/AiLessonModal";

function ClassroomInner() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const initialMode = (searchParams.get("mode") as InteractionMode | null) ?? "pointer";

  const session = useClassroomSession();

  const [homography, setHomography] = useState<Homography | null>(null);
  const [savedHomography, setSavedHomography] = useState<Homography | null>(null);
  const [redoCalibration, setRedoCalibration] = useState(false);

  // AI Assistant & Lesson Creator modal states
  const [teacherOpen, setTeacherOpen] = useState(false);
  const [lessonModalOpen, setLessonModalOpen] = useState(false);

  const active = session.step === "calibrating" || session.step === "session";
  const real = useHandTracking(active && !session.isSimulation);

  useEffect(() => {
    loadCalibration().then((profile) => {
      if (profile) setSavedHomography(profile.homography);
    });
  }, []);

  useEffect(() => {
    if (session.step === "idle") session.setInteractionMode(initialMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMode]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.body.classList.toggle("tni-mode", session.isTniMode);
      window.dispatchEvent(new Event("tni-mode-change"));
    }
  }, [session.isTniMode]);

  const cameraStatus: "ready" | "unavailable" | "off" = session.isSimulation
    ? "off"
    : real.status === "tracking"
      ? "ready"
      : "unavailable";
  const trackingQuality = session.isSimulation ? 1 : real.trackingQuality;
  const fps = session.isSimulation ? null : real.fps;
  const hudGesture = session.isSimulation ? "NONE" : real.frame.gesture;

  const handleCompleteCalibration = (h: Homography) => {
    setHomography(h);
    setSavedHomography(h);
    void saveCalibration(h);
    setRedoCalibration(false);
    session.finishCalibration();
  };

  return (
    <div className={`mx-auto flex flex-col gap-6 py-8 transition-all ${session.isTniMode ? "w-full max-w-[1920px] px-6" : "max-w-6xl px-4 sm:px-6"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">{t("nav.classroom")}</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={session.toggleTniMode}
            className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
              session.isTniMode
                ? "border-[color:var(--edu-accent)] bg-[color:var(--edu-accent)] text-black shadow-lg"
                : "border-[color:var(--edu-panel-border)] bg-white/5 text-slate-300 hover:bg-white/10"
            }`}
            title="Activer le mode grand écran interactif TNI 86 pouces"
          >
            📺 {session.isTniMode ? "TNI 86\" (Actif)" : "Mode TNI 86\""}
          </button>
          <button
            type="button"
            onClick={() => setLessonModalOpen(true)}
            className="rounded-lg border border-purple-500/40 bg-purple-500/10 px-3 py-1.5 text-xs font-bold text-purple-300 transition hover:bg-purple-500/20"
          >
            📖 {t("dashboard.quickActions.createLesson")}
          </button>
          <button
            type="button"
            onClick={() => setTeacherOpen(true)}
            className="rounded-lg border border-[color:var(--edu-accent)]/40 bg-[color:var(--edu-accent)]/10 px-3 py-1.5 text-xs font-bold text-[color:var(--edu-accent)] transition hover:bg-[color:var(--edu-accent)]/20"
          >
            🤖 {t("dashboard.quickActions.aiTeacher")}
          </button>
          {session.step !== "idle" && <ModeBadge isSimulation={session.isSimulation} />}
        </div>
      </div>

      {session.step === "idle" && (
        <div className="glass flex flex-col items-start gap-4 p-8">
          <p className="max-w-xl text-sm text-[color:var(--edu-text-dim)]">
            {t("classroom.step.calibrate")} → {t("classroom.step.testCamera")} → {t("classroom.step.pointer")} /{" "}
            {t("classroom.step.draw")} / {t("classroom.step.3d")} / Air Lab / Air Quiz → {t("classroom.step.report")}
          </p>
          <button
            type="button"
            onClick={session.begin}
            className="rounded-xl bg-[color:var(--edu-accent)] px-6 py-3 text-sm font-bold text-[#04141a] transition hover:opacity-90"
          >
            {t("classroom.start")}
          </button>
        </div>
      )}

      {active && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <StatusHud
              trackingQuality={trackingQuality}
              fps={fps ?? 0}
              gesture={hudGesture}
              cameraStatus={cameraStatus}
              calibrated={homography !== null}
              isTniMode={session.isTniMode}
            />
            <CameraFeed videoRef={real.videoRef} visible={!session.isSimulation} />
          </div>

          {!session.isSimulation && real.status === "error" && real.error && (
            <CameraErrorPanel onRetry={real.start} onUseSimulation={() => session.setSimulation(true)} />
          )}

          {session.isSimulation && (
            <p className="hud-mono text-xs text-[color:var(--edu-text-dim)]">{t("mode.simulation.hint")} · hold click = pinch · hold “P” = palm</p>
          )}

          {session.step === "calibrating" && (
            <>
              {savedHomography && !redoCalibration ? (
                <div className="glass flex flex-wrap items-center justify-between gap-3 p-5">
                  <span className="text-sm text-[color:var(--edu-good)]">{t("calibration.done")}</span>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setHomography(savedHomography);
                        session.finishCalibration();
                      }}
                      className="rounded-lg bg-[color:var(--edu-good)] px-4 py-2 text-sm font-semibold text-[#04141a]"
                    >
                      {t("calibration.confirm")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setRedoCalibration(true)}
                      className="rounded-lg border border-[color:var(--edu-panel-border)] px-4 py-2 text-sm text-[color:var(--edu-text-dim)]"
                    >
                      {t("calibration.reset")}
                    </button>
                  </div>
                </div>
              ) : (
                <CalibrationWizard
                  isSimulation={session.isSimulation}
                  realFrame={real.frame}
                  onComplete={handleCompleteCalibration}
                />
              )}
            </>
          )}

          {session.step === "session" && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                {(["pointer", "draw", "3d", "lab", "quiz"] as InteractionMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => session.setInteractionMode(mode)}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                      session.interactionMode === mode
                        ? "bg-[color:var(--edu-accent)] text-[#04141a]"
                        : "border border-[color:var(--edu-panel-border)] text-[color:var(--edu-text-dim)] hover:border-white/30"
                    }`}
                  >
                    {mode === "pointer"
                      ? t("classroom.step.pointer")
                      : mode === "draw"
                        ? t("classroom.step.draw")
                        : mode === "3d"
                          ? t("classroom.step.3d")
                          : mode === "lab"
                            ? `🔬 ${t("dashboard.quickActions.airLab")}`
                            : `📝 ${t("dashboard.quickActions.airQuiz")}`}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={session.endCourse}
                  className="ml-auto rounded-lg border border-[color:var(--edu-danger)]/50 px-4 py-2 text-sm font-semibold text-[color:var(--edu-danger)] hover:bg-[color:var(--edu-danger)]/10"
                >
                  {t("classroom.end")}
                </button>
              </div>

              {session.interactionMode === "pointer" && (
                <AirPointerOverlay
                  isSimulation={session.isSimulation}
                  realFrame={real.frame}
                  homography={homography}
                  onSelect={session.registerClick}
                />
              )}
              {session.interactionMode === "draw" && (
                <AirDrawCanvas
                  isSimulation={session.isSimulation}
                  realFrame={real.frame}
                  homography={homography}
                  onStroke={session.registerStroke}
                />
              )}
              {session.interactionMode === "3d" && (
                <Air3DViewer
                  isSimulation={session.isSimulation}
                  realFrame={real.frame}
                  onManipulate={session.register3D}
                />
              )}
              {session.interactionMode === "lab" && (
                <AirLabViewer onExperiment={session.register3D} />
              )}
              {session.interactionMode === "quiz" && (
                <AirQuizView
                  isSimulation={session.isSimulation}
                  realFrame={real.frame}
                  onAnswerSubmit={session.registerClick}
                />
              )}
            </div>
          )}
        </div>
      )}

      {session.step === "report" && session.report && (
        <div className="glass flex flex-col gap-4 p-8">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-[color:var(--edu-accent)]">
            {t("classroom.report.title")}
          </h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <ReportStat label={t("classroom.report.duration")} value={`${Math.round(session.report.durationMs / 1000)}s`} />
            <ReportStat label={t("classroom.report.clicks")} value={String(session.report.clicks)} />
            <ReportStat label={t("classroom.report.strokes")} value={String(session.report.strokes)} />
            <ReportStat label={t("classroom.report.manipulations3d")} value={String(session.report.manipulations3d)} />
          </div>
          <div className="flex gap-3 pt-2">
            <Link
              href="/dashboard"
              onClick={session.reset}
              className="rounded-lg bg-[color:var(--edu-accent)] px-5 py-2 text-sm font-semibold text-[#04141a]"
            >
              {t("classroom.report.close")}
            </Link>
            <button
              type="button"
              onClick={session.begin}
              className="rounded-lg border border-[color:var(--edu-panel-border)] px-5 py-2 text-sm text-[color:var(--edu-text-dim)]"
            >
              {t("classroom.start")}
            </button>
          </div>
        </div>
      )}

      {/* AI Copilot & Lesson Creator Drawers / Modals */}
      <AiTeacherPanel isOpen={teacherOpen} onClose={() => setTeacherOpen(false)} />
      <AiLessonModal
        isOpen={lessonModalOpen}
        onClose={() => setLessonModalOpen(false)}
        onStartLesson={(recMode) => {
          if (session.step === "idle") session.begin();
          session.setInteractionMode(recMode);
        }}
      />
    </div>
  );
}

function ReportStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-[color:var(--edu-panel-border)] p-4">
      <span className="text-[10px] uppercase tracking-widest text-[color:var(--edu-text-dim)]">{label}</span>
      <span className="hud-mono text-xl font-bold">{value}</span>
    </div>
  );
}

export default function ClassroomPage() {
  return (
    <Suspense fallback={null}>
      <ClassroomInner />
    </Suspense>
  );
}
