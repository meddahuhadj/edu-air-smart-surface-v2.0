"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/context";

export interface AirLabViewerProps {
  onExperiment: () => void;
}

type ExperimentType = "optics" | "pendulum" | "titration" | "circuit" | "solar";

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
  const [voltage, setVoltage] = useState(12); // Volts
  const [resistance, setResistance] = useState(100); // Ohms

  // Solar State
  const [sunAngle, setSunAngle] = useState(60); // degrees
  const [panelTilt, setPanelTilt] = useState(30); // degrees

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timeRef = useRef(0);

  // Render optics refraction
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

    ctx.strokeStyle = "rgba(148, 163, 184, 0.5)";
    ctx.beginPath();
    ctx.moveTo(cx, 40);
    ctx.lineTo(cx, height - 40);
    ctx.stroke();
    ctx.setLineDash([]);

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

      const colors = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6"];
      colors.forEach((col, i) => {
        const offset = (i - 2.5) * 0.03;
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(
          cx + Math.sin(theta2Rad + offset) * rayLength,
          cy + Math.cos(theta2Rad + offset) * rayLength
        );
        ctx.stroke();
      });
    }
    ctx.stroke();

    ctx.fillStyle = "#f8fafc";
    ctx.font = "12px monospace";
    ctx.fillText(`Medium 1 (Air): n1 = 1.0`, 20, 30);
    ctx.fillText(`Medium 2: n2 = ${n2.toFixed(2)}`, 20, cy + 30);
    ctx.fillText(`θ1 (Incident) = ${incidentAngle}°`, cx - 140, cy - 20);
    ctx.fillText(
      isTotalReflection ? `TOTAL INTERNAL REFLECTION` : `θ2 (Refracted) = ${theta2Deg}°`,
      cx + 20,
      cy + 40
    );
  }, [activeExp, incidentAngle, n2]);

  // Render Pendulum
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
      ctx.strokeStyle = "#0284c7";
      ctx.stroke();

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

  // Render Titration
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

    ctx.fillStyle = "#334155";
    ctx.fillRect(cx - 20, 190, 40, 10);

    ctx.beginPath();
    ctx.moveTo(cx - 10, 210);
    ctx.lineTo(cx - 50, 300);
    ctx.lineTo(cx + 50, 300);
    ctx.lineTo(cx + 10, 210);
    ctx.closePath();
    ctx.strokeStyle = "#cbd5e1";
    ctx.stroke();

    let ph = 1.0;
    if (baseAdded < 25) {
      const remainingMoles = (25 - baseAdded) * 0.1;
      const conc = remainingMoles / (25 + baseAdded);
      ph = -Math.log10(conc);
    } else if (baseAdded === 25) {
      ph = 7.0;
    } else {
      const excessMoles = (baseAdded - 25) * 0.1;
      const conc = excessMoles / (25 + baseAdded);
      ph = 14 + Math.log10(conc);
    }

    let liquidColor = "rgba(224, 242, 254, 0.3)";
    if (ph >= 8.2) {
      const intensity = Math.min(1.0, (ph - 8.2) / 4);
      liquidColor = `rgba(236, 72, 153, ${0.4 + intensity * 0.5})`;
    }

    ctx.fillStyle = liquidColor;
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

    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px monospace";
    ctx.fillText(`NaOH Added: ${baseAdded.toFixed(1)} mL`, 35, 82);
  }, [activeExp, baseAdded]);

  // Render Circuit (Ohm's Law)
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

    // Circuit wires loop
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 4;
    ctx.strokeRect(100, 70, 440, 200);

    // DC Battery (+) and (-)
    ctx.fillStyle = "#334155";
    ctx.fillRect(80, 140, 40, 60);
    ctx.fillStyle = "#ef4444";
    ctx.font = "bold 16px sans-serif";
    ctx.fillText("+", 95, 135);
    ctx.fillStyle = "#3b82f6";
    ctx.fillText("-", 95, 215);

    // Resistor Box
    ctx.fillStyle = "#475569";
    ctx.fillRect(280, 55, 80, 30);
    ctx.strokeStyle = "#94a3b8";
    ctx.strokeRect(280, 55, 80, 30);
    ctx.fillStyle = "#f8fafc";
    ctx.font = "11px monospace";
    ctx.fillText(`R = ${resistance} Ω`, 290, 74);

    // Light Bulb Glowing depending on Power
    const glowRadius = Math.min(60, 15 + powerWatts * 12);
    ctx.fillStyle = `rgba(253, 224, 71, ${Math.min(1.0, powerWatts * 0.6)})`;
    ctx.beginPath();
    ctx.arc(320, 270, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.arc(320, 270, 22, 0, Math.PI * 2);
    ctx.fill();

    // Multimeter Screen
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

  // Render Solar Lab
  useEffect(() => {
    if (activeExp !== "solar" || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Sun position arc
    const sunRad = (sunAngle * Math.PI) / 180;
    const sunX = width / 2 - Math.cos(sunRad) * 220;
    const sunY = height - 40 - Math.sin(sunRad) * 220;

    // Solar Rays
    ctx.strokeStyle = "rgba(253, 224, 71, 0.4)";
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sunX, sunY);
    ctx.lineTo(width / 2, height - 60);
    ctx.stroke();
    ctx.setLineDash([]);

    // Sun
    ctx.fillStyle = "#facc15";
    ctx.beginPath();
    ctx.arc(sunX, sunY, 26, 0, Math.PI * 2);
    ctx.fill();

    // Solar Panel on ground
    const tiltRad = (panelTilt * Math.PI) / 180;
    const panelLen = 140;
    const p1x = width / 2 - Math.cos(tiltRad) * (panelLen / 2);
    const p1y = height - 60 + Math.sin(tiltRad) * (panelLen / 2);
    const p2x = width / 2 + Math.cos(tiltRad) * (panelLen / 2);
    const p2y = height - 60 - Math.sin(tiltRad) * (panelLen / 2);

    ctx.strokeStyle = "#0284c7";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(p1x, p1y);
    ctx.lineTo(p2x, p2y);
    ctx.stroke();

    // Power Calculation
    const effectiveAngle = Math.max(0, Math.sin(sunRad) * Math.cos(sunRad - tiltRad));
    const irradiance = Math.round(1000 * effectiveAngle); // W/m^2
    const generatedPower = Math.round(irradiance * 0.2 * 1.5); // Watts

    // Digital Monitor
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(20, 20, 200, 80);
    ctx.strokeStyle = "#facc15";
    ctx.strokeRect(20, 20, 200, 80);

    ctx.fillStyle = "#facc15";
    ctx.font = "bold 15px monospace";
    ctx.fillText(`Irradiance: ${irradiance} W/m²`, 30, 48);
    ctx.fillText(`Power: ${generatedPower} W`, 30, 75);
  }, [activeExp, sunAngle, panelTilt]);

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
          {(["optics", "pendulum", "titration", "circuit", "solar"] as ExperimentType[]).map((exp) => (
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
                      : `☀️ ${t("lab.exp.solar")}`}
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
          <>
            <div className="flex items-center gap-3">
              <label className="text-xs text-[color:var(--edu-text-dim)]">{t("lab.optics.angle")} ({incidentAngle}°):</label>
              <input
                type="range"
                min={0}
                max={85}
                value={incidentAngle}
                onChange={(e) => setIncidentAngle(Number(e.target.value))}
                className="accent-[color:var(--edu-accent)]"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[color:var(--edu-text-dim)]">{t("lab.optics.medium2")}:</span>
              {[
                { label: t("lab.optics.water"), n: 1.33 },
                { label: t("lab.optics.glass"), n: 1.5 },
                { label: t("lab.optics.diamond"), n: 2.42 },
              ].map((m) => (
                <button
                  key={m.label}
                  type="button"
                  onClick={() => setN2(m.n)}
                  className={`rounded px-2.5 py-1 text-xs ${
                    n2 === m.n ? "bg-white/20 font-bold text-white" : "text-[color:var(--edu-text-dim)] hover:text-white"
                  }`}
                >
                  {m.label} (n={m.n})
                </button>
              ))}
            </div>
          </>
        )}

        {activeExp === "pendulum" && (
          <>
            <div className="flex items-center gap-3">
              <label className="text-xs text-[color:var(--edu-text-dim)]">{t("lab.pendulum.length")} ({length}m):</label>
              <input
                type="range"
                min={0.5}
                max={3.0}
                step={0.1}
                value={length}
                onChange={(e) => setLength(Number(e.target.value))}
                className="accent-[color:var(--edu-accent)]"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[color:var(--edu-text-dim)]">{t("lab.pendulum.gravity")}:</span>
              {[
                { label: t("lab.pendulum.earth"), g: 9.81 },
                { label: t("lab.pendulum.moon"), g: 1.62 },
                { label: t("lab.pendulum.jupiter"), g: 24.79 },
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setGravity(p.g)}
                  className={`rounded px-2.5 py-1 text-xs ${
                    gravity === p.g ? "bg-white/20 font-bold text-white" : "text-[color:var(--edu-text-dim)] hover:text-white"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </>
        )}

        {activeExp === "titration" && (
          <>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <label className="text-xs text-[color:var(--edu-text-dim)]">{t("lab.titration.addNaoh")} ({baseAdded.toFixed(1)} mL):</label>
              <input
                type="range"
                min={0}
                max={50}
                step={0.5}
                value={baseAdded}
                onChange={(e) => setBaseAdded(Number(e.target.value))}
                className="accent-[color:var(--edu-accent)] flex-1"
              />
            </div>
          </>
        )}

        {activeExp === "circuit" && (
          <>
            <div className="flex items-center gap-3">
              <label className="text-xs text-[color:var(--edu-text-dim)]">{t("lab.circuit.voltage")} ({voltage} V):</label>
              <input
                type="range"
                min={3}
                max={24}
                value={voltage}
                onChange={(e) => setVoltage(Number(e.target.value))}
                className="accent-[color:var(--edu-accent)]"
              />
            </div>
            <div className="flex items-center gap-3">
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
          </>
        )}

        {activeExp === "solar" && (
          <>
            <div className="flex items-center gap-3">
              <label className="text-xs text-[color:var(--edu-text-dim)]">{t("lab.solar.sunAngle")} ({sunAngle}°):</label>
              <input
                type="range"
                min={10}
                max={170}
                value={sunAngle}
                onChange={(e) => setSunAngle(Number(e.target.value))}
                className="accent-[color:var(--edu-accent)]"
              />
            </div>
            <div className="flex items-center gap-3">
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
          </>
        )}
      </div>
    </div>
  );
}
