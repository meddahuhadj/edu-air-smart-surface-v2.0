"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/context";

export interface AiLessonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartLesson?: (mode: "pointer" | "draw" | "3d" | "lab" | "quiz") => void;
}

export function AiLessonModal({ isOpen, onClose, onStartLesson }: AiLessonModalProps) {
  const { t } = useI18n();

  const [subject, setSubject] = useState("astronomy");
  const [topic, setTopic] = useState("");
  const [grade, setGrade] = useState("middle");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedLesson, setGeneratedLesson] = useState<{
    title: string;
    objectives: string[];
    summary: string;
    quizCount: number;
    recommendedMode: "pointer" | "draw" | "3d" | "lab" | "quiz";
  } | null>(null);

  if (!isOpen) return null;

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      const chosenTopic = topic.trim() || (subject === "astronomy" ? "Le Système Solaire" : subject === "chemistry" ? "La Molécule d'Eau & pH" : "L'ADN et la cellule");
      const recMode: "3d" | "lab" | "quiz" = subject === "astronomy" || subject === "biology" ? "3d" : "lab";

      setGeneratedLesson({
        title: chosenTopic,
        objectives: [
          `Comprendre les bases fondamentales de ${chosenTopic}`,
          "Manipuler la modélisation spatiale interactive",
          "Répondre au quiz de validation des connaissances",
        ],
        summary: `Leçon générée par l'IA EDU-AIR adaptée pour le niveau ${grade}. Elle combine observation 3D, expérimentation pratique et évaluation en direct.`,
        quizCount: 5,
        recommendedMode: recMode,
      });
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
      <div className="glass flex w-full max-w-xl flex-col gap-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[color:var(--edu-panel-border)] pb-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📖</span>
            <div>
              <h2 className="text-base font-bold text-white">{t("lessonModal.title")}</h2>
              <p className="text-xs text-[color:var(--edu-text-dim)]">{t("lessonModal.subtitle")}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>

        {!generatedLesson ? (
          /* Form Controls */
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[color:var(--edu-text-dim)]">{t("lessonModal.subject")}</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="rounded-xl border border-[color:var(--edu-panel-border)] bg-[#070d18] p-3 text-xs text-white outline-none"
              >
                <option value="astronomy">{t("scene3d.subject.astronomy")}</option>
                <option value="chemistry">{t("scene3d.subject.chemistry")}</option>
                <option value="biology">{t("scene3d.subject.biology")}</option>
                <option value="physics">{t("scene3d.subject.physics")}</option>
                <option value="math">{t("scene3d.subject.math")}</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[color:var(--edu-text-dim)]">{t("lessonModal.topic")}</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder={t("lessonModal.topicPlaceholder")}
                className="rounded-xl border border-[color:var(--edu-panel-border)] bg-white/5 p-3 text-xs text-white outline-none focus:border-[color:var(--edu-accent)]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[color:var(--edu-text-dim)]">{t("lessonModal.grade")}</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "primary", label: t("lessonModal.gradePrimary") },
                  { id: "middle", label: t("lessonModal.gradeMiddle") },
                  { id: "high", label: t("lessonModal.gradeHigh") },
                ].map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setGrade(g.id)}
                    className={`rounded-xl border p-2.5 text-xs transition ${
                      grade === g.id
                        ? "border-[color:var(--edu-accent)] bg-[color:var(--edu-accent)]/10 font-bold text-[color:var(--edu-accent)]"
                        : "border-[color:var(--edu-panel-border)] text-[color:var(--edu-text-dim)] hover:border-white/30"
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              disabled={isGenerating}
              onClick={handleGenerate}
              className="mt-2 rounded-xl bg-[color:var(--edu-accent)] py-3 text-sm font-bold text-[#04141a] transition hover:opacity-90 disabled:opacity-50"
            >
              {isGenerating ? `⚡ ${t("lessonModal.generating")}...` : `🚀 ${t("lessonModal.generateBtn")}`}
            </button>
          </div>
        ) : (
          /* Result View */
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-[color:var(--edu-good)]/30 bg-[color:var(--edu-good)]/10 p-4">
              <span className="hud-mono text-[10px] font-bold uppercase tracking-widest text-[color:var(--edu-good)]">
                ✓ {t("lessonModal.ready")}
              </span>
              <h3 className="mt-1 text-lg font-bold text-white">{generatedLesson.title}</h3>
              <p className="mt-1 text-xs text-slate-300">{generatedLesson.summary}</p>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-widest text-[color:var(--edu-text-dim)]">
                {t("lessonModal.objectives")}
              </h4>
              <ul className="mt-2 flex flex-col gap-1 text-xs text-slate-200">
                {generatedLesson.objectives.map((obj, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="text-[color:var(--edu-accent)]">•</span> {obj}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={() => setGeneratedLesson(null)}
                className="rounded-xl border border-[color:var(--edu-panel-border)] px-4 py-2.5 text-xs text-slate-300 hover:border-white/30"
              >
                ← {t("timer.reset")}
              </button>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onStartLesson) onStartLesson(generatedLesson.recommendedMode);
                }}
                className="rounded-xl bg-[color:var(--edu-accent)] px-5 py-2.5 text-xs font-bold text-[#04141a]"
              >
                ▶ {t("dashboard.quickActions.startCourse")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
