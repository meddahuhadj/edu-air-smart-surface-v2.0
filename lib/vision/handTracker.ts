"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GestureEngine, type GestureFrame } from "./gestureEngine";

// Loaded lazily from a CDN, only once camera tracking is actually requested —
// never on page load. Only the model weights (numeric parameters) come from
// the network; camera video frames are processed in-browser and never sent
// anywhere (see the Privacy Center page).
const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

export type CameraErrorCode = "permission-denied" | "not-found" | "in-use" | "unsupported" | "unknown";

export interface CameraError {
  code: CameraErrorCode;
  message: string;
}

export type TrackerStatus = "idle" | "starting" | "loading-model" | "tracking" | "error" | "stopped";

function classifyGetUserMediaError(err: unknown): CameraError {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return { code: "permission-denied", message: "Camera permission was denied." };
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return { code: "not-found", message: "No camera device was found." };
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return { code: "in-use", message: "The camera is already in use by another application." };
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return { code: "unsupported", message: "This browser does not support camera access." };
  }
  return { code: "unknown", message: err instanceof Error ? err.message : "Unknown camera error." };
}

// A single HandLandmarker instance is reused across every component that
// mounts the hook, so switching screens (e.g. Air Pointer -> Air Draw) never
// re-downloads/re-initializes the model.
let landmarkerPromise: Promise<import("@mediapipe/tasks-vision").HandLandmarker> | null = null;

async function getHandLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const { FilesetResolver, HandLandmarker } = await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
      return HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
        runningMode: "VIDEO",
        numHands: 1,
      });
    })();
  }
  return landmarkerPromise;
}

export interface UseHandTrackingResult {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  status: TrackerStatus;
  error: CameraError | null;
  frame: GestureFrame;
  fps: number;
  trackingQuality: number; // 0..1, smoothed
  start: () => void;
  stop: () => void;
}

const EMPTY_FRAME: GestureFrame = {
  gesture: "NONE",
  confidence: 0,
  pinchActive: false,
  palmHoldMs: 0,
  cursor: null,
  events: [],
};

export function useHandTracking(enabled: boolean): UseHandTrackingResult {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const engineRef = useRef(new GestureEngine());
  const fpsWindowRef = useRef<number[]>([]);
  const qualityRef = useRef(0);

  const [status, setStatus] = useState<TrackerStatus>("idle");
  const [error, setError] = useState<CameraError | null>(null);
  const [frame, setFrame] = useState<GestureFrame>(EMPTY_FRAME);
  const [fps, setFps] = useState(0);
  const [trackingQuality, setTrackingQuality] = useState(0);

  const stop = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    engineRef.current.reset();
    fpsWindowRef.current = [];
    qualityRef.current = 0;
    setStatus("stopped");
    setFrame(EMPTY_FRAME);
    setFps(0);
    setTrackingQuality(0);
  }, []);

  const start = useCallback(() => {
    // guard against a Retry click stacking a second stream/loop on top of a
    // half-started previous attempt (e.g. camera opened but model load failed)
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    let cancelled = false;
    setError(null);
    setStatus("starting");

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 960 }, height: { ideal: 540 }, facingMode: "user" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) throw new Error("Video element not mounted");
        video.srcObject = stream;
        await video.play();

        setStatus("loading-model");
        const landmarker = await getHandLandmarker();
        if (cancelled) return;

        setStatus("tracking");

        const loop = () => {
          if (cancelled || !videoRef.current) return;
          const now = performance.now();
          const result = landmarker.detectForVideo(videoRef.current, now);

          const hand = result.landmarks?.[0] ?? null;
          const handConfidence = result.handednesses?.[0]?.[0]?.score ?? 0;

          const gestureFrame = engineRef.current.update(hand ?? null, now);
          setFrame(gestureFrame);

          qualityRef.current = qualityRef.current * 0.85 + (hand ? handConfidence : 0) * 0.15;
          setTrackingQuality(qualityRef.current);

          fpsWindowRef.current.push(now);
          fpsWindowRef.current = fpsWindowRef.current.filter((t) => now - t <= 1000);
          setFps(fpsWindowRef.current.length);

          rafRef.current = requestAnimationFrame(loop);
        };
        rafRef.current = requestAnimationFrame(loop);
      } catch (err) {
        if (cancelled) return;
        setError(classifyGetUserMediaError(err));
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    // opening the camera + model pipeline is exactly the "synchronize with an
    // external system" case effects are for; `start` sets status/error state
    // as that pipeline progresses (permission prompt -> model load -> tracking).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    const cleanup = start();
    return () => {
      cleanup?.();
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { videoRef, status, error, frame, fps, trackingQuality, start, stop };
}
