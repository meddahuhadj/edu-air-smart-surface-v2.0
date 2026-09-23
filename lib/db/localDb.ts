import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Homography } from "../vision/calibration";

export interface LessonSession {
  id: string;
  startedAt: number;
  endedAt: number | null;
  clicks: number;
  strokes: number;
  manipulations3d: number;
  mode: "real" | "simulation";
}

export interface CalibrationProfile {
  id: "default";
  homography: Homography;
  updatedAt: number;
}

interface EduAirDB extends DBSchema {
  sessions: {
    key: string;
    value: LessonSession;
    indexes: { "by-startedAt": number };
  };
  calibration: {
    key: string;
    value: CalibrationProfile;
  };
}

const DB_NAME = "edu-air";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<EduAirDB>> | null = null;

function getDb() {
  if (typeof indexedDB === "undefined") return null;
  if (!dbPromise) {
    dbPromise = openDB<EduAirDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const sessions = db.createObjectStore("sessions", { keyPath: "id" });
        sessions.createIndex("by-startedAt", "startedAt");
        db.createObjectStore("calibration", { keyPath: "id" });
      },
    });
  }
  return dbPromise;
}

export async function saveSession(session: LessonSession): Promise<void> {
  const db = await getDb();
  if (!db) return; // IndexedDB unavailable (private browsing etc.) — session simply isn't persisted
  await db.put("sessions", session);
}

export async function listRecentSessions(limit = 5): Promise<LessonSession[]> {
  const db = await getDb();
  if (!db) return [];
  const all = await db.getAllFromIndex("sessions", "by-startedAt");
  return all.reverse().slice(0, limit);
}

export async function saveCalibration(homography: Homography): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.put("calibration", { id: "default", homography, updatedAt: Date.now() });
}

export async function loadCalibration(): Promise<CalibrationProfile | null> {
  const db = await getDb();
  if (!db) return null;
  return (await db.get("calibration", "default")) ?? null;
}
