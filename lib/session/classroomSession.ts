"use client";

import { useCallback, useRef, useState } from "react";
import { saveSession, type LessonSession } from "../db/localDb";

export type ClassroomStep = "idle" | "calibrating" | "session" | "report";
export type InteractionMode = "pointer" | "draw" | "3d" | "lab" | "quiz";

export interface SessionReport {
  durationMs: number;
  clicks: number;
  strokes: number;
  manipulations3d: number;
}

export interface ClassroomSessionState {
  step: ClassroomStep;
  interactionMode: InteractionMode;
  isSimulation: boolean;
  report: SessionReport | null;
  begin: () => void;
  finishCalibration: () => void;
  setInteractionMode: (mode: InteractionMode) => void;
  registerClick: () => void;
  registerStroke: () => void;
  register3D: () => void;
  setSimulation: (value: boolean) => void;
  endCourse: () => void;
  reset: () => void;
}

function makeSessionId() {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useClassroomSession(): ClassroomSessionState {
  const [step, setStep] = useState<ClassroomStep>("idle");
  const [interactionMode, setInteractionModeState] = useState<InteractionMode>("pointer");
  const [isSimulation, setIsSimulation] = useState(false);
  const [report, setReport] = useState<SessionReport | null>(null);

  const startedAtRef = useRef<number | null>(null);
  const clicksRef = useRef(0);
  const strokesRef = useRef(0);
  const manipulations3dRef = useRef(0);

  const begin = useCallback(() => {
    startedAtRef.current = Date.now();
    clicksRef.current = 0;
    strokesRef.current = 0;
    manipulations3dRef.current = 0;
    setReport(null);
    setStep("calibrating");
  }, []);

  const finishCalibration = useCallback(() => {
    setStep("session");
  }, []);

  const setInteractionMode = useCallback((mode: InteractionMode) => {
    setInteractionModeState(mode);
  }, []);

  const registerClick = useCallback(() => {
    clicksRef.current += 1;
  }, []);

  const registerStroke = useCallback(() => {
    strokesRef.current += 1;
  }, []);

  const register3D = useCallback(() => {
    manipulations3dRef.current += 1;
  }, []);

  const setSimulation = useCallback((value: boolean) => {
    setIsSimulation(value);
  }, []);

  const endCourse = useCallback(() => {
    const startedAt = startedAtRef.current ?? Date.now();
    const endedAt = Date.now();
    const durationMs = endedAt - startedAt;

    const session: LessonSession = {
      id: makeSessionId(),
      startedAt,
      endedAt,
      clicks: clicksRef.current,
      strokes: strokesRef.current,
      manipulations3d: manipulations3dRef.current,
      mode: isSimulation ? "simulation" : "real",
    };
    void saveSession(session);

    setReport({
      durationMs,
      clicks: clicksRef.current,
      strokes: strokesRef.current,
      manipulations3d: manipulations3dRef.current,
    });
    setStep("report");
  }, [isSimulation]);

  const reset = useCallback(() => {
    startedAtRef.current = null;
    clicksRef.current = 0;
    strokesRef.current = 0;
    manipulations3dRef.current = 0;
    setReport(null);
    setStep("idle");
  }, []);

  return {
    step,
    interactionMode,
    isSimulation,
    report,
    begin,
    finishCalibration,
    setInteractionMode,
    registerClick,
    registerStroke,
    register3D,
    setSimulation,
    endCourse,
    reset,
  };
}
