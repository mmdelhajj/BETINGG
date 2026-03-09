"use client";

import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  History,
  Shield,
  Minus,
  Plus,
  ToggleLeft,
  ToggleRight,
  Zap,
  RefreshCw,
  TrendingUp,
  CircleDot,
  Target,
  Volume2,
  VolumeX,
  Info,
  Timer,
  AlertTriangle,
  Home,
} from "lucide-react";
import { cn, formatCurrency, getDefaultBet } from "@/lib/utils";
import { post } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GameStatus = "waiting" | "running" | "crashed" | "cashed_out";

interface BetSlotData {
  id: 1 | 2;
  amount: string;
  autoCashout: string;
  isActive: boolean;
  isCashedOut: boolean;
  cashoutMultiplier: number | null;
  profit: number | null;
}

interface RoundResult {
  roundId: string;
  game: string;
  betAmount: number;
  payout: number;
  profit: number;
  multiplier: number;
  result: {
    crashPoint: number;
    cashedOut: boolean;
    cashoutMultiplier: number;
  };
  fairness: {
    serverSeedHash: string;
    clientSeed: string;
    nonce: number;
  };
  newBalance: number;
}

interface HistoryEntry {
  id: string;
  crashPoint: number;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CURRENCIES = ["BTC", "ETH", "USDT", "SOL", "DOGE"];

const NEON_CYAN = "#06D6FF";
const NEON_MAGENTA = "#FF06B5";
const NEON_GREEN = "#10B981";
const NEON_RED = "#EF4444";
const NEON_YELLOW = "#FBBF24";

// ---------------------------------------------------------------------------
// Crash History Badge
// ---------------------------------------------------------------------------

function CrashBadge({ entry }: { entry: HistoryEntry }) {
  const color =
    entry.crashPoint >= 10
      ? NEON_YELLOW
      : entry.crashPoint >= 2
      ? NEON_GREEN
      : entry.crashPoint >= 1.5
      ? NEON_CYAN
      : NEON_RED;

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="flex-shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold border"
      style={{
        backgroundColor: `${color}10`,
        borderColor: `${color}40`,
        color: color,
      }}
    >
      {(entry.crashPoint ?? 0).toFixed(2)}x
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Fairness Modal
// ---------------------------------------------------------------------------

function FairnessModal({
  isOpen,
  onClose,
  fairness,
}: {
  isOpen: boolean;
  onClose: () => void;
  fairness: RoundResult["fairness"] | null;
}) {
  if (!isOpen || !fairness) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-[#161B22] border border-[#30363D] rounded-xl p-5 max-w-md w-full space-y-4"
        >
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-[#8B5CF6]" />
            <h3 className="text-base font-bold text-white">Provably Fair</h3>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-[#8B949E] block mb-1 uppercase tracking-wider">Server Seed Hash</label>
              <div className="bg-[#0D1117] border border-[#30363D] rounded-lg p-2 font-mono text-[10px] text-gray-300 break-all">
                {fairness.serverSeedHash}
              </div>
            </div>
            <div>
              <label className="text-[10px] text-[#8B949E] block mb-1 uppercase tracking-wider">Client Seed</label>
              <div className="bg-[#0D1117] border border-[#30363D] rounded-lg p-2 font-mono text-[10px] text-gray-300 break-all">
                {fairness.clientSeed}
              </div>
            </div>
            <div>
              <label className="text-[10px] text-[#8B949E] block mb-1 uppercase tracking-wider">Nonce</label>
              <div className="bg-[#0D1117] border border-[#30363D] rounded-lg p-2 font-mono text-[10px] text-gray-300">
                {fairness.nonce}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-full py-3.5 rounded-xl bg-[#C8FF00] text-black text-base font-bold hover:bg-[#d4ff33] transition-colors"
          >
            Close
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Bet Slot Component (Cloudbet mobile style)
// ---------------------------------------------------------------------------

function BetSlotPanel({
  slot,
  currency,
  balance,
  gameStatus,
  onAmountChange,
  onAutoCashoutChange,
  onBet,
  onCashout,
  isLoading,
}: {
  slot: BetSlotData;
  currency: string;
  balance: number;
  gameStatus: GameStatus;
  onAmountChange: (id: 1 | 2, val: string) => void;
  onAutoCashoutChange: (id: 1 | 2, val: string) => void;
  onBet: (id: 1 | 2) => void;
  onCashout: (id: 1 | 2) => void;
  isLoading: boolean;
}) {
  const canBet =
    gameStatus === "waiting" &&
    !slot.isActive &&
    parseFloat(slot.amount) > 0 &&
    parseFloat(slot.amount) <= balance;

  const canCashout = gameStatus === "running" && slot.isActive && !slot.isCashedOut;

  return (
    <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-3 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-[#8B949E] uppercase tracking-wider">
          Bet {slot.id}
        </span>
        {slot.isActive && (
          <span
            className={cn(
              "text-[9px] px-2 py-0.5 rounded-full font-bold",
              slot.isCashedOut
                ? "bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30"
                : "bg-[#C8FF00]/15 text-[#C8FF00] border border-[#C8FF00]/30 animate-pulse"
            )}
          >
            {slot.isCashedOut
              ? `${slot.cashoutMultiplier?.toFixed(2)}x`
              : "LIVE"}
          </span>
        )}
      </div>

      {/* Amount input */}
      <div className="relative bg-[#0D1117] border border-[#30363D] rounded-lg h-12 flex items-center">
        <span className="text-[9px] text-[#8B949E] ml-2.5">{currency}</span>
        <input
          type="number"
          value={slot.amount}
          onChange={(e) => onAmountChange(slot.id, e.target.value)}
          disabled={slot.isActive}
          className="flex-1 bg-transparent text-white font-mono text-sm text-center outline-none disabled:opacity-50"
          step="0.01"
        />
        <div className="flex items-center gap-1 mr-2">
          <button
            onClick={() => {
              const val = Math.max(0.0001, (parseFloat(slot.amount) || 0) - 0.1);
              onAmountChange(slot.id, val.toFixed(4));
            }}
            disabled={slot.isActive}
            className="bg-[#2D333B] rounded w-8 h-8 flex items-center justify-center text-[#8B949E] hover:text-white disabled:opacity-30"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              const val = (parseFloat(slot.amount) || 0) + 0.1;
              onAmountChange(slot.id, val.toFixed(4));
            }}
            disabled={slot.isActive}
            className="bg-[#2D333B] rounded w-8 h-8 flex items-center justify-center text-[#8B949E] hover:text-white disabled:opacity-30"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 1/2 and 2X buttons */}
      <div className="flex gap-1.5">
        <button
          onClick={() => {
            const val = Math.max(0.0001, (parseFloat(slot.amount) || 0) * 0.5);
            onAmountChange(slot.id, val.toFixed(4));
          }}
          disabled={slot.isActive}
          className="flex-1 bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white transition-colors disabled:opacity-30"
        >
          1/2
        </button>
        <button
          onClick={() => {
            const val = (parseFloat(slot.amount) || 0) * 2;
            onAmountChange(slot.id, val.toFixed(4));
          }}
          disabled={slot.isActive}
          className="flex-1 bg-[#21262D] border border-[#30363D] rounded-md px-2.5 py-1.5 text-xs text-[#8B949E] hover:text-white transition-colors disabled:opacity-30"
        >
          2X
        </button>
      </div>

      {/* Auto cashout */}
      <div>
        <label className="text-[9px] text-[#8B949E] block mb-1 uppercase tracking-wider">Auto Cashout</label>
        <div className="flex items-center bg-[#0D1117] border border-[#30363D] rounded-lg h-10">
          <Target className="w-3 h-3 text-[#8B949E] ml-2.5" />
          <input
            type="number"
            value={slot.autoCashout}
            onChange={(e) => onAutoCashoutChange(slot.id, e.target.value)}
            disabled={slot.isActive}
            placeholder="2.00"
            className="flex-1 text-center bg-transparent text-white font-mono text-xs py-2 outline-none disabled:opacity-50"
            step="0.1"
            min="1.01"
          />
          <span className="text-[#8B949E] text-[10px] mr-2.5">x</span>
        </div>
      </div>

      {/* Profit display when cashed out */}
      {slot.isCashedOut && slot.profit != null && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-1.5 rounded-lg bg-[#10B981]/10 border border-[#10B981]/20"
        >
          <span className="text-xs text-[#10B981] font-mono font-bold">
            +{(slot.profit ?? 0).toFixed(4)} {currency}
          </span>
        </motion.div>
      )}

      {/* Bet / Cashout button */}
      <motion.button
        whileTap={{ scale: 0.98 }}
        onClick={() => (canCashout ? onCashout(slot.id) : onBet(slot.id))}
        disabled={!canBet && !canCashout}
        className={cn(
          "w-full py-3.5 rounded-xl font-bold text-base transition-all",
          canCashout
            ? "bg-[#3D3D20] text-[#C8FF00]"
            : canBet
            ? "bg-[#C8FF00] text-black"
            : "bg-[#2D333B] text-[#8B949E] cursor-not-allowed"
        )}
      >
        {canCashout
          ? "Cash Out"
          : slot.isActive
          ? "Active..."
          : isLoading
          ? "Placing..."
          : "Place Bet"}
      </motion.button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Canvas Trenball Graph Hook
// ---------------------------------------------------------------------------

function useTrenballCanvas(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  multiplier: number,
  status: GameStatus,
  crashPoint: number | null
) {
  const animFrameRef = useRef<number>(0);
  const ballTrailRef = useRef<{ x: number; y: number; opacity: number }[]>([]);
  const particlesRef = useRef<
    { x: number; y: number; vx: number; vy: number; life: number; color: string }[]
  >([]);
  const timeRef = useRef(0);
  const isVisibleRef = useRef(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;

    // IntersectionObserver to pause animation when canvas not visible
    const visibilityObserver = new IntersectionObserver(
      ([entry]) => { isVisibleRef.current = entry.isIntersecting; },
      { threshold: 0.1 }
    );
    visibilityObserver.observe(canvas);

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const draw = () => {
      // Skip frame when not visible
      if (!isVisibleRef.current) {
        animFrameRef.current = requestAnimationFrame(draw);
        return;
      }
      const rect = canvas.getBoundingClientRect();
      const W = rect.width;
      const H = rect.height;

      ctx.clearRect(0, 0, W, H);
      timeRef.current += 0.016;

      // Background grid
      ctx.strokeStyle = "rgba(255,255,255,0.03)";
      ctx.lineWidth = 0.5;
      const gridSize = 40;
      for (let x = 0; x < W; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let y = 0; y < H; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }

      // Axes
      const padLeft = 50;
      const padBottom = 40;
      const padTop = 40;
      const padRight = 20;

      const graphW = W - padLeft - padRight;
      const graphH = H - padTop - padBottom;

      // Y axis labels
      const maxMult = Math.max(multiplier * 1.3, 2);
      const ySteps = 5;
      ctx.font = "10px monospace";
      ctx.textAlign = "right";

      for (let i = 0; i <= ySteps; i++) {
        const val = 1 + ((maxMult - 1) * i) / ySteps;
        const yPos = H - padBottom - (i / ySteps) * graphH;

        ctx.fillStyle = "rgba(255,255,255,0.2)";
        ctx.fillText(val.toFixed(1) + "x", padLeft - 8, yPos + 3);

        ctx.strokeStyle = "rgba(255,255,255,0.04)";
        ctx.beginPath();
        ctx.moveTo(padLeft, yPos);
        ctx.lineTo(W - padRight, yPos);
        ctx.stroke();
      }

      // X axis line
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padLeft, H - padBottom);
      ctx.lineTo(W - padRight, H - padBottom);
      ctx.stroke();

      // Y axis line
      ctx.beginPath();
      ctx.moveTo(padLeft, padTop);
      ctx.lineTo(padLeft, H - padBottom);
      ctx.stroke();

      if (status === "waiting") {
        const pulseSize = 6 + Math.sin(timeRef.current * 3) * 2;
        const bx = padLeft;
        const by = H - padBottom;

        const grd = ctx.createRadialGradient(bx, by, 0, bx, by, pulseSize * 3);
        grd.addColorStop(0, "#C8FF0040");
        grd.addColorStop(1, "transparent");
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(bx, by, pulseSize * 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#C8FF00";
        ctx.beginPath();
        ctx.arc(bx, by, pulseSize, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = "bold 16px sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.fillText("Waiting for bets...", W / 2, H / 2);

        animFrameRef.current = requestAnimationFrame(draw);
        return;
      }

      if (
        status === "running" ||
        status === "cashed_out" ||
        status === "crashed"
      ) {
        const displayMult =
          status === "crashed" && crashPoint ? crashPoint : multiplier;
        const timeProgress = Math.min(1, (displayMult - 1) / (maxMult - 1));

        const points: { x: number; y: number }[] = [];
        const steps = Math.floor(timeProgress * 200);

        for (let i = 0; i <= steps; i++) {
          const t = i / 200;
          const m = 1 + (maxMult - 1) * t;
          const bounceOffset = Math.sin(t * 15) * (0.005 * (1 - t));
          const normalizedY = (m - 1) / (maxMult - 1) + bounceOffset;

          const px = padLeft + t * graphW;
          const py = H - padBottom - normalizedY * graphH;
          points.push({ x: px, y: py });
        }

        if (points.length > 1) {
          ctx.lineWidth = 6;
          const lineColor = status === "crashed" ? NEON_RED : "#C8FF00";
          ctx.strokeStyle = lineColor + "20";
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
          }
          ctx.stroke();

          ctx.lineWidth = 2.5;
          const gradient = ctx.createLinearGradient(
            padLeft,
            0,
            padLeft + timeProgress * graphW,
            0
          );
          if (status === "crashed") {
            gradient.addColorStop(0, NEON_RED + "60");
            gradient.addColorStop(1, NEON_RED);
          } else {
            gradient.addColorStop(0, "#C8FF0060");
            gradient.addColorStop(0.7, "#C8FF00");
            gradient.addColorStop(1, "#C8FF00");
          }
          ctx.strokeStyle = gradient;
          ctx.beginPath();
          ctx.moveTo(points[0].x, points[0].y);
          for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
          }
          ctx.stroke();

          ctx.fillStyle =
            status === "crashed" ? NEON_RED + "08" : "#C8FF0008";
          ctx.beginPath();
          ctx.moveTo(points[0].x, H - padBottom);
          for (const p of points) {
            ctx.lineTo(p.x, p.y);
          }
          ctx.lineTo(points[points.length - 1].x, H - padBottom);
          ctx.closePath();
          ctx.fill();
        }

        const lastPoint = points[points.length - 1] || {
          x: padLeft,
          y: H - padBottom,
        };

        ballTrailRef.current.push({
          x: lastPoint.x,
          y: lastPoint.y,
          opacity: 1,
        });
        if (ballTrailRef.current.length > 20) {
          ballTrailRef.current.shift();
        }

        for (const trail of ballTrailRef.current) {
          trail.opacity *= 0.88;
          if (trail.opacity < 0.01) continue;
          const trailColor = status === "crashed" ? NEON_RED : "#C8FF00";
          const alpha = Math.floor(trail.opacity * 40)
            .toString(16)
            .padStart(2, "0");
          ctx.fillStyle = trailColor + alpha;
          ctx.beginPath();
          ctx.arc(trail.x, trail.y, 3 * trail.opacity, 0, Math.PI * 2);
          ctx.fill();
        }

        if (status !== "crashed") {
          const glowRadius = 20 + Math.sin(timeRef.current * 5) * 5;
          const ballGlow = ctx.createRadialGradient(
            lastPoint.x, lastPoint.y, 0,
            lastPoint.x, lastPoint.y, glowRadius
          );
          ballGlow.addColorStop(0, "#C8FF0050");
          ballGlow.addColorStop(0.5, "#C8FF0020");
          ballGlow.addColorStop(1, "transparent");
          ctx.fillStyle = ballGlow;
          ctx.beginPath();
          ctx.arc(lastPoint.x, lastPoint.y, glowRadius, 0, Math.PI * 2);
          ctx.fill();
        }

        const ballSize =
          status === "crashed" ? 5 : 7 + Math.sin(timeRef.current * 8) * 1;
        const ballColor = status === "crashed" ? NEON_RED : "#C8FF00";

        ctx.strokeStyle = ballColor + "80";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(lastPoint.x, lastPoint.y, ballSize + 3, 0, Math.PI * 2);
        ctx.stroke();

        const ballGrd = ctx.createRadialGradient(
          lastPoint.x - 1, lastPoint.y - 1, 0,
          lastPoint.x, lastPoint.y, ballSize
        );
        ballGrd.addColorStop(0, "#ffffff");
        ballGrd.addColorStop(0.4, ballColor);
        ballGrd.addColorStop(1, ballColor + "80");
        ctx.fillStyle = ballGrd;
        ctx.beginPath();
        ctx.arc(lastPoint.x, lastPoint.y, ballSize, 0, Math.PI * 2);
        ctx.fill();

        if (status === "crashed") {
          if (particlesRef.current.length === 0) {
            for (let i = 0; i < 30; i++) {
              const angle = (Math.PI * 2 * i) / 30 + Math.random() * 0.5;
              const speed = 1 + Math.random() * 4;
              particlesRef.current.push({
                x: lastPoint.x, y: lastPoint.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1,
                color: Math.random() > 0.5 ? NEON_RED : "#C8FF00",
              });
            }
          }

          for (const p of particlesRef.current) {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.05;
            p.life *= 0.96;
            if (p.life < 0.01) continue;

            const alpha = Math.floor(p.life * 255)
              .toString(16)
              .padStart(2, "0");
            ctx.fillStyle = p.color + alpha;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 2 * p.life, 0, Math.PI * 2);
            ctx.fill();
          }
        } else {
          particlesRef.current = [];
        }

        const multText = displayMult.toFixed(2) + "x";
        ctx.font =
          status === "crashed"
            ? "bold 48px monospace"
            : "bold 40px monospace";
        ctx.textAlign = "center";

        const textColor = status === "crashed" ? NEON_RED : "#C8FF00";
        ctx.shadowColor = textColor;
        ctx.shadowBlur = 20;
        ctx.fillStyle = textColor;
        ctx.fillText(multText, W / 2, H / 2 - 10);
        ctx.shadowBlur = 0;

        if (status === "crashed") {
          ctx.font = "bold 18px sans-serif";
          ctx.fillStyle = NEON_RED + "CC";
          ctx.fillText("BUSTED!", W / 2, H / 2 + 25);
        } else if (status === "cashed_out") {
          ctx.font = "bold 14px sans-serif";
          ctx.fillStyle = NEON_GREEN + "CC";
          ctx.fillText("CASHED OUT", W / 2, H / 2 + 25);
        }
      }

      animFrameRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      visibilityObserver.disconnect();
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [canvasRef, multiplier, status, crashPoint]);
}

// ---------------------------------------------------------------------------
// Main Trenball Page Component
// ---------------------------------------------------------------------------

export default function TrenballPage() {
  // ---- Auth / balance ----
  const { user, isAuthenticated } = useAuthStore();
  const balances = user?.balances ?? [];

  // ---- Currency ----
  const [currency, setCurrency] = useState("USDT");

  // ---- Game State ----
  const [gameStatus, setGameStatus] = useState<GameStatus>("waiting");
  const [multiplier, setMultiplier] = useState(1.0);
  const [crashPoint, setCrashPoint] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(5);
  const [lastFairness, setLastFairness] = useState<RoundResult["fairness"] | null>(null);

  // ---- Bet Slots ----
  const [betSlots, setBetSlots] = useState<BetSlotData[]>([
    { id: 1, amount: "1.00", autoCashout: "2.00", isActive: false, isCashedOut: false, cashoutMultiplier: null, profit: null },
    { id: 2, amount: "1.00", autoCashout: "5.00", isActive: false, isCashedOut: false, cashoutMultiplier: null, profit: null },
  ]);

  // ---- UI ----
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showFairness, setShowFairness] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // ---- Auto-bet ----
  const [autoBetEnabled, setAutoBetEnabled] = useState(false);
  const [autoBetSlot, setAutoBetSlot] = useState<1 | 2>(1);
  const [autoBetMaxRounds, setAutoBetMaxRounds] = useState(10);
  const [autoBetRoundsPlayed, setAutoBetRoundsPlayed] = useState(0);
  const [autoBetStopOnWin, setAutoBetStopOnWin] = useState(0);
  const [autoBetStopOnLoss, setAutoBetStopOnLoss] = useState(0);
  const [autoBetOnWin, setAutoBetOnWin] = useState<"reset" | "increase">("reset");
  const [autoBetOnLoss, setAutoBetOnLoss] = useState<"reset" | "increase">("reset");
  const [autoBetIncreaseWin, setAutoBetIncreaseWin] = useState(0);
  const [autoBetIncreaseLoss, setAutoBetIncreaseLoss] = useState(100);
  const [isAutoBetting, setIsAutoBetting] = useState(false);
  const autoBetRef = useRef(false);
  const autoBetProfitRef = useRef(0);

  // ---- Manual/Auto toggle ----
  const [betMode, setBetMode] = useState<"manual" | "auto">("manual");

  // ---- Refs ----
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const multiplierRef = useRef(1.0);
  const gameLoopRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const historyScrollRef = useRef<HTMLDivElement>(null);

  // ---- Canvas hook ----
  useTrenballCanvas(canvasRef, multiplier, gameStatus, crashPoint);

  // ---- Derived ----
  const currentBalance = useMemo(() => {
    const bal = balances.find((b) => b.currency === currency);
    return bal?.available ?? 0;
  }, [balances, currency]);

  // ---- Scroll history ----
  useEffect(() => {
    if (historyScrollRef.current) {
      historyScrollRef.current.scrollLeft = 0;
    }
  }, [history.length]);

  // ---- Cleanup ----
  useEffect(() => {
    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  // ---- Bet slot helpers ----
  const updateSlot = useCallback((id: 1 | 2, updates: Partial<BetSlotData>) => {
    setBetSlots((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...updates } : s))
    );
  }, []);

  const handleAmountChange = useCallback(
    (id: 1 | 2, val: string) => { updateSlot(id, { amount: val }); },
    [updateSlot]
  );

  const handleAutoCashoutChange = useCallback(
    (id: 1 | 2, val: string) => { updateSlot(id, { autoCashout: val }); },
    [updateSlot]
  );

  // ---- Cash out ----
  const handleCashout = useCallback(
    async (slotId: 1 | 2) => {
      const slot = betSlots.find((s) => s.id === slotId);
      if (!slot || !slot.isActive || slot.isCashedOut) return;

      try {
        const res = await post<RoundResult>("/casino/games/trenball/play", {
          amount: parseFloat(slot.amount), currency, team: "home", autoCashout: multiplierRef.current,
        });

        useAuthStore.getState().updateBalance(currency, res.newBalance, 0);
        updateSlot(slotId, { isCashedOut: true, cashoutMultiplier: res.multiplier, profit: res.profit });
        setLastFairness(res.fairness);

        const otherSlot = betSlots.find((s) => s.id !== slotId);
        if (!otherSlot?.isActive || otherSlot.isCashedOut) {
          setGameStatus("cashed_out");
        }

        if (autoBetRef.current) {
          autoBetProfitRef.current += res.profit;
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to cash out";
        setError(message);
      }
    },
    [betSlots, currency, updateSlot]
  );

  // ---- Multiplier loop ----
  const startMultiplierLoop = useCallback(
    (target: number) => {
      const startTime = Date.now();
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);

      gameLoopRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = 0.08;
        const currentMult = Math.pow(Math.E, speed * elapsed);

        multiplierRef.current = currentMult;
        setMultiplier(currentMult);

        setBetSlots((prev) =>
          prev.map((slot) => {
            if (slot.isActive && !slot.isCashedOut && slot.autoCashout && parseFloat(slot.autoCashout) > 0 && currentMult >= parseFloat(slot.autoCashout)) {
              handleCashout(slot.id);
              return slot;
            }
            return slot;
          })
        );

        if (currentMult >= target) {
          if (gameLoopRef.current) clearInterval(gameLoopRef.current);
          setMultiplier(target);
          multiplierRef.current = target;
          handleCrash(target);
        }
      }, 50);
    },
    [handleCashout]
  );

  // ---- Reset round ----
  const resetRound = useCallback(() => {
    setGameStatus("waiting");
    setMultiplier(1.0);
    multiplierRef.current = 1.0;
    setCrashPoint(null);
    setBetSlots((prev) =>
      prev.map((s) => ({ ...s, isActive: false, isCashedOut: false, cashoutMultiplier: null, profit: null }))
    );
  }, []);

  // ---- Stop auto bet ----
  const stopAutoBet = useCallback(() => {
    autoBetRef.current = false;
    setIsAutoBetting(false);
  }, []);

  // ---- Handle crash ----
  const handleCrash = useCallback(
    (point: number) => {
      setGameStatus("crashed");
      setCrashPoint(point);

      setBetSlots((prev) =>
        prev.map((slot) =>
          slot.isActive && !slot.isCashedOut
            ? { ...slot, profit: -parseFloat(slot.amount) }
            : slot
        )
      );

      setHistory((prev) =>
        [{ id: Date.now().toString() + Math.random().toString(), crashPoint: point, timestamp: Date.now() }, ...prev].slice(0, 50)
      );

      if (autoBetRef.current) {
        setAutoBetRoundsPlayed((p) => p + 1);
      }

      setTimeout(() => {
        resetRound();
        if (autoBetRef.current) {
          handleAutoBetNext();
        }
      }, 3000);
    },
    [resetRound]
  );

  // ---- Start game ----
  const startGame = useCallback(
    (targetCrashPoint: number) => {
      setCrashPoint(targetCrashPoint);
      setMultiplier(1.0);
      multiplierRef.current = 1.0;

      setCountdown(3);
      let countdownVal = 3;

      if (countdownRef.current) clearInterval(countdownRef.current);

      countdownRef.current = setInterval(() => {
        countdownVal -= 1;
        setCountdown(countdownVal);
        if (countdownVal <= 0) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          setGameStatus("running");
          startMultiplierLoop(targetCrashPoint);
        }
      }, 1000);
    },
    [startMultiplierLoop]
  );

  // ---- Place bet ----
  const handleBet = useCallback(
    async (slotId: 1 | 2) => {
      const slot = betSlots.find((s) => s.id === slotId);
      if (!slot || slot.isActive) return;

      setIsLoading(true);
      setError(null);

      try {
        const res = await post<RoundResult>("/casino/trenball/play", {
          amount: parseFloat(slot.amount), currency, team: "home", autoCashout: parseFloat(slot.autoCashout) || undefined,
        });

        useAuthStore.getState().updateBalance(currency, res.newBalance, 0);
        updateSlot(slotId, { isActive: true, isCashedOut: false, cashoutMultiplier: null, profit: null });
        setLastFairness(res.fairness);

        if (gameStatus === "waiting") {
          startGame(res.result.crashPoint);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to place bet";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [betSlots, currency, gameStatus, updateSlot, startGame]
  );

  // ---- Auto-bet next ----
  const handleAutoBetNext = useCallback(() => {
    if (!autoBetRef.current) return;

    const profit = autoBetProfitRef.current;
    const rounds = autoBetRoundsPlayed + 1;

    if (rounds >= autoBetMaxRounds) { stopAutoBet(); return; }
    if (autoBetStopOnWin > 0 && profit >= autoBetStopOnWin) { stopAutoBet(); return; }
    if (autoBetStopOnLoss > 0 && profit <= -autoBetStopOnLoss) { stopAutoBet(); return; }

    const lastProfit = betSlots.find((s) => s.id === autoBetSlot)?.profit ?? 0;
    if (lastProfit > 0 && autoBetOnWin === "increase") {
      setBetSlots((prev) =>
        prev.map((s) =>
          s.id === autoBetSlot
            ? { ...s, amount: (parseFloat(s.amount) * (1 + autoBetIncreaseWin / 100)).toFixed(4) }
            : s
        )
      );
    } else if (lastProfit <= 0 && autoBetOnLoss === "increase") {
      setBetSlots((prev) =>
        prev.map((s) =>
          s.id === autoBetSlot
            ? { ...s, amount: (parseFloat(s.amount) * (1 + autoBetIncreaseLoss / 100)).toFixed(4) }
            : s
        )
      );
    }

    setTimeout(() => {
      if (autoBetRef.current) {
        handleBet(autoBetSlot);
      }
    }, 1500);
  }, [autoBetMaxRounds, autoBetRoundsPlayed, autoBetStopOnWin, autoBetStopOnLoss, autoBetSlot, autoBetOnWin, autoBetOnLoss, autoBetIncreaseWin, autoBetIncreaseLoss, betSlots, handleBet, stopAutoBet]);

  const startAutoBet = useCallback(() => {
    autoBetRef.current = true;
    autoBetProfitRef.current = 0;
    setIsAutoBetting(true);
    setAutoBetRoundsPlayed(0);
    handleBet(autoBetSlot);
  }, [handleBet, autoBetSlot]);

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <div className="min-h-screen bg-[#0D1117] pb-20">
      {/* Game Page Header */}
      <div className="bg-[#161B22] py-2 text-center">
        <span className="text-white font-bold text-sm tracking-widest">CRYPTOBET</span>
      </div>

      {/* Canvas Graph -- edge to edge */}
      <div className="relative overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full"
          style={{ height: '45vh', background: "linear-gradient(180deg, #0D1117 0%, #0a0f18 100%)" }}
        />

        {/* Countdown overlay */}
        <AnimatePresence>
          {gameStatus === "waiting" && countdown > 0 && countdown <= 3 && (
            <motion.div
              key={countdown}
              initial={{ scale: 2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <span
                className="text-5xl font-black font-mono"
                style={{ color: "#C8FF00", textShadow: `0 0 30px #C8FF00, 0 0 60px #C8FF0040` }}
              >
                {countdown}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status indicator */}
        <div className="absolute top-2 left-2">
          <div
            className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border",
              gameStatus === "waiting"
                ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-400"
                : gameStatus === "running"
                ? "bg-[#C8FF00]/10 border-[#C8FF00]/30 text-[#C8FF00]"
                : gameStatus === "cashed_out"
                ? "bg-[#10B981]/10 border-[#10B981]/30 text-[#10B981]"
                : "bg-[#EF4444]/10 border-[#EF4444]/30 text-[#EF4444]"
            )}
          >
            <div
              className={cn(
                "w-1.5 h-1.5 rounded-full",
                gameStatus === "waiting" ? "bg-yellow-400 animate-pulse"
                : gameStatus === "running" ? "bg-[#C8FF00] animate-pulse"
                : gameStatus === "cashed_out" ? "bg-[#10B981]"
                : "bg-[#EF4444]"
              )}
            />
            {gameStatus === "waiting" ? "Waiting" : gameStatus === "running" ? "Live" : gameStatus === "cashed_out" ? "Cashed Out" : "Busted"}
          </div>
        </div>
      </div>

      <div className="px-4 space-y-3 mt-3">
        {/* History bubbles */}
        <div
          ref={historyScrollRef}
          className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1"
        >
          <span className="text-[9px] text-[#8B949E] shrink-0 uppercase tracking-wider mr-1 self-center">History</span>
          {history.length === 0 ? (
            <span className="text-[9px] text-[#30363D]">No rounds yet</span>
          ) : (
            history.map((entry) => (
              <CrashBadge key={entry.id} entry={entry} />
            ))
          )}
        </div>

        {/* Manual / Auto Toggle */}
        <div className="bg-[#0D1117] border border-[#30363D] rounded-xl overflow-hidden flex">
          <button
            onClick={() => setBetMode("manual")}
            className={cn(
              "flex-1 py-2 px-6 text-sm font-bold transition-colors",
              betMode === "manual" ? "bg-[#8B5CF6] text-white" : "text-[#8B949E]"
            )}
          >
            Manual
          </button>
          <button
            onClick={() => setBetMode("auto")}
            className={cn(
              "flex-1 py-2 px-6 text-sm font-bold transition-colors",
              betMode === "auto" ? "bg-[#8B5CF6] text-white" : "text-[#8B949E]"
            )}
          >
            Auto
          </button>
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="p-2.5 rounded-lg bg-[#EF4444]/10 border border-[#EF4444]/20 text-xs text-[#EF4444] flex items-start gap-2"
            >
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bet Slots */}
        <div className="grid grid-cols-2 gap-2">
          {betSlots.map((slot) => (
            <BetSlotPanel
              key={slot.id}
              slot={slot}
              currency={currency}
              balance={currentBalance}
              gameStatus={gameStatus}
              onAmountChange={handleAmountChange}
              onAutoCashoutChange={handleAutoCashoutChange}
              onBet={handleBet}
              onCashout={handleCashout}
              isLoading={isLoading}
            />
          ))}
        </div>

        {/* Round Stats */}
        <div className="bg-[#161B22] border border-[#30363D] rounded-xl p-3">
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="bg-[#0D1117] rounded-lg p-2">
              <div className="text-[9px] text-[#8B949E] mb-0.5">Highest</div>
              <div className="text-sm font-mono font-bold text-[#10B981]">
                {history.length > 0 ? Math.max(...history.map((h) => h.crashPoint)).toFixed(2) : "-.--"}x
              </div>
            </div>
            <div className="bg-[#0D1117] rounded-lg p-2">
              <div className="text-[9px] text-[#8B949E] mb-0.5">Average</div>
              <div className="text-sm font-mono font-bold text-[#C8FF00]">
                {history.length > 0 ? (history.reduce((a, b) => a + b.crashPoint, 0) / history.length).toFixed(2) : "-.--"}x
              </div>
            </div>
            <div className="bg-[#0D1117] rounded-lg p-2">
              <div className="text-[9px] text-[#8B949E] mb-0.5">Lowest</div>
              <div className="text-sm font-mono font-bold text-[#EF4444]">
                {history.length > 0 ? Math.min(...history.map((h) => h.crashPoint)).toFixed(2) : "-.--"}x
              </div>
            </div>
            <div className="bg-[#0D1117] rounded-lg p-2">
              <div className="text-[9px] text-[#8B949E] mb-0.5">Rounds</div>
              <div className="text-sm font-mono font-bold text-white">{history.length}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#161B22] border-t border-[#30363D] px-4 py-2 flex items-center justify-between z-50">
        <div className="flex items-center gap-3">
          <Link href="/casino">
            <Home className="w-6 h-6 text-[#8B949E]" />
          </Link>
          <button onClick={() => setShowHistory(!showHistory)}>
            <Info className="w-6 h-6 text-[#8B949E]" />
          </button>
          <button onClick={() => setSoundEnabled(!soundEnabled)}>
            {soundEnabled ? <Volume2 className="w-6 h-6 text-[#8B949E]" /> : <VolumeX className="w-6 h-6 text-[#8B949E]" />}
          </button>
        </div>
        <span className="text-sm font-mono text-white">
          {currentBalance.toFixed(4)} {currency}
        </span>
        <button
          onClick={() => setShowFairness(true)}
          className="bg-[#8B5CF6]/10 border border-[#8B5CF6]/30 rounded-full px-3 py-1 text-xs text-[#8B5CF6]"
        >
          Provably Fair Game
        </button>
      </div>

      {/* Fairness Modal */}
      <FairnessModal
        isOpen={showFairness}
        onClose={() => setShowFairness(false)}
        fairness={lastFairness}
      />
    </div>
  );
}
