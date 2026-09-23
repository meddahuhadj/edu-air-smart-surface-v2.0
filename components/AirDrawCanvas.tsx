"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import type { GestureFrame } from "@/lib/vision/gestureEngine";
import { useDemoMode } from "@/hooks/useDemoMode";
import { PointerFilter2D } from "@/lib/vision/pointerFilter";
import { applyHomography, type Homography } from "@/lib/vision/calibration";

export type BoardTool =
  | "pen"
  | "highlighter"
  | "line"
  | "arrow"
  | "rectangle"
  | "circle"
  | "erase"
  | "laser";

export type BoardBackground = "whiteboard" | "blackboard" | "grid" | "lines";

interface Stroke {
  tool: BoardTool;
  points: { x: number; y: number }[]; // normalized [0,1], resolution-independent
  color: string;
  thickness: number; // normalized to canvas width
  erase: boolean;
}

const COLORS = [
  "#0f172a", // Dark / Black
  "#ffffff", // White / Chalk
  "#2563eb", // Blue
  "#06b6d4", // Cyan
  "#16a34a", // Green
  "#f59e0b", // Yellow / Amber
  "#ef4444", // Red
  "#a855f7", // Purple
];

const THICKNESSES = [0.003, 0.007, 0.014];

export interface AirDrawCanvasProps {
  isSimulation: boolean;
  realFrame: GestureFrame;
  homography: Homography | null;
  onStroke: () => void;
}

export function AirDrawCanvas({ isSimulation, realFrame, homography, onStroke }: AirDrawCanvasProps) {
  const { t } = useI18n();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const filterRef = useRef(new PointerFilter2D({ minCutoff: 1.0, beta: 0.02, deadZone: 0.002 }));

  const demoFrame = useDemoMode(containerRef, isSimulation);
  const frame = isSimulation ? demoFrame : realFrame;

  // Multi-page state
  const pagesRef = useRef<Stroke[][]>([[]]);
  const redoPagesRef = useRef<Stroke[][]>([[]]);
  const pageIndexRef = useRef(0);

  const [pageIndex, setPageIndex] = useState(0);
  const [pageCount, setPageCount] = useState(1);

  const currentStrokeRef = useRef<Stroke | null>(null);
  const wasPinchingRef = useRef(false);
  const laserPosRef = useRef<{ x: number; y: number } | null>(null);

  const [tool, setTool] = useState<BoardTool>("pen");
  const [background, setBackground] = useState<BoardBackground>("whiteboard");
  const [color, setColor] = useState(COLORS[0]);
  const [showRuler, setShowRuler] = useState(false);
  const [showProtractor, setShowProtractor] = useState(false);
  const [thickness, setThickness] = useState(THICKNESSES[1]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [palettePosition, setPalettePosition] = useState<"top" | "left" | "right">("top");
  const [explainToast, setExplainToast] = useState(false);
  const [, forceRender] = useState(0);

  // Auto adjust default color when switching to dark blackboard
  useEffect(() => {
    if (background === "blackboard" && color === COLORS[0]) {
      setColor(COLORS[1]); // switch to white chalk
    } else if (background !== "blackboard" && color === COLORS[1]) {
      setColor(COLORS[0]); // switch to dark ink
    }
  }, [background, color]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.floor(rect.width * dpr) || canvas.height !== Math.floor(rect.height * dpr)) {
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const w = rect.width;
    const h = rect.height;

    // 1. Draw Background
    if (background === "blackboard") {
      ctx.fillStyle = "#172326";
      ctx.fillRect(0, 0, w, h);
    } else if (background === "grid") {
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 1;
      const step = 28;
      ctx.beginPath();
      for (let x = 0; x < w; x += step) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
      }
      for (let y = 0; y < h; y += step) {
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
      }
      ctx.stroke();
    } else if (background === "lines") {
      ctx.fillStyle = "#fcfaf7";
      ctx.fillRect(0, 0, w, h);
      // Left vertical margin line
      ctx.strokeStyle = "#fca5a5";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(50, 0);
      ctx.lineTo(50, h);
      ctx.stroke();
      // Horizontal ruled lines
      ctx.strokeStyle = "#cbd5e1";
      ctx.lineWidth = 1;
      ctx.beginPath();
      const lineStep = 32;
      for (let y = 48; y < h; y += lineStep) {
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
      }
      ctx.stroke();
    } else {
      // Whiteboard
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
    }

    // 2. Offscreen stroke canvas for clean erasing without erasing the background
    if (!strokeCanvasRef.current) strokeCanvasRef.current = document.createElement("canvas");
    const strokeCanvas = strokeCanvasRef.current;
    if (strokeCanvas.width !== canvas.width || strokeCanvas.height !== canvas.height) {
      strokeCanvas.width = canvas.width;
      strokeCanvas.height = canvas.height;
    }
    const sCtx = strokeCanvas.getContext("2d");
    if (!sCtx) return;
    sCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    sCtx.clearRect(0, 0, w, h);

    const currentPageStrokes = pagesRef.current[pageIndexRef.current] || [];
    const allStrokes = currentStrokeRef.current
      ? [...currentPageStrokes, currentStrokeRef.current]
      : currentPageStrokes;

    for (const stroke of allStrokes) {
      if (stroke.points.length === 0) continue;
      sCtx.lineCap = "round";
      sCtx.lineJoin = "round";
      sCtx.strokeStyle = stroke.color;

      const p0 = stroke.points[0];
      const pN = stroke.points[stroke.points.length - 1];

      if (stroke.erase) {
        sCtx.globalCompositeOperation = "destination-out";
        sCtx.lineWidth = stroke.thickness * w * 3.5;
        sCtx.beginPath();
        sCtx.moveTo(p0.x * w, p0.y * h);
        for (const p of stroke.points.slice(1)) sCtx.lineTo(p.x * w, p.y * h);
        sCtx.stroke();
        sCtx.globalCompositeOperation = "source-over";
      } else if (stroke.tool === "highlighter") {
        sCtx.save();
        sCtx.globalAlpha = 0.35;
        sCtx.lineWidth = stroke.thickness * w * 3.0;
        sCtx.lineCap = "square";
        sCtx.beginPath();
        sCtx.moveTo(p0.x * w, p0.y * h);
        for (const p of stroke.points.slice(1)) sCtx.lineTo(p.x * w, p.y * h);
        sCtx.stroke();
        sCtx.restore();
      } else if (stroke.tool === "line") {
        sCtx.lineWidth = stroke.thickness * w;
        sCtx.beginPath();
        sCtx.moveTo(p0.x * w, p0.y * h);
        sCtx.lineTo(pN.x * w, pN.y * h);
        sCtx.stroke();
      } else if (stroke.tool === "arrow") {
        sCtx.lineWidth = stroke.thickness * w;
        const x1 = p0.x * w;
        const y1 = p0.y * h;
        const x2 = pN.x * w;
        const y2 = pN.y * h;
        sCtx.beginPath();
        sCtx.moveTo(x1, y1);
        sCtx.lineTo(x2, y2);
        sCtx.stroke();

        const headLen = Math.max(14, stroke.thickness * w * 3.5);
        const angle = Math.atan2(y2 - y1, x2 - x1);
        sCtx.fillStyle = stroke.color;
        sCtx.beginPath();
        sCtx.moveTo(x2, y2);
        sCtx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
        sCtx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
        sCtx.closePath();
        sCtx.fill();
      } else if (stroke.tool === "rectangle") {
        sCtx.lineWidth = stroke.thickness * w;
        const rx = Math.min(p0.x, pN.x) * w;
        const ry = Math.min(p0.y, pN.y) * h;
        const rw = Math.abs(pN.x - p0.x) * w;
        const rh = Math.abs(pN.y - p0.y) * h;
        sCtx.beginPath();
        sCtx.strokeRect(rx, ry, rw, rh);
      } else if (stroke.tool === "circle") {
        sCtx.lineWidth = stroke.thickness * w;
        const cx = ((p0.x + pN.x) / 2) * w;
        const cy = ((p0.y + pN.y) / 2) * h;
        const radX = (Math.abs(pN.x - p0.x) / 2) * w;
        const radY = (Math.abs(pN.y - p0.y) / 2) * h;
        sCtx.beginPath();
        sCtx.ellipse(cx, cy, Math.max(1, radX), Math.max(1, radY), 0, 0, 2 * Math.PI);
        sCtx.stroke();
      } else {
        // Normal pen freehand
        sCtx.lineWidth = stroke.thickness * w;
        sCtx.beginPath();
        sCtx.moveTo(p0.x * w, p0.y * h);
        for (const p of stroke.points.slice(1)) sCtx.lineTo(p.x * w, p.y * h);
        sCtx.stroke();
      }
    }

    // 3. Composite strokes on main canvas
    ctx.drawImage(strokeCanvas, 0, 0, w, h);

    // 4. Render Laser pointer if active
    if (tool === "laser" && laserPosRef.current) {
      const lx = laserPosRef.current.x * w;
      const ly = laserPosRef.current.y * h;
      ctx.save();
      ctx.shadowColor = "#ff2255";
      ctx.shadowBlur = 18;
      ctx.fillStyle = "#ff2255";
      ctx.beginPath();
      ctx.arc(lx, ly, 8, 0, 2 * Math.PI);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(lx, ly, 3, 0, 2 * Math.PI);
      ctx.fill();
      ctx.restore();
    }

    // 5. Render Ruler Overlay if enabled
    if (showRuler) {
      ctx.save();
      ctx.fillStyle = "rgba(15, 23, 42, 0.45)";
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 2;
      const rx = w * 0.15;
      const ry = h * 0.45;
      const rw = w * 0.7;
      const rh = 50;
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeRect(rx, ry, rw, rh);

      ctx.fillStyle = "#38bdf8";
      ctx.font = "10px monospace";
      const numMarks = 30;
      for (let i = 0; i <= numMarks; i++) {
        const mx = rx + (rw / numMarks) * i;
        const isMajor = i % 5 === 0;
        const tickH = isMajor ? 16 : 8;
        ctx.beginPath();
        ctx.moveTo(mx, ry);
        ctx.lineTo(mx, ry + tickH);
        ctx.stroke();
        if (isMajor) ctx.fillText(`${i}`, mx - 4, ry + 32);
      }
      ctx.restore();
    }

    // 6. Render Protractor Overlay if enabled
    if (showProtractor) {
      ctx.save();
      const pcx = w / 2;
      const pcy = h * 0.7;
      const pr = Math.min(w, h) * 0.35;

      ctx.fillStyle = "rgba(15, 23, 42, 0.45)";
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pcx, pcy, pr, Math.PI, 0, false);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.font = "9px monospace";
      ctx.fillStyle = "#38bdf8";
      for (let deg = 0; deg <= 180; deg += 10) {
        const rad = (deg * Math.PI) / 180;
        const tx1 = pcx - Math.cos(rad) * pr;
        const ty1 = pcy - Math.sin(rad) * pr;
        const tx2 = pcx - Math.cos(rad) * (pr - (deg % 30 === 0 ? 14 : 8));
        const ty2 = pcy - Math.sin(rad) * (pr - (deg % 30 === 0 ? 14 : 8));
        ctx.beginPath();
        ctx.moveTo(tx1, ty1);
        ctx.lineTo(tx2, ty2);
        ctx.stroke();
        if (deg % 30 === 0) {
          ctx.fillText(`${deg}°`, tx2 - 8, ty2 + 4);
        }
      }
      ctx.restore();
    }
  }, [background, tool, showRuler, showProtractor]);

  useEffect(() => {
    redraw();
    const onResize = () => redraw();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [redraw]);

  // Main interaction loop
  useEffect(() => {
    if (!frame.cursor) {
      laserPosRef.current = null;
      redraw();
      return;
    }
    const oriented = isSimulation ? frame.cursor : { x: 1 - frame.cursor.x, y: frame.cursor.y };
    const mapped = homography ? applyHomography(homography, oriented) : oriented;
    const filtered = filterRef.current.apply(mapped.x, mapped.y, performance.now());
    const point = { x: Math.min(1, Math.max(0, filtered.x)), y: Math.min(1, Math.max(0, filtered.y)) };

    laserPosRef.current = point;

    if (tool === "laser") {
      redraw();
      return;
    }

    const isErase = tool === "erase";

    if (frame.pinchActive) {
      if (!wasPinchingRef.current) {
        currentStrokeRef.current = {
          tool,
          points: [point],
          color,
          thickness,
          erase: isErase,
        };
      } else if (currentStrokeRef.current) {
        currentStrokeRef.current.points.push(point);
      }
    } else if (wasPinchingRef.current && currentStrokeRef.current) {
      if (currentStrokeRef.current.points.length >= 2) {
        const pageIdx = pageIndexRef.current;
        if (!pagesRef.current[pageIdx]) pagesRef.current[pageIdx] = [];
        pagesRef.current[pageIdx].push(currentStrokeRef.current);
        if (!redoPagesRef.current[pageIdx]) redoPagesRef.current[pageIdx] = [];
        redoPagesRef.current[pageIdx] = [];
        onStroke();
      }
      currentStrokeRef.current = null;
    }
    wasPinchingRef.current = frame.pinchActive;
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame.cursor, frame.pinchActive, homography, tool, color, thickness, isSimulation]);

  // Page management actions
  const addPage = () => {
    pagesRef.current.push([]);
    redoPagesRef.current.push([]);
    pageIndexRef.current = pagesRef.current.length - 1;
    setPageIndex(pageIndexRef.current);
    setPageCount(pagesRef.current.length);
    redraw();
  };

  const prevPage = () => {
    if (pageIndexRef.current > 0) {
      pageIndexRef.current -= 1;
      setPageIndex(pageIndexRef.current);
      redraw();
    }
  };

  const nextPage = () => {
    if (pageIndexRef.current < pagesRef.current.length - 1) {
      pageIndexRef.current += 1;
      setPageIndex(pageIndexRef.current);
      redraw();
    }
  };

  const undo = () => {
    const pageIdx = pageIndexRef.current;
    const cur = pagesRef.current[pageIdx];
    if (cur && cur.length > 0) {
      const last = cur.pop();
      if (last) {
        if (!redoPagesRef.current[pageIdx]) redoPagesRef.current[pageIdx] = [];
        redoPagesRef.current[pageIdx].push(last);
      }
      redraw();
      forceRender((n) => n + 1);
    }
  };

  const redo = () => {
    const pageIdx = pageIndexRef.current;
    const redoCur = redoPagesRef.current[pageIdx];
    if (redoCur && redoCur.length > 0) {
      const last = redoCur.pop();
      if (last) {
        if (!pagesRef.current[pageIdx]) pagesRef.current[pageIdx] = [];
        pagesRef.current[pageIdx].push(last);
      }
      redraw();
      forceRender((n) => n + 1);
    }
  };

  const clearAll = () => {
    const pageIdx = pageIndexRef.current;
    pagesRef.current[pageIdx] = [];
    redoPagesRef.current[pageIdx] = [];
    redraw();
    forceRender((n) => n + 1);
  };

  const exportPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.download = `tni-edu-air-page-${pageIndex + 1}.png`;
    a.href = canvas.toDataURL("image/png");
    a.click();
  };

  const toggleFullscreen = () => {
    if (!wrapperRef.current) return;
    if (!document.fullscreenElement) {
      void wrapperRef.current.requestFullscreen();
    } else {
      void document.exitFullscreen();
    }
  };

  const isLateral = palettePosition === "left" || palettePosition === "right";

  return (
    <div
      ref={wrapperRef}
      className={`flex gap-3 rounded-2xl transition-all ${
        isLateral ? (palettePosition === "left" ? "flex-col lg:flex-row" : "flex-col lg:flex-row-reverse") : "flex-col"
      } ${isFullscreen ? "h-screen w-screen bg-[#071318] p-4 text-white" : ""}`}
    >
      {/* Toolbars Container (lateral sidebar or top rows) */}
      <div className={isLateral ? "flex flex-col gap-3 w-full lg:w-72 shrink-0 overflow-y-auto" : "flex flex-col gap-3 w-full"}>
        {/* TNI Primary Toolbar */}
        <div className={`glass flex ${isLateral ? "flex-col items-stretch" : "flex-wrap items-center justify-between"} gap-3 p-3`}>
          {/* Tools */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: "pen", label: t("draw.tool.pen"), icon: "✏️" },
                { id: "highlighter", label: t("draw.tool.highlighter"), icon: "🖍️" },
                { id: "line", label: t("draw.tool.line"), icon: "📏" },
                { id: "arrow", label: t("draw.tool.arrow"), icon: "➡️" },
                { id: "rectangle", label: t("draw.tool.rectangle"), icon: "⬜" },
                { id: "circle", label: t("draw.tool.circle"), icon: "⭕" },
                { id: "erase", label: t("draw.erase"), icon: "🧹" },
                { id: "laser", label: t("draw.tool.laser"), icon: "🔴" },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTool(item.id)}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                  tool === item.id
                    ? "bg-[color:var(--edu-accent)] text-[#04141a] shadow-sm"
                    : "border border-[color:var(--edu-panel-border)] text-[color:var(--edu-text-dim)] hover:border-white/30"
                }`}
                title={item.label}
              >
                <span>{item.icon}</span>
                <span className={isLateral ? "inline" : "hidden sm:inline"}>{item.label}</span>
              </button>
            ))}
          </div>

          {/* Board Background Selector */}
          <div className={`flex items-center gap-1.5 ${isLateral ? "border-t pt-2" : "border-l pl-2"} border-[color:var(--edu-panel-border)]`}>
            {(
              [
                { id: "whiteboard", label: t("draw.bg.white"), icon: "⬜" },
                { id: "blackboard", label: t("draw.bg.black"), icon: "⬛" },
                { id: "grid", label: t("draw.bg.grid"), icon: "📐" },
                { id: "lines", label: t("draw.bg.lines"), icon: "📝" },
              ] as const
            ).map((bg) => (
              <button
                key={bg.id}
                type="button"
                onClick={() => setBackground(bg.id)}
                className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition ${
                  background === bg.id
                    ? "border border-[color:var(--edu-accent)] text-[color:var(--edu-accent)] bg-[color:var(--edu-accent)]/10"
                    : "border border-transparent text-[color:var(--edu-text-dim)] hover:border-[color:var(--edu-panel-border)]"
                }`}
                title={bg.label}
              >
                <span>{bg.icon}</span>
                <span className="hidden md:inline">{bg.label}</span>
              </button>
            ))}
          </div>

          {/* Math & Measurement Tools */}
          <div className={`flex items-center flex-wrap gap-1.5 ${isLateral ? "border-t pt-2" : "border-l pl-2"} border-[color:var(--edu-panel-border)]`}>
            <button
              type="button"
              onClick={() => setShowRuler(!showRuler)}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                showRuler
                  ? "border border-[color:var(--edu-accent)] text-[color:var(--edu-accent)] bg-[color:var(--edu-accent)]/10"
                  : "border border-[color:var(--edu-panel-border)] text-[color:var(--edu-text-dim)] hover:border-white/40"
              }`}
              title="Règle graduée"
            >
              <span>📏</span>
              <span className={isLateral ? "inline" : "hidden md:inline"}>Règle</span>
            </button>
            <button
              type="button"
              onClick={() => setShowProtractor(!showProtractor)}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                showProtractor
                  ? "border border-[color:var(--edu-accent)] text-[color:var(--edu-accent)] bg-[color:var(--edu-accent)]/10"
                  : "border border-[color:var(--edu-panel-border)] text-[color:var(--edu-text-dim)] hover:border-white/40"
              }`}
              title="Rapporteur 180°"
            >
              <span>📐</span>
              <span className={isLateral ? "inline" : "hidden md:inline"}>Rapporteur</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const points: { x: number; y: number }[] = [];
                for (let i = 0; i <= 100; i++) {
                  const nx = i / 100;
                  const x = (nx - 0.5) * 4 * Math.PI;
                  const ny = 0.5 - Math.sin(x) * 0.25;
                  points.push({ x: nx, y: ny });
                }
                const newStroke: Stroke = { tool: "pen", points, color, thickness, erase: false };
                const pages = [...pagesRef.current];
                pages[pageIndexRef.current] = [...pages[pageIndexRef.current], newStroke];
                pagesRef.current = pages;
                onStroke();
                redraw();
              }}
              className="flex items-center gap-1 rounded-lg border border-purple-500/40 bg-purple-500/10 px-2.5 py-1.5 text-xs font-semibold text-purple-300 transition hover:bg-purple-500/20"
              title="Tracer sin(x)"
            >
              <span>📈</span>
              <span className={isLateral ? "inline" : "hidden md:inline"}>sin(x)</span>
            </button>
          </div>

          {/* Fullscreen & Export & TNI Dock */}
          <div className={`flex items-center justify-between gap-2 ${isLateral ? "border-t pt-2" : "border-l pl-2"} border-[color:var(--edu-panel-border)]`}>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={exportPng}
                className="flex items-center gap-1 rounded-lg border border-[color:var(--edu-good)]/40 bg-[color:var(--edu-good)]/10 px-2.5 py-1.5 text-xs font-semibold text-[color:var(--edu-good)] transition hover:bg-[color:var(--edu-good)]/20"
                title={t("draw.export")}
              >
                <span>💾</span>
                <span className="hidden sm:inline">{t("draw.export")}</span>
              </button>
              <button
                type="button"
                onClick={toggleFullscreen}
                className="flex items-center gap-1 rounded-lg border border-[color:var(--edu-panel-border)] px-2.5 py-1.5 text-xs font-semibold text-[color:var(--edu-text-dim)] transition hover:border-white/40"
                title={t("draw.fullscreen")}
              >
                <span>{isFullscreen ? "🗗" : "⛶"}</span>
                <span className="hidden sm:inline">{t("draw.fullscreen")}</span>
              </button>
            </div>

            {/* TNI Lateral Dock Toggle */}
            <div className="flex items-center gap-1 border-l border-[color:var(--edu-panel-border)] pl-2">
              <span className="text-[10px] text-slate-400 font-bold uppercase hidden lg:inline">TNI:</span>
              <button
                type="button"
                onClick={() => setPalettePosition("left")}
                className={`rounded px-1.5 py-1 text-xs font-bold ${
                  palettePosition === "left" ? "bg-[color:var(--edu-accent)] text-black" : "bg-white/5 text-slate-300"
                }`}
                title="Ancrer la palette à gauche (idéal enseignant droitier face aux élèves)"
              >
                ◀ G
              </button>
              <button
                type="button"
                onClick={() => setPalettePosition("top")}
                className={`rounded px-1.5 py-1 text-xs font-bold ${
                  palettePosition === "top" ? "bg-[color:var(--edu-accent)] text-black" : "bg-white/5 text-slate-300"
                }`}
                title="Ancrer la palette en haut"
              >
                ▲ H
              </button>
              <button
                type="button"
                onClick={() => setPalettePosition("right")}
                className={`rounded px-1.5 py-1 text-xs font-bold ${
                  palettePosition === "right" ? "bg-[color:var(--edu-accent)] text-black" : "bg-white/5 text-slate-300"
                }`}
                title="Ancrer la palette à droite (idéal enseignant gaucher)"
              >
                D ▶
              </button>
            </div>
          </div>
        </div>

        {/* Secondary Toolbar (Colors, Thickness, Undo/Redo, Pages) */}
        <div className={`glass flex ${isLateral ? "flex-col items-stretch" : "flex-wrap items-center justify-between"} gap-3 p-2.5`}>
          {/* Colors */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-[color:var(--edu-text-dim)]">{t("draw.color")}</span>
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setColor(c);
                  if (tool === "erase" || tool === "laser") setTool("pen");
                }}
                className="h-6 w-6 rounded-full border-2 transition hover:scale-110"
                style={{
                  backgroundColor: c,
                  borderColor: color === c && tool !== "erase" && tool !== "laser" ? "var(--edu-accent)" : "rgba(255,255,255,0.2)",
                }}
              />
            ))}
          </div>

          {/* Thickness */}
          <div className={`flex items-center gap-1.5 ${isLateral ? "border-t pt-2" : "border-l pl-2"} border-[color:var(--edu-panel-border)]`}>
            <span className="text-xs text-[color:var(--edu-text-dim)]">{t("draw.thickness")}</span>
            {THICKNESSES.map((th) => (
              <button
                key={th}
                type="button"
                onClick={() => setThickness(th)}
                className={`flex h-6 w-6 items-center justify-center rounded border transition ${
                  thickness === th
                    ? "border-[color:var(--edu-accent)] bg-[color:var(--edu-accent)]/10 text-[color:var(--edu-accent)]"
                    : "border-[color:var(--edu-panel-border)] text-[color:var(--edu-text-dim)]"
                }`}
              >
                <div
                  className="rounded-full bg-current"
                  style={{ width: Math.max(3, th * 1.5), height: Math.max(3, th * 1.5) }}
                />
              </button>
            ))}
          </div>

          {/* Page Navigation */}
          <div className={`flex items-center gap-1.5 ${isLateral ? "border-t pt-2" : "border-l pl-2"} border-[color:var(--edu-panel-border)]`}>
            <button
              type="button"
              onClick={prevPage}
              disabled={pageIndex === 0}
              className="rounded border border-[color:var(--edu-panel-border)] px-2 py-0.5 text-xs text-[color:var(--edu-text-dim)] disabled:opacity-40"
              title={t("draw.page.prev")}
            >
              ◀
            </button>
            <span className="hud-mono text-xs text-[color:var(--edu-text-dim)]">
              {t("draw.page")} {pageIndex + 1}/{pageCount}
            </span>
            <button
              type="button"
              onClick={nextPage}
              disabled={pageIndex === pageCount - 1}
              className="rounded border border-[color:var(--edu-panel-border)] px-2 py-0.5 text-xs text-[color:var(--edu-text-dim)] disabled:opacity-40"
              title={t("draw.page.next")}
            >
              ▶
            </button>
            <button
              type="button"
              onClick={addPage}
              className="ml-1 rounded bg-[color:var(--edu-accent)]/15 px-2 py-0.5 text-xs font-bold text-[color:var(--edu-accent)] hover:bg-[color:var(--edu-accent)]/30"
              title={t("draw.page.new")}
            >
              +
            </button>
          </div>

          {/* History actions */}
          <div className={`flex items-center gap-1.5 flex-wrap ${isLateral ? "border-t pt-2" : ""}`}>
            <button
              type="button"
              onClick={undo}
              className="rounded-md border border-[color:var(--edu-panel-border)] px-2 py-1 text-xs text-[color:var(--edu-text-dim)] transition hover:border-white/30"
            >
              ↩ {t("draw.undo")}
            </button>
            <button
              type="button"
              onClick={redo}
              className="rounded-md border border-[color:var(--edu-panel-border)] px-2 py-1 text-xs text-[color:var(--edu-text-dim)] transition hover:border-white/30"
            >
              ↪ {t("draw.redo")}
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="rounded-md border border-[color:var(--edu-danger)]/50 px-2 py-1 text-xs font-semibold text-[color:var(--edu-danger)] transition hover:bg-[color:var(--edu-danger)]/10"
            >
              🗑️ {t("draw.clear")}
            </button>
            <button
              type="button"
              onClick={() => {
                setExplainToast(true);
                window.setTimeout(() => setExplainToast(false), 2600);
              }}
              className="rounded-md border border-[color:var(--edu-accent-2)]/40 px-2 py-1 text-xs font-medium text-[color:var(--edu-accent-2)]"
            >
              💡 {t("draw.explain")}
            </button>
          </div>
        </div>

        {explainToast && (
          <div className="glass px-3 py-2 text-xs text-[color:var(--edu-text-dim)]">{t("draw.explain.soon")}</div>
        )}
      </div>

      {/* Main Board Container */}
      <div
        ref={containerRef}
        className={`glass relative w-full overflow-hidden rounded-xl border border-[color:var(--edu-panel-border)] shadow-2xl ${
          isFullscreen
            ? isLateral
              ? "h-[calc(100vh-32px)] flex-1"
              : "h-[calc(100vh-170px)]"
            : isLateral
              ? "min-h-[580px] flex-1"
              : "h-[540px]"
        }`}
      >
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full cursor-crosshair" />

        {/* Feedback indicator */}
        {frame.pinchActive && tool !== "laser" && (
          <div className="pointer-events-none absolute right-4 top-4 rounded-full bg-[color:var(--edu-good)]/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[color:var(--edu-good)] shadow-lg backdrop-blur">
            {t("gesture.pinch")} · {tool}
          </div>
        )}
      </div>
    </div>
  );
}
