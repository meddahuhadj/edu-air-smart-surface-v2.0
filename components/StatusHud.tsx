"use client";

import { useI18n } from "@/lib/i18n/context";
import type { GestureType } from "@/lib/vision/gestureEngine";
import type { DictKey } from "@/lib/i18n/dictionaries";

const GESTURE_LABELS: Record<GestureType, DictKey> = {
  NONE: "gesture.none",
  POINT: "gesture.point",
  PINCH: "gesture.pinch",
  PALM: "gesture.palm",
  FIST: "gesture.fist",
  TWO_FINGER: "gesture.twoFinger",
  SWIPE_LEFT: "gesture.swipeLeft",
  SWIPE_RIGHT: "gesture.swipeRight",
};

export type CameraStatus = "ready" | "unavailable" | "off";

export interface StatusHudProps {
  trackingQuality: number; // 0..1
  fps: number;
  gesture: GestureType;
  cameraStatus: CameraStatus;
  calibrated: boolean;
}

function Cell({ label, value, tone }: { label: string; value: string; tone?: "good" | "warn" | "danger" }) {
  const toneClass =
    tone === "good"
      ? "text-[color:var(--edu-good)]"
      : tone === "warn"
        ? "text-[color:var(--edu-warn)]"
        : tone === "danger"
          ? "text-[color:var(--edu-danger)]"
          : "text-[color:var(--edu-text)]";
  return (
    <div className="flex flex-col gap-0.5 hud-mono">
      <span className="text-[10px] uppercase tracking-widest text-[color:var(--edu-text-dim)]">{label}</span>
      <span className={`text-sm font-semibold ${toneClass}`}>{value}</span>
    </div>
  );
}

const CAMERA_LABEL: Record<CameraStatus, DictKey> = {
  ready: "status.ready",
  unavailable: "status.unavailable",
  off: "status.none",
};
const CAMERA_TONE: Record<CameraStatus, "good" | "warn" | "danger"> = {
  ready: "good",
  unavailable: "danger",
  off: "warn",
};

export function StatusHud({ trackingQuality, fps, gesture, cameraStatus, calibrated }: StatusHudProps) {
  const { t } = useI18n();
  const pct = Math.round(trackingQuality * 100);
  const trackingTone = pct >= 70 ? "good" : pct >= 35 ? "warn" : "danger";

  return (
    <div className="glass grid grid-cols-2 gap-4 p-4 sm:grid-cols-5" role="status" aria-live="off">
      <Cell label={t("status.camera")} value={t(CAMERA_LABEL[cameraStatus])} tone={CAMERA_TONE[cameraStatus]} />
      <Cell label={t("status.tracking")} value={`${pct}%`} tone={trackingTone} />
      <Cell label="FPS" value={String(fps)} tone={fps >= 15 ? "good" : "warn"} />
      <Cell label={t("status.gesture")} value={t(GESTURE_LABELS[gesture])} />
      <Cell label={t("status.calibration")} value={calibrated ? t("status.calibrated") : t("status.notCalibrated")} tone={calibrated ? "good" : "warn"} />
    </div>
  );
}
