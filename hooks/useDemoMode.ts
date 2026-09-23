"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GestureEvent, GestureFrame, GestureType } from "@/lib/vision/gestureEngine";

const EMPTY_FRAME: GestureFrame = {
  gesture: "NONE",
  confidence: 0,
  pinchActive: false,
  palmHoldMs: 0,
  cursor: null,
  events: [],
};

/**
 * Simulation-mode input: the mouse/pointer stands in for the hand, exactly
 * like the existing marketing site's live demo. Never touches a camera.
 * Hold the pointer down to simulate a pinch; hold "P" for an open-palm
 * pause; hold "T" for a two-finger pose (zoom); press ArrowLeft/ArrowRight
 * for a swipe (previous/next). Same gesture vocabulary as the real hand
 * tracker — including swipe as a discrete `events` entry, not a held pose —
 * so downstream components don't need to know which source drives them.
 */
export function useDemoMode(containerRef: React.RefObject<HTMLElement | null>, enabled: boolean) {
  const [frame, setFrame] = useState<GestureFrame>(EMPTY_FRAME);

  const pinchActiveRef = useRef(false);
  const palmModeRef = useRef(false);
  const palmEnteredAtRef = useRef(0);
  const twoFingerModeRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  const computeGesture = useCallback((): GestureType => {
    if (pinchActiveRef.current) return "PINCH";
    if (palmModeRef.current) return "PALM";
    if (twoFingerModeRef.current) return "TWO_FINGER";
    return "POINT";
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!enabled || !el) return;

    const buildFrame = (events: GestureEvent[]): GestureFrame => {
      const pos = lastPosRef.current;
      if (!pos) return { ...EMPTY_FRAME, events };
      const now = performance.now();
      const gesture = computeGesture();
      const palmHoldMs = gesture === "PALM" ? Math.max(0, now - palmEnteredAtRef.current) : 0;
      return {
        gesture,
        confidence: 0.99,
        pinchActive: pinchActiveRef.current,
        palmHoldMs,
        cursor: pos,
        events,
      };
    };

    const updateFromEvent = (clientX: number, clientY: number) => {
      const rect = el.getBoundingClientRect();
      lastPosRef.current = {
        x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
        y: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
      };
      setFrame(buildFrame([]));
    };

    const onPointerMove = (e: PointerEvent) => updateFromEvent(e.clientX, e.clientY);
    const onPointerDown = (e: PointerEvent) => {
      pinchActiveRef.current = true;
      updateFromEvent(e.clientX, e.clientY);
    };
    const onPointerUp = (e: PointerEvent) => {
      pinchActiveRef.current = false;
      updateFromEvent(e.clientX, e.clientY);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === "p" && !palmModeRef.current) {
        palmModeRef.current = true;
        palmEnteredAtRef.current = performance.now();
        setFrame(buildFrame([]));
      } else if (key === "t" && !twoFingerModeRef.current) {
        twoFingerModeRef.current = true;
        setFrame(buildFrame([]));
      } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        const type: GestureType = e.key === "ArrowRight" ? "SWIPE_RIGHT" : "SWIPE_LEFT";
        setFrame(buildFrame([{ type, timestamp: performance.now() }]));
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === "p") palmModeRef.current = false;
      if (key === "t") twoFingerModeRef.current = false;
      if (key === "p" || key === "t") setFrame(buildFrame([]));
    };

    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      pinchActiveRef.current = false;
      palmModeRef.current = false;
      twoFingerModeRef.current = false;
      lastPosRef.current = null;
      setFrame(EMPTY_FRAME);
    };
  }, [containerRef, enabled, computeGesture]);

  return frame;
}
