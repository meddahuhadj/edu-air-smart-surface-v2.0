"use client";

import { useI18n } from "@/lib/i18n/context";

export function ModeBadge({ isSimulation }: { isSimulation: boolean }) {
  const { t } = useI18n();

  if (isSimulation) {
    return (
      <span
        className="inline-flex items-center gap-2 rounded-full border border-[color:var(--edu-warn)]/40 bg-[color:var(--edu-warn)]/10 px-3 py-1 text-xs font-semibold tracking-wide text-[color:var(--edu-warn)]"
        title={t("mode.simulation.hint")}
      >
        <span className="h-2 w-2 rounded-full dot-warn pulse" aria-hidden />
        {t("mode.simulation")}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--edu-danger)]/40 bg-[color:var(--edu-danger)]/10 px-3 py-1 text-xs font-semibold tracking-wide text-[color:var(--edu-danger)]">
      <span className="h-2 w-2 rounded-full dot-danger pulse" aria-hidden />
      {t("mode.real")}
    </span>
  );
}
