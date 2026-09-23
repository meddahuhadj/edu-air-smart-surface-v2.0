"use client";

import { useI18n } from "@/lib/i18n/context";
import type { DictKey } from "@/lib/i18n/dictionaries";

const ROWS: { labelKey: DictKey; valueKey: DictKey; tone: "good" | "neutral" }[] = [
  { labelKey: "privacy.camera", valueKey: "privacy.camera.value", tone: "good" },
  { labelKey: "privacy.upload", valueKey: "privacy.upload.value", tone: "good" },
  { labelKey: "privacy.cloud", valueKey: "privacy.cloud.value", tone: "good" },
  { labelKey: "privacy.studentId", valueKey: "privacy.studentId.value", tone: "good" },
  { labelKey: "privacy.dataCollection", valueKey: "privacy.dataCollection.value", tone: "good" },
  { labelKey: "privacy.storage", valueKey: "privacy.storage.value", tone: "good" },
];

export default function PrivacyPage() {
  const { t } = useI18n();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <h1 className="text-lg font-semibold">{t("privacy.title")}</h1>

      <div className="glass divide-y divide-[color:var(--edu-panel-border)]">
        {ROWS.map((row) => (
          <div key={row.labelKey} className="flex items-center justify-between gap-4 p-4">
            <span className="text-sm text-[color:var(--edu-text-dim)]">{t(row.labelKey)}</span>
            <span className="text-sm font-semibold text-[color:var(--edu-good)]">{t(row.valueKey)}</span>
          </div>
        ))}
      </div>

      <div className="glass p-5 text-sm text-[color:var(--edu-text-dim)]">{t("privacy.model.value")}</div>
    </div>
  );
}
