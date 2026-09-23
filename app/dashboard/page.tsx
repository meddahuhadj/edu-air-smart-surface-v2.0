"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import { listRecentSessions, type LessonSession } from "@/lib/db/localDb";
import type { DictKey } from "@/lib/i18n/dictionaries";

interface QuickAction {
  key: string;
  titleKey: DictKey;
  descKey: DictKey;
  href: string;
  soon?: boolean;
  icon: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { key: "start",   titleKey: "dashboard.quickActions.startCourse",   descKey: "dashboard.quickActions.startCourse.desc",   href: "/classroom",             icon: "🚀" },
  { key: "pointer", titleKey: "dashboard.quickActions.airPointer",    descKey: "dashboard.quickActions.airPointer.desc",    href: "/classroom?mode=pointer", icon: "👆" },
  { key: "draw",    titleKey: "dashboard.quickActions.airDraw",       descKey: "dashboard.quickActions.airDraw.desc",       href: "/classroom?mode=draw",    icon: "✏️" },
  { key: "3d",      titleKey: "dashboard.quickActions.air3d",         descKey: "dashboard.quickActions.air3d.desc",         href: "/classroom?mode=3d",      icon: "🌐" },
  { key: "lab",     titleKey: "dashboard.quickActions.airLab",        descKey: "dashboard.quickActions.airLab.desc",        href: "/classroom?mode=lab",     icon: "🔬" },
  { key: "quiz",    titleKey: "dashboard.quickActions.airQuiz",       descKey: "dashboard.quickActions.airQuiz.desc",       href: "/classroom?mode=quiz",    icon: "📝" },
  { key: "lesson",  titleKey: "dashboard.quickActions.createLesson",  descKey: "dashboard.quickActions.createLesson.desc",  href: "/classroom",              icon: "📖" },
  { key: "teacher", titleKey: "dashboard.quickActions.aiTeacher",     descKey: "dashboard.quickActions.aiTeacher.desc",     href: "/classroom",              icon: "🤖" },
];

function formatDuration(ms: number, locale: string) {
  const minutes = Math.round(ms / 60000);
  return new Intl.NumberFormat(locale).format(minutes);
}

function formatHMS(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ── Classroom Timer ────────────────────────────────────────────────────────
function ClassroomTimer() {
  const { t } = useI18n();
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0); // seconds
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(() => {
    if (running) return;
    setRunning(true);
    intervalRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
  }, [running]);

  const pause = useCallback(() => {
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  const reset = useCallback(() => {
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    setElapsed(0);
  }, []);

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  return (
    <div className="glass flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-[color:var(--edu-text-dim)]">
          ⏱ {t("timer.title")}
        </span>
        {running && (
          <span className="animate-pulse rounded-full bg-[color:var(--edu-danger)]/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-[color:var(--edu-danger)]">
            ● LIVE
          </span>
        )}
      </div>

      <div className="text-center">
        <span className="hud-mono text-5xl font-black tracking-tighter text-[color:var(--edu-accent)]">
          {formatHMS(elapsed)}
        </span>
        <p className="mt-1 text-[10px] uppercase tracking-widest text-[color:var(--edu-text-dim)]">
          {t("timer.elapsed")}
        </p>
      </div>

      {/* Progress bar (up to 45 min = 2700s) */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[color:var(--edu-accent)] to-[color:var(--edu-accent-2)] transition-all duration-500"
          style={{ width: `${Math.min(100, (elapsed / 2700) * 100)}%` }}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {!running ? (
          <button
            type="button"
            onClick={start}
            className="rounded-lg bg-[color:var(--edu-good)] px-4 py-1.5 text-xs font-bold text-[#04141a] transition hover:opacity-90"
          >
            ▶ {t("timer.start")}
          </button>
        ) : (
          <button
            type="button"
            onClick={pause}
            className="rounded-lg bg-[color:var(--edu-warn)] px-4 py-1.5 text-xs font-bold text-[#04141a] transition hover:opacity-90"
          >
            ⏸ {t("timer.pause")}
          </button>
        )}
        <button
          type="button"
          onClick={reset}
          className="rounded-lg border border-[color:var(--edu-panel-border)] px-4 py-1.5 text-xs text-[color:var(--edu-text-dim)] transition hover:border-white/30"
        >
          ↺ {t("timer.reset")}
        </button>
      </div>
    </div>
  );
}

// ── Session Stats ─────────────────────────────────────────────────────────
function SessionStats({ sessions }: { sessions: LessonSession[] }) {
  const { t, locale } = useI18n();

  const totalClicks = sessions.reduce((s, sess) => s + sess.clicks, 0);
  const totalStrokes = sessions.reduce((s, sess) => s + sess.strokes, 0);
  const totalManip3d = sessions.reduce((s, sess) => s + sess.manipulations3d, 0);
  const totalMs = sessions.reduce((s, sess) => s + (sess.endedAt ? sess.endedAt - sess.startedAt : 0), 0);

  const items = [
    { key: "clicks",    label: t("dashboard.stats.clicks"),   value: totalClicks.toLocaleString(locale),    icon: "👆" },
    { key: "strokes",   label: t("dashboard.stats.strokes"),  value: totalStrokes.toLocaleString(locale),   icon: "✏️" },
    { key: "manip3d",   label: t("dashboard.stats.manip3d"),  value: totalManip3d.toLocaleString(locale),   icon: "🌐" },
    { key: "duration",  label: t("dashboard.stats.duration"), value: `${Math.round(totalMs / 60000)} min`, icon: "⏱" },
  ];

  return (
    <div className="glass grid grid-cols-2 gap-3 p-5 sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.key} className="flex flex-col gap-1 rounded-xl border border-[color:var(--edu-panel-border)] p-3">
          <span className="text-lg">{item.icon}</span>
          <span className="hud-mono text-xl font-bold text-[color:var(--edu-accent)]">{item.value}</span>
          <span className="text-[10px] uppercase tracking-widest text-[color:var(--edu-text-dim)]">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { t, locale } = useI18n();
  const [sessions, setSessions] = useState<LessonSession[] | null>(null);

  useEffect(() => {
    listRecentSessions(20).then(setSessions);
  }, []);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6">
      {/* Today section placeholder */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[color:var(--edu-text-dim)]">
          {t("dashboard.today")}
        </h2>
        <div className="glass p-5 text-sm text-[color:var(--edu-text-dim)]">{t("dashboard.today.empty")}</div>
      </section>

      {/* Quick actions */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[color:var(--edu-text-dim)]">
          {t("dashboard.quickActions")}
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.key}
              href={action.soon ? "#" : action.href}
              aria-disabled={action.soon}
              className={`glass flex flex-col gap-2 p-4 transition ${
                action.soon
                  ? "cursor-not-allowed opacity-60"
                  : "hover:border-[color:var(--edu-accent)]/40 hover:bg-white/[0.06]"
              }`}
              onClick={(e) => action.soon && e.preventDefault()}
            >
              <span className="text-2xl">{action.icon}</span>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{t(action.titleKey)}</span>
                {action.soon && (
                  <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[9px] font-medium text-[color:var(--edu-text-dim)]">
                    {t("dashboard.comingSoon")}
                  </span>
                )}
              </div>
              <span className="text-xs text-[color:var(--edu-text-dim)]">{t(action.descKey)}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Timer + Stats row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Classroom Timer */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[color:var(--edu-text-dim)]">
            {t("dashboard.timer")}
          </h2>
          <ClassroomTimer />
        </section>

        {/* Session stats */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[color:var(--edu-text-dim)]">
            {t("dashboard.stats")}
          </h2>
          <SessionStats sessions={sessions ?? []} />
        </section>
      </div>

      {/* Recent lessons + Performance */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[color:var(--edu-text-dim)]">
            {t("dashboard.recentLessons")}
          </h2>
          <div className="glass p-5">
            {!sessions || sessions.length === 0 ? (
              <p className="text-sm text-[color:var(--edu-text-dim)]">{t("dashboard.recentLessons.empty")}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-[color:var(--edu-panel-border)]">
                {sessions.slice(0, 5).map((s) => (
                  <li key={s.id} className="flex items-center justify-between py-2.5 text-sm">
                    <div className="flex flex-col gap-0.5">
                      <span className="hud-mono text-xs text-[color:var(--edu-text-dim)]">
                        {new Date(s.startedAt).toLocaleString(locale)}
                      </span>
                      <span className="text-xs text-[color:var(--edu-text-dim)]">
                        {s.mode === "simulation" ? t("mode.simulation") : t("mode.real")}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="hud-mono text-sm font-bold text-[color:var(--edu-accent)]">
                        {s.endedAt ? formatDuration(s.endedAt - s.startedAt, locale) : "—"} min
                      </span>
                      <span className="text-[10px] text-[color:var(--edu-text-dim)]">
                        {s.clicks}👆 · {s.strokes}✏️ · {s.manipulations3d}🌐
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[color:var(--edu-text-dim)]">
            {t("dashboard.performance")}
          </h2>
          <div className="glass p-5 text-sm text-[color:var(--edu-text-dim)]">{t("dashboard.performance.empty")}</div>
        </section>
      </div>

      {/* System status */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-[color:var(--edu-text-dim)]">
          {t("dashboard.systemStatus")}
        </h2>
        <div className="glass grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
          <StatusItem label={t("status.camera")} value={t("status.ready")} tone="good" />
          <StatusItem label={t("status.ai")} value={t("status.local")} tone="good" />
          <StatusItem label={t("status.offline")} value={t("status.ready")} tone="good" />
          <StatusItem label={t("status.calibration")} value={t("status.notCalibrated")} tone="warn" />
        </div>
      </section>
    </div>
  );
}

function StatusItem({ label, value, tone }: { label: string; value: string; tone: "good" | "warn" }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-widest text-[color:var(--edu-text-dim)]">{label}</span>
      <span className={`text-sm font-semibold ${tone === "good" ? "text-[color:var(--edu-good)]" : "text-[color:var(--edu-warn)]"}`}>
        {value}
      </span>
    </div>
  );
}
