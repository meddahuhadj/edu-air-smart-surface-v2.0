"use client";

import { useI18n } from "@/lib/i18n/context";

export function CameraErrorPanel({ onRetry, onUseSimulation }: { onRetry: () => void; onUseSimulation: () => void }) {
  const { t } = useI18n();

  return (
    <div className="glass flex flex-col gap-3 border-[color:var(--edu-danger)]/30 p-6">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full dot-danger" aria-hidden />
        <h3 className="text-base font-semibold text-[color:var(--edu-danger)]">{t("error.camera.title")}</h3>
      </div>
      <p className="text-sm text-[color:var(--edu-text-dim)]">{t("error.camera.cause")}</p>
      <div className="flex flex-wrap gap-3 pt-1">
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg bg-[color:var(--edu-accent)] px-4 py-2 text-sm font-semibold text-[#04141a] transition hover:opacity-90"
        >
          {t("error.camera.retry")}
        </button>
        <button
          type="button"
          onClick={onUseSimulation}
          className="rounded-lg border border-[color:var(--edu-panel-border)] px-4 py-2 text-sm font-semibold text-[color:var(--edu-text)] transition hover:bg-white/5"
        >
          {t("error.camera.useMouse")}
        </button>
      </div>
    </div>
  );
}
