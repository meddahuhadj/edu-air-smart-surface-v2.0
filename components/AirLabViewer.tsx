"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/context";

export interface AirLabViewerProps {
  onExperiment: () => void;
}

type ExperimentType = "optics" | "pendulum" | "titration" | "circuit" | "solar" | "lens" | "archimedes";

export function AirLabViewer({ onExperiment }: AirLabViewerProps) {
  const { t } = useI18n();
  const [activeExp, setActiveExp] = useState<ExperimentType>("optics");

  // Optics State
  const [incidentAngle, setIncidentAngle] = useState(45);
  const [n2, setN2] = useState(1.5);

  // Pendulum State
  const [length, setLength] = useState(1.5);
  const [gravity, setGravity] = useState(9.81);
  const [pendulumRunning, setPendulumRunning] = useState(true);

  // Titration State
  const [baseAdded, setBaseAdded] = useState(0);

  // Circuit State
  const [voltage, setVoltage] = useState(12);
  const [resistance, setResistance] = useState(100);

  // Solar State
  const [sunAngle, setSunAngle] = useState(60);
  const [panelTilt, setPanelTilt] = useState(30);

  // Lens State
  const [focalLength, setFocalLength] = useState(25); // cm
  const [objectDist, setObjectDist] = useState(50); // cm

  // Archimedes State
  const [rhoObject, setRhoObject] = useState(500); // kg/m^3 (Wood=500, Ice=917, Aluminum=2700, Iron=7870)
  const [rhoLiquid, setRhoLiquid] = useState(1000); // kg/m^3 (Water=1000, Oil=800, Mercury=13600)

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timeRef = useRef(0);

  // Optics refraction
  useEffect(() => {
    if (activeExp !== "optics" || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    const cx = width / 2;
    const cy = height / 2;

    ctx.fillStyle = "rgba(15, 23, 42, 0.8)";
    ctx.fillRect(0, 0, width, cy);
    ctx.fillStyle = n2 > 2 ? "rgba(56, 189, 248, 0.25)" : n2 > 1.4 ? "rgba(99, 102, 241, 0.2)" : "rgba(14, 165, 233, 0.15)";
    ctx.fillRect(0, cy, width, height - cy);

    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, cy);
    ctx.lineTo(width, cy);
    ctx.stroke();

    const n1 = 1.0;
    const theta1Rad = (incidentAngle * Math.PI) / 180;
    const sinTheta2 = (n1 / n2) * Math.sin(theta1Rad);
    const isTotalReflection = sinTheta2 > 1.0;
    const theta2Rad = isTotalReflection ? theta1Rad : Math.asin(sinTheta2);
    const theta2Deg = ((theta2Rad * 180) / Math.PI).toFixed(1);

    const rayLength = 160;
    const rx1 = cx - Math.sin(theta1Rad) * rayLength;
    const ry1 = cy - Math.cos(theta1Rad) * rayLength;

    ctx.lineWidth = 3;
    ctx.strokeStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(rx1, ry1);
    ctx.lineTo(cx, cy);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    if (isTotalReflection) {
      const rx2 = cx + Math.sin(theta1Rad) * rayLength;
      const ry2 = cy - Math.cos(theta1Rad) * rayLength;
      ctx.strokeStyle = "#f43f5e";
      ctx.lineTo(rx2, ry2);
    } else {
      const rx2 = cx + Math.sin(theta2Rad) * rayLength;
      const ry2 = cy + Math.cos(theta2Rad) * rayLength;
      ctx.strokeStyle = "#38bdf8";
      ctx.lineTo(rx2, ry2);
    }
    ctx.stroke();

    ctx.fillStyle = "#f8fafc";
    ctx.font = "12px monospace";
    ctx.fillText(`Medium 1 (Air): n1 = 1.0`, 20, 30);
    ctx.fillText(`Medium 2: n2 = ${n2.toFixed(2)}`, 20, cy + 30);
    ctx.fillText(`θ1 (Incident) = ${incidentAngle}°`, cx - 140, cy - 20);
    ctx.fillText(isTotalReflection ? `TOTAL REFLECTION` : `θ2 (Refracted) = ${theta2Deg}°`, cx + 20, cy + 40);
  }, [activeExp, incidentAngle, n2]);

  // Pendulum
  useEffect(() => {
    if (activeExp !== "pendulum" || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const period = 2 * Math.PI * Math.sqrt(length / gravity);

    const render = () => {
      if (pendulumRunning) timeRef.current += 0.02;
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const pivotX = width / 2;
      const pivotY = 60;
      const maxAngle = 0.5;
      const angle = maxAngle * Math.cos((2 * Math.PI * timeRef.current) / period);
      const pixelLength = length * 80;
      const bobX = pivotX + pixelLength * Math.sin(angle);
      const bobY = pivotY + pixelLength * Math.cos(angle);

      ctx.fillStyle = "#475569";
      ctx.fillRect(pivotX - 60, pivotY - 10, 120, 10);
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pivotX, pivotY);
      ctx.lineTo(bobX, bobY);
      ctx.stroke();

      ctx.fillStyle = "#38bdf8";
      ctx.beginPath();
      ctx.arc(bobX, bobY, 18, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#f8fafc";
      ctx.font = "12px monospace";
      ctx.fillText(`Length L = ${length.toFixed(1)} m`, 20, 30);
      ctx.fillText(`Gravity g = ${gravity.toFixed(2)} m/s²`, 20, 50);
      ctx.fillText(`Period T = 2π√(L/g) = ${period.toFixed(2)} s`, 20, 70);

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [activeExp, length, gravity, pendulumRunning]);

  // Titration
  useEffect(() => {
    if (activeExp !== "titration" || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    const cx = width / 2;

    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 3;
    ctx.strokeRect(cx - 15, 30, 30, 160);

    const baseHeight = 150 * (1 - baseAdded / 50);
    ctx.fillStyle = "rgba(148, 163, 184, 0.4)";
    ctx.fillRect(cx - 13, 35 + (150 - baseHeight), 26, baseHeight);

    let ph = 1.0;
    if (baseAdded < 25) {
      const remainingMoles = (25 - baseAdded) * 0.1;
      ph = -Math.log10(remainingMoles / (25 + baseAdded));
    } else if (baseAdded === 25) {
      ph = 7.0;
    } else {
      const excessMoles = (baseAdded - 25) * 0.1;
      ph = 14 + Math.log10(excessMoles / (25 + baseAdded));
    }

    ctx.fillStyle = ph >= 8.2 ? "rgba(236, 72, 153, 0.7)" : "rgba(224, 242, 254, 0.3)";
    ctx.beginPath();
    ctx.moveTo(cx - 20, 250);
    ctx.lineTo(cx - 45, 295);
    ctx.lineTo(cx + 45, 295);
    ctx.lineTo(cx + 20, 250);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#0f172a";
    ctx.fillRect(20, 30, 160, 80);
    ctx.strokeStyle = "#38bdf8";
    ctx.strokeRect(20, 30, 160, 80);
    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 18px monospace";
    ctx.fillText(`pH: ${ph.toFixed(2)}`, 35, 60);
    ctx.font = "11px monospace";
    ctx.fillText(`NaOH: ${baseAdded.toFixed(1)} mL`, 35, 82);
  }, [activeExp, baseAdded]);

  // Circuit
  useEffect(() => {
    if (activeExp !== "circuit" || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const currentAmps = voltage / resistance;
    const powerWatts = voltage * currentAmps;

    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 4;
    ctx.strokeRect(100, 70, 440, 200);

    ctx.fillStyle = "#334155";
    ctx.fillRect(80, 140, 40, 60);

    ctx.fillStyle = `rgba(253, 224, 71, ${Math.min(1.0, powerWatts * 0.6)})`;
    ctx.beginPath();
    ctx.arc(320, 270, Math.min(60, 15 + powerWatts * 12), 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#0f172a";
    ctx.fillRect(440, 30, 180, 90);
    ctx.strokeStyle = "#22c55e";
    ctx.strokeRect(440, 30, 180, 90);
    ctx.fillStyle = "#22c55e";
    ctx.font = "bold 16px monospace";
    ctx.fillText(`V = ${voltage.toFixed(1)} V`, 455, 56);
    ctx.fillText(`I = ${currentAmps.toFixed(3)} A`, 455, 80);
    ctx.fillText(`P = ${powerWatts.toFixed(2)} W`, 455, 104);
  }, [activeExp, voltage, resistance]);

  // Solar
  useEffect(() => {
    if (activeExp !== "solar" || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const sunRad = (sunAngle * Math.PI) / 180;
    const sunX = width / 2 - Math.cos(sunRad) * 220;
    const sunY = height - 40 - Math.sin(sunRad) * 220;

    ctx.fillStyle = "#facc15";
    ctx.beginPath();
    ctx.arc(sunX, sunY, 26, 0, Math.PI * 2);
    ctx.fill();

    const tiltRad = (panelTilt * Math.PI) / 180;
    const effectiveAngle = Math.max(0, Math.sin(sunRad) * Math.cos(sunRad - tiltRad));
    const irradiance = Math.round(1000 * effectiveAngle);

    ctx.fillStyle = "#0f172a";
    ctx.fillRect(20, 20, 200, 80);
    ctx.strokeStyle = "#facc15";
    ctx.strokeRect(20, 20, 200, 80);
    ctx.fillStyle = "#facc15";
    ctx.font = "bold 15px monospace";
    ctx.fillText(`Irradiance: ${irradiance} W/m²`, 30, 48);
    ctx.fillText(`Power: ${Math.round(irradiance * 0.3)} W`, 30, 75);
  }, [activeExp, sunAngle, panelTilt]);

  // Thin Lens Lab
  useEffect(() => {
    if (activeExp !== "lens" || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;

    // Optical Axis
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(20, cy);
    ctx.lineTo(width - 20, cy);
    ctx.stroke();

    // Convex Lens
    ctx.fillStyle = "rgba(56, 189, 248, 0.25)";
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 18, 120, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Focal Points F and F'
    const fPx = focalLength * 3;
    ctx.fillStyle = "#ef4444";
    ctx.beginPath(); ctx.arc(cx - fPx, cy, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + fPx, cy, 5, 0, Math.PI * 2); ctx.fill();

    // Object Arrow
    const objPx = objectDist * 3;
    const objH = 60;
    const objX = cx - objPx;
    ctx.strokeStyle = "#22c55e";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(objX, cy);
    ctx.lineTo(objX, cy - objH);
    ctx.stroke();

    // Image Calculation (1/f = 1/p + 1/p')
    const imgDist = (focalLength * objectDist) / (objectDist - focalLength);
    const mag = -imgDist / objectDist;
    const imgH = objH * mag;
    const imgX = cx + imgDist * 3;

    if (objectDist > focalLength) {
      // Real inverted image
      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(imgX, cy);
      ctx.lineTo(imgX, cy - imgH);
      ctx.stroke();
    }

    // Telemetry
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(20, 20, 240, 85);
    ctx.strokeStyle = "#38bdf8";
    ctx.strokeRect(20, 20, 240, 85);
    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 13px monospace";
    ctx.fillText(`Focal f = ${focalLength} cm`, 30, 42);
    ctx.fillText(`Object p = ${objectDist} cm`, 30, 62);
    ctx.fillText(`Image p' = ${imgDist.toFixed(1)} cm`, 30, 82);
  }, [activeExp, focalLength, objectDist]);

  // Archimedes Buoyancy Lab
  useEffect(() => {
    if (activeExp !== "archimedes" || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const cx = width / 2;

    // Tank Liquid
    const liquidTop = 100;
    ctx.fillStyle = rhoLiquid > 5000 ? "#94a3b8" : rhoLiquid > 950 ? "rgba(14, 165, 233, 0.4)" : "rgba(245, 158, 11, 0.4)";
    ctx.fillRect(cx - 120, liquidTop, 240, 200);
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 3;
    ctx.strokeRect(cx - 120, liquidTop, 240, 200);

    // Floating/Sinking Position
    const ratio = rhoObject / rhoLiquid;
    const submergedPct = Math.min(1.0, ratio);
    const blockH = 60;
    const blockY = liquidTop + submergedPct * 120 - blockH / 2;

    // Submerged Block
    ctx.fillStyle = rhoObject < 700 ? "#b45309" : rhoObject < 1000 ? "#e0f2fe" : "#475569";
    ctx.fillRect(cx - 35, blockY, 70, blockH);
    ctx.strokeStyle = "#ffffff";
    ctx.strokeRect(cx - 35, blockY, 70, blockH);

    // Forces Arrows (Weight vs Buoyant Force)
    const weightForce = (rhoObject * 9.81 * 0.001).toFixed(1);
    const buoyantForce = (Math.min(rhoObject, rhoLiquid) * 9.81 * 0.001).toFixed(1);

    ctx.fillStyle = "#0f172a";
    ctx.fillRect(20, 20, 220, 80);
    ctx.strokeStyle = "#38bdf8";
    ctx.strokeRect(20, 20, 220, 80);
    ctx.fillStyle = "#38bdf8";
    ctx.font = "bold 13px monospace";
    ctx.fillText(`Object ρ: ${rhoObject} kg/m³`, 30, 42);
    ctx.fillText(`Liquid ρ: ${rhoLiquid} kg/m³`, 30, 62);
    ctx.fillText(`State: ${ratio < 1.0 ? `FLOAT (${Math.round(ratio * 100)}%)` : "SINK"}`, 30, 82);
  }, [activeExp, rhoObject, rhoLiquid]);

  return (
    <div className="flex flex-col gap-4 glass p-6">
      {/* Header & Experiment Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[color:var(--edu-accent)] flex items-center gap-2">
            🔬 {t("lab.title")}
          </h2>
          <p className="text-xs text-[color:var(--edu-text-dim)]">{t("lab.subtitle")}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {(["optics", "pendulum", "titration", "circuit", "solar", "lens", "archimedes"] as ExperimentType[]).map((exp) => (
            <button
              key={exp}
              type="button"
              onClick={() => {
                setActiveExp(exp);
                onExperiment();
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeExp === exp
                  ? "bg-[color:var(--edu-accent)] text-[#04141a]"
                  : "border border-[color:var(--edu-panel-border)] text-[color:var(--edu-text-dim)] hover:border-white/40"
              }`}
            >
              {exp === "optics"
                ? `📐 ${t("lab.exp.optics")}`
                : exp === "pendulum"
                  ? `⏱ ${t("lab.exp.pendulum")}`
                  : exp === "titration"
                    ? `🧪 ${t("lab.exp.titration")}`
                    : exp === "circuit"
                      ? `⚡ ${t("lab.exp.circuit")}`
                      : exp === "solar"
                        ? `☀️ ${t("lab.exp.solar")}`
                        : exp === "lens"
                          ? `🔍 ${t("lab.exp.lens")}`
                          : `⚓ ${t("lab.exp.archimedes")}`}
            </button>
          ))}
        </div>
      </div>

      {/* Main Canvas Viewport */}
      <div className="relative flex justify-center overflow-hidden rounded-xl border border-[color:var(--edu-panel-border)] bg-[#070d18]">
        <canvas ref={canvasRef} width={640} height={340} className="w-full max-w-[640px] h-[340px]" />
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[color:var(--edu-panel-border)] p-4 bg-white/[0.02]">
        {activeExp === "optics" && (
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-xs text-[color:var(--edu-text-dim)]">{t("lab.optics.angle")} ({incidentAngle}°):</label>
              <button
                type="button"
                onClick={() => setIncidentAngle((a) => Math.max(0, a - 5))}
                className="h-7 w-7 rounded bg-white/10 font-bold text-xs hover:bg-white/20"
              >
                -
              </button>
              <input type="range" min={0} max={85} value={incidentAngle} onChange={(e) => setIncidentAngle(Number(e.target.value))} className="accent-[color:var(--edu-accent)]" />
              <button
                type="button"
                onClick={() => setIncidentAngle((a) => Math.min(85, a + 5))}
                className="h-7 w-7 rounded bg-white/10 font-bold text-xs hover:bg-white/20"
              >
                +
              </button>
            </div>
            <div className="flex items-center gap-1.5 border-l border-[color:var(--edu-panel-border)] pl-3">
              <span className="text-xs text-[color:var(--edu-text-dim)]">Milieu 2 :</span>
              {[
                { label: t("lab.optics.water"), n: 1.33 },
                { label: t("lab.optics.glass"), n: 1.5 },
                { label: t("lab.optics.diamond"), n: 2.42 },
              ].map((m) => (
                <button
                  key={m.n}
                  type="button"
                  onClick={() => setN2(m.n)}
                  className={`rounded px-2.5 py-1 text-xs font-semibold ${
                    n2 === m.n ? "bg-[color:var(--edu-accent)] text-black" : "bg-white/5 text-slate-300 hover:bg-white/10"
                  }`}
                >
                  {m.label} (n={m.n})
                </button>
              ))}
            </div>
          </div>
        )}

        {activeExp === "pendulum" && (
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-xs text-[color:var(--edu-text-dim)]">{t("lab.pendulum.length")} ({length.toFixed(1)} m):</label>
              <input
                type="range"
                min={0.5}
                max={2.5}
                step={0.1}
                value={length}
                onChange={(e) => setLength(Number(e.target.value))}
                className="accent-[color:var(--edu-accent)]"
              />
            </div>
            <div className="flex items-center gap-1.5 border-l border-[color:var(--edu-panel-border)] pl-3">
              <span className="text-xs text-[color:var(--edu-text-dim)]">Planète :</span>
              {[
                { label: t("lab.pendulum.earth"), g: 9.81 },
                { label: t("lab.pendulum.moon"), g: 1.62 },
                { label: t("lab.pendulum.jupiter"), g: 24.79 },
              ].map((p) => (
                <button
                  key={p.g}
                  type="button"
                  onClick={() => setGravity(p.g)}
                  className={`rounded px-2.5 py-1 text-xs font-semibold ${
                    gravity === p.g ? "bg-[color:var(--edu-accent)] text-black" : "bg-white/5 text-slate-300 hover:bg-white/10"
                  }`}
                >
                  {p.label} ({p.g})
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setPendulumRunning(!pendulumRunning)}
              className="ml-auto rounded-lg border border-[color:var(--edu-panel-border)] px-3 py-1 text-xs font-bold text-white hover:bg-white/10"
            >
              {pendulumRunning ? "⏸ Pause" : "▶ Animer"}
            </button>
          </div>
        )}

        {activeExp === "titration" && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-[color:var(--edu-text-dim)]">Burette NaOH (0.1M) :</span>
            <button
              type="button"
              onClick={() => setBaseAdded((v) => Math.min(50, v + 1))}
              className="rounded-lg bg-pink-500/20 border border-pink-500/40 px-3 py-1.5 text-xs font-bold text-pink-300 hover:bg-pink-500/30"
            >
              + 1.0 mL NaOH
            </button>
            <button
              type="button"
              onClick={() => setBaseAdded((v) => Math.min(50, v + 5))}
              className="rounded-lg bg-pink-500/20 border border-pink-500/40 px-3 py-1.5 text-xs font-bold text-pink-300 hover:bg-pink-500/30"
            >
              + 5.0 mL NaOH
            </button>
            <button
              type="button"
              onClick={() => setBaseAdded(0)}
              className="rounded-lg border border-[color:var(--edu-panel-border)] px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10"
            >
              🔄 Rincer le bécher
            </button>
          </div>
        )}

        {activeExp === "circuit" && (
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-xs text-[color:var(--edu-text-dim)]">{t("lab.circuit.voltage")} ({voltage} V):</label>
              <input
                type="range"
                min={1}
                max={24}
                value={voltage}
                onChange={(e) => setVoltage(Number(e.target.value))}
                className="accent-[color:var(--edu-accent)]"
              />
            </div>
            <div className="flex items-center gap-2 border-l border-[color:var(--edu-panel-border)] pl-3">
              <label className="text-xs text-[color:var(--edu-text-dim)]">{t("lab.circuit.resistance")} ({resistance} Ω):</label>
              <input
                type="range"
                min={10}
                max={500}
                step={10}
                value={resistance}
                onChange={(e) => setResistance(Number(e.target.value))}
                className="accent-[color:var(--edu-accent)]"
              />
            </div>
          </div>
        )}

        {activeExp === "solar" && (
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-xs text-[color:var(--edu-text-dim)]">{t("lab.solar.sunAngle")} ({sunAngle}°):</label>
              <input
                type="range"
                min={10}
                max={90}
                value={sunAngle}
                onChange={(e) => setSunAngle(Number(e.target.value))}
                className="accent-[color:var(--edu-accent)]"
              />
            </div>
            <div className="flex items-center gap-2 border-l border-[color:var(--edu-panel-border)] pl-3">
              <label className="text-xs text-[color:var(--edu-text-dim)]">{t("lab.solar.tilt")} ({panelTilt}°):</label>
              <input
                type="range"
                min={0}
                max={90}
                value={panelTilt}
                onChange={(e) => setPanelTilt(Number(e.target.value))}
                className="accent-[color:var(--edu-accent)]"
              />
            </div>
            <button
              type="button"
              onClick={() => setPanelTilt(90 - sunAngle)}
              className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-3 py-1 text-xs font-bold text-yellow-300 hover:bg-yellow-500/20"
            >
              ☀️ Inclinaison Optimale ({90 - sunAngle}°)
            </button>
          </div>
        )}

        {activeExp === "lens" && (
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-xs text-[color:var(--edu-text-dim)]">Focale f ({focalLength} cm):</label>
              <input type="range" min={10} max={40} value={focalLength} onChange={(e) => setFocalLength(Number(e.target.value))} className="accent-[color:var(--edu-accent)]" />
            </div>
            <div className="flex items-center gap-2 border-l border-[color:var(--edu-panel-border)] pl-3">
              <label className="text-xs text-[color:var(--edu-text-dim)]">Distance objet p ({objectDist} cm):</label>
              <input type="range" min={15} max={80} value={objectDist} onChange={(e) => setObjectDist(Number(e.target.value))} className="accent-[color:var(--edu-accent)]" />
            </div>
          </div>
        )}

        {activeExp === "archimedes" && (
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[color:var(--edu-text-dim)]">Matière objet:</span>
              {[
                { label: "Bois", rho: 500 },
                { label: "Glace", rho: 917 },
                { label: "Aluminium", rho: 2700 },
                { label: "Fer", rho: 7870 },
              ].map((m) => (
                <button
                  key={m.label}
                  type="button"
                  onClick={() => setRhoObject(m.rho)}
                  className={`rounded px-2.5 py-1 text-xs font-semibold ${rhoObject === m.rho ? "bg-[color:var(--edu-accent)] text-black" : "bg-white/5 text-[color:var(--edu-text-dim)] hover:bg-white/10"}`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 border-l border-[color:var(--edu-panel-border)] pl-3">
              <span className="text-xs text-[color:var(--edu-text-dim)]">Liquide:</span>
              {[
                { label: "Eau", rho: 1000 },
                { label: "Huile", rho: 800 },
                { label: "Mercure", rho: 13600 },
              ].map((l) => (
                <button
                  key={l.label}
                  type="button"
                  onClick={() => setRhoLiquid(l.rho)}
                  className={`rounded px-2.5 py-1 text-xs font-semibold ${rhoLiquid === l.rho ? "bg-[color:var(--edu-accent)] text-black" : "bg-white/5 text-[color:var(--edu-text-dim)] hover:bg-white/10"}`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
