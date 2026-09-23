"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/context";

export interface AiTeacherPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Message {
  id: string;
  sender: "user" | "ai";
  text: string;
}

export function AiTeacherPanel({ isOpen, onClose }: AiTeacherPanelProps) {
  const { t, locale } = useI18n();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      sender: "ai",
      text: t("teacher.welcome"),
    },
  ]);
  const [input, setInput] = useState("");
  const [isSpeaking, setIsSpeaking] = useState<string | null>(null);

  if (!isOpen) return null;

  const speakText = (id: string, text: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();

    if (isSpeaking === id) {
      setIsSpeaking(null);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = locale === "ar" ? "ar-SA" : locale === "en" ? "en-US" : "fr-FR";
    utterance.onend = () => setIsSpeaking(null);
    utterance.onerror = () => setIsSpeaking(null);

    setIsSpeaking(id);
    window.speechSynthesis.speak(utterance);
  };

  const handleSend = () => {
    if (!input.trim()) return;

    const userMsg: Message = { id: Date.now().toString(), sender: "user", text: input };
    setMessages((prev) => [...prev, userMsg]);
    const prompt = input;
    setInput("");

    setTimeout(() => {
      let reply = t("teacher.defaultReply");
      const lower = prompt.toLowerCase();
      if (lower.includes("sol") || lower.includes("planète") || lower.includes("sun")) {
        reply = t("teacher.replySolar");
      } else if (lower.includes("eau") || lower.includes("water") || lower.includes("molecule")) {
        reply = t("teacher.replyWater");
      } else if (lower.includes("quiz") || lower.includes("test")) {
        reply = t("teacher.replyQuiz");
      }

      const aiMsgId = (Date.now() + 1).toString();
      setMessages((prev) => [...prev, { id: aiMsgId, sender: "ai", text: reply }]);
      speakText(aiMsgId, reply);
    }, 600);
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-[color:var(--edu-panel-border)] bg-[#070d18]/95 p-4 shadow-2xl backdrop-blur-xl">
      {/* Panel Header */}
      <div className="flex items-center justify-between border-b border-[color:var(--edu-panel-border)] pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">🤖</span>
          <div>
            <h3 className="text-sm font-bold text-white">{t("teacher.title")}</h3>
            <span className="text-[10px] text-[color:var(--edu-accent)] font-mono">AI COPILOT VOICE ONLINE</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            if ("speechSynthesis" in window) window.speechSynthesis.cancel();
            onClose();
          }}
          className="rounded-lg p-1 text-[color:var(--edu-text-dim)] hover:bg-white/10 hover:text-white"
        >
          ✕
        </button>
      </div>

      {/* Suggested Quick Prompts */}
      <div className="flex flex-wrap gap-1.5 py-3 border-b border-[color:var(--edu-panel-border)]">
        {[
          t("teacher.prompt1"),
          t("teacher.prompt2"),
          t("teacher.prompt3"),
        ].map((promptText) => (
          <button
            key={promptText}
            type="button"
            onClick={() => {
              setInput(promptText);
            }}
            className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-[color:var(--edu-text-dim)] transition hover:border-[color:var(--edu-accent)]/50 hover:text-white"
          >
            {promptText}
          </button>
        ))}
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-3">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex max-w-[85%] flex-col rounded-2xl px-4 py-2.5 text-xs ${
              m.sender === "user"
                ? "self-end bg-[color:var(--edu-accent)] text-[#04141a] font-medium"
                : "self-start border border-[color:var(--edu-panel-border)] bg-white/[0.05] text-slate-200"
            }`}
          >
            <p>{m.text}</p>
            {m.sender === "ai" && (
              <button
                type="button"
                onClick={() => speakText(m.id, m.text)}
                className="mt-1.5 self-start text-[10px] font-bold text-[color:var(--edu-accent)] hover:underline flex items-center gap-1"
              >
                {isSpeaking === m.id ? "⏸ Stop Audio" : "🔊 Listen"}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Input Area */}
      <div className="flex gap-2 pt-2 border-t border-[color:var(--edu-panel-border)]">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder={t("teacher.placeholder")}
          className="flex-1 rounded-xl border border-[color:var(--edu-panel-border)] bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-[color:var(--edu-accent)]"
        />
        <button
          type="button"
          onClick={handleSend}
          className="rounded-xl bg-[color:var(--edu-accent)] px-4 py-2 text-xs font-bold text-[#04141a]"
        >
          {t("teacher.send")}
        </button>
      </div>
    </div>
  );
}
