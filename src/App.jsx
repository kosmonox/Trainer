import { useState, useEffect, useRef, useCallback } from "react";
import {
  Heart, Play, Trash2, X, Zap, AlertTriangle, Plus, Minus,
  Bluetooth, Dumbbell, Timer, BarChart3, Settings2, Star,
  Clock, Layers, TrendingUp, RotateCcw,
} from "lucide-react";
import { loadStored, saveStored } from "./storage.js";
import { scanAndConnectHrMonitor, disconnectHrMonitor } from "./ble.js";
import { warningPulse, transitionPulse, minutePulse, prBeatPulse, setHapticsEnabled } from "./haptics.js";

const COLORS = {
  bg: "#030f18",
  bgCard: "#0a1f2e",
  bgCardHi: "#0e2a3d",
  cyan: "#7fd8ff",
  cyanBright: "#a8e8ff",
  green: "#7fe8a8",
  greenBright: "#b0f5cb",
  red: "#ff7676",
  orange: "#f4b13f",
  white: "#eaf9ff",
  dim: "#4a7488",
};

const DISPLAY_FONT = "'Oswald', system-ui, sans-serif";
const BODY_FONT = "'Inter', system-ui, sans-serif";

const PRESETS = [
  { id: "preset-co2-gentle", name: "CO2 gentle", tableType: "CO2", baseHold: 90, baseBreathe: 120, step: 10, rounds: 6 },
  { id: "preset-co2-classic", name: "CO2 classic", tableType: "CO2", baseHold: 120, baseBreathe: 120, step: 15, rounds: 8 },
  { id: "preset-co2-advanced", name: "CO2 advanced", tableType: "CO2", baseHold: 150, baseBreathe: 90, step: 15, rounds: 8 },
  { id: "preset-o2-classic", name: "O2 classic", tableType: "O2", baseHold: 60, baseBreathe: 120, step: 20, rounds: 8 },
  { id: "preset-o2-advanced", name: "O2 advanced", tableType: "O2", baseHold: 90, baseBreathe: 150, step: 20, rounds: 8 },
];

const DIFFICULTIES = {
  easy: { label: "Easy", emoji: "\u{1F343}", breatheMul: 1.35, holdMul: 0.70, color: COLORS.green },
  normal: { label: "Normal", emoji: "\u26A1", breatheMul: 1, holdMul: 1, color: COLORS.cyan },
  hard: { label: "Hard", emoji: "\u{1F525}", breatheMul: 0.75, holdMul: 1.30, color: COLORS.red },
};

function formatTime(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec < 10 ? "0" : ""}${sec}`;
}
function todayKey() { return new Date().toISOString().slice(0, 10); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function computeRoundPreview(table) {
  let breathe = table.baseBreathe, hold = table.baseHold;
  const rounds = [];
  for (let i = 0; i < table.rounds; i++) {
    rounds.push({ hold, breathe });
    if (table.tableType === "CO2") breathe = Math.max(15, breathe - table.step);
    else hold = hold + table.step;
  }
  return rounds;
}
function tableStats(table) {
  const rounds = computeRoundPreview(table);
  const totalSeconds = rounds.reduce((s, r) => s + r.hold + r.breathe, 0);
  const maxHold = rounds[rounds.length - 1].hold;
  return { rounds, totalSeconds, maxHold };
}

// ---------------------------------------------------------------------------
// Visual components
// ---------------------------------------------------------------------------

function Bubbles({ count = 16 }) {
  const bubbles = useRef(
    Array.from({ length: count }).map(() => ({
      left: 3 + Math.random() * 94, size: 4 + Math.random() * 12,
      delay: Math.random() * 10, duration: 9 + Math.random() * 9,
      opacity: 0.12 + Math.random() * 0.26, sway: 10 + Math.random() * 18,
      swayDur: 3 + Math.random() * 3,
    }))
  ).current;
  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
      {bubbles.map((b, i) => (
        <div key={i} style={{ position: "absolute", left: `${b.left}%`, bottom: -20, animation: `floatUp ${b.duration}s linear ${b.delay}s infinite` }}>
          <div style={{
            width: b.size, height: b.size, borderRadius: "50%", background: COLORS.cyanBright, opacity: 0, "--op": b.opacity,
            boxShadow: `0 0 ${b.size}px rgba(168,232,255,${b.opacity * 0.9})`,
            animation: `floatUp ${b.duration}s linear ${b.delay}s infinite, sway ${b.swayDur}s ease-in-out infinite`, "--sway": b.sway,
          }} />
        </div>
      ))}
    </div>
  );
}

function BubbleBurst({ burstTrigger }) {
  const [particles, setParticles] = useState([]);
  useEffect(() => {
    if (!burstTrigger) return;
    const n = 24;
    const arr = Array.from({ length: n }).map(() => {
      const angle = Math.random() * 360;
      const dist = 60 + Math.random() * 90;
      return { id: uid(), angle, dist, size: 3 + Math.random() * 7, delay: Math.random() * 0.15 };
    });
    setParticles(arr);
    const t = setTimeout(() => setParticles([]), 1100);
    return () => clearTimeout(t);
  }, [burstTrigger]);
  if (particles.length === 0) return null;
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 5 }}>
      {particles.map((p) => {
        const rad = (p.angle * Math.PI) / 180;
        const dx = Math.cos(rad) * p.dist, dy = Math.sin(rad) * p.dist;
        return (
          <div key={p.id} style={{
            position: "absolute", top: "50%", left: "50%", width: p.size, height: p.size, borderRadius: "50%",
            background: COLORS.cyanBright, boxShadow: "0 0 6px rgba(168,232,255,0.9)",
            animation: `burstOut 1s ease-out ${p.delay}s forwards`, "--dx": `${dx}px`, "--dy": `${dy}px`,
          }} />
        );
      })}
    </div>
  );
}

function RippleRings({ trigger, color }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!trigger) return;
    setShow(true);
    const t = setTimeout(() => setShow(false), 1400);
    return () => clearTimeout(t);
  }, [trigger]);
  if (!show) return null;
  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 2 }}>
      {[0, 0.25, 0.5].map((delay, i) => (
        <div key={i} style={{ position: "absolute", border: `2px solid ${color}`, borderRadius: "50%", animation: `ringExpand 1s ease-out ${delay}s forwards` }} />
      ))}
    </div>
  );
}

function ProgressRing({ fraction, color, size = 232, stroke = 10 }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.max(0, Math.min(1, fraction)));
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(127,216,255,0.12)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={offset} style={{ transition: "stroke-dashoffset 0.4s linear" }} />
    </svg>
  );
}

function HrGauge({ hr, min, max, bleStatus, bleConnected, onConnect, onDisconnect, manualHr, setManualHr }) {
  const pct = (v) => Math.max(0, Math.min(100, (v / 200) * 100));
  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Heart size={18} color={COLORS.red} fill={COLORS.red} />
        <div style={{ position: "relative", flex: 1, height: 10, borderRadius: 6,
          background: "linear-gradient(to right, #4fc3f7 0%, #7fe8a8 18%, #f4d03f 55%, #ff7676 100%)" }}>
          {min > 0 && <div style={{ position: "absolute", left: `${pct(min)}%`, top: -9, transform: "translateX(-50%)", color: COLORS.cyan, fontSize: 12 }}>&#9650;</div>}
          {max > 0 && <div style={{ position: "absolute", left: `${pct(max)}%`, bottom: -9, transform: "translateX(-50%)", color: COLORS.red, fontSize: 12 }}>&#9660;</div>}
          {hr > 0 && <div style={{ position: "absolute", left: `${pct(hr)}%`, top: "50%", transform: "translate(-50%,-50%)", width: 16, height: 16, borderRadius: "50%", background: COLORS.white, border: `2px solid ${COLORS.bg}` }} />}
        </div>
      </div>
      <div style={{ textAlign: "center", marginTop: 6, color: COLORS.red, fontWeight: 700, fontSize: 15, fontFamily: DISPLAY_FONT, letterSpacing: 1 }}>
        {hr > 0 ? `${hr} BPM` : "-- BPM"}
      </div>
      <div style={{ display: "flex", justifyContent: "center", marginTop: 10 }}>
        {bleConnected ? (
          <button onClick={onDisconnect} style={{ ...pillBtnStyle, borderColor: "rgba(255,118,118,0.4)", color: COLORS.red, display: "flex", alignItems: "center", gap: 6 }}><Bluetooth size={14} /> Disconnect watch</button>
        ) : (
          <button onClick={onConnect} style={{ ...pillBtnStyle, display: "flex", alignItems: "center", gap: 6 }}><Bluetooth size={14} /> Connect watch via Bluetooth</button>
        )}
      </div>
      {bleStatus && <div style={{ textAlign: "center", fontSize: 12, color: COLORS.dim, marginTop: 6 }}>{bleStatus}</div>}
      {!bleConnected && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 11, color: COLORS.dim, textAlign: "center", marginBottom: 4, letterSpacing: 1 }}>OR DRAG TO LOG MANUALLY</div>
          <input type="range" min={0} max={200} value={manualHr} onChange={(e) => setManualHr(Number(e.target.value))} style={{ width: "100%", accentColor: COLORS.cyan }} />
        </div>
      )}
    </div>
  );
}

function ScreenHeader({ title }) {
  return <div style={{ textAlign: "center", padding: "44px 20px 18px" }}>
    <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.white, letterSpacing: 2, fontFamily: DISPLAY_FONT, textTransform: "uppercase" }}>{title}</div>
  </div>;
}

function TableCard({ table, onPlay, onDelete }) {
  const { rounds, totalSeconds, maxHold } = tableStats(table);
  const maxVal = Math.max(...rounds.map((r) => r.hold));
  const isO2 = table.tableType === "O2";
  const badgeColor = isO2 ? COLORS.cyan : COLORS.green;
  return (
    <div style={{ background: COLORS.bgCard, borderRadius: 20, padding: "20px 20px 18px", marginBottom: 14, border: "1px solid rgba(127,216,255,0.12)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ display: "inline-block", padding: "4px 10px", borderRadius: 8, fontSize: 11, fontWeight: 700, letterSpacing: 1, color: badgeColor, background: `${badgeColor}22`, fontFamily: DISPLAY_FONT }}>
          {table.tableType} TABLE
        </span>
        {onDelete && <span onClick={onDelete} style={{ color: COLORS.red, cursor: "pointer", padding: 4 }}><Trash2 size={16} /></span>}
      </div>
      <div style={{ color: COLORS.white, fontWeight: 700, fontSize: 20, fontFamily: DISPLAY_FONT, marginTop: 8, marginBottom: 6 }}>{table.name}</div>
      <div style={{ display: "flex", gap: 16, color: COLORS.dim, fontSize: 12.5, marginBottom: 16, flexWrap: "wrap" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Layers size={13} /> {table.rounds} rounds</span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Clock size={13} /> {formatTime(totalSeconds)}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 4, color: badgeColor }}><TrendingUp size={13} /> max {formatTime(maxHold)}</span>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 32, marginBottom: 16 }}>
        {rounds.map((r, i) => {
          const h = 8 + (r.hold / maxVal) * 24;
          const t = i / Math.max(1, rounds.length - 1);
          const color = isO2
            ? `rgba(${79 + (127 - 79) * t}, ${195 + (216 - 195) * t}, ${247 + (255 - 247) * t}, ${0.5 + t * 0.5})`
            : `rgba(${79 + (127 - 79) * t}, ${200 + (232 - 200) * t}, ${150 + (168 - 150) * t}, ${0.5 + t * 0.5})`;
          return <div key={i} style={{ flex: 1, height: h, background: color, borderRadius: 3 }} />;
        })}
      </div>
      <button onClick={onPlay} style={{
        width: 44, height: 44, borderRadius: "50%", border: `1px solid ${badgeColor}66`, background: `${badgeColor}18`,
        color: badgeColor, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
      }}><Play size={18} fill={badgeColor} /></button>
    </div>
  );
}

function Stepper({ label, value, onDec, onInc }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: COLORS.bgCardHi, borderRadius: 14, padding: "14px 18px", marginBottom: 10 }}>
      <div style={{ color: COLORS.dim, fontSize: 13, letterSpacing: 1, textTransform: "uppercase", fontFamily: BODY_FONT }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <button onClick={onDec} style={circleBtnStyle}><Minus size={16} /></button>
        <div style={{ color: COLORS.white, fontWeight: 700, fontSize: 18, minWidth: 56, textAlign: "center", fontFamily: DISPLAY_FONT }}>{value}</div>
        <button onClick={onInc} style={circleBtnStyle}><Plus size={16} /></button>
      </div>
    </div>
  );
}

function ConfirmModal({ title, body, confirmLabel, danger, onConfirm, onCancel }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(3,15,24,0.85)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: COLORS.bgCard, borderRadius: 18, padding: 24, width: "100%", maxWidth: 340, border: "1px solid rgba(127,216,255,0.2)" }}>
        <div style={{ color: COLORS.white, fontWeight: 700, fontSize: 18, fontFamily: DISPLAY_FONT, marginBottom: 10 }}>{title}</div>
        <div style={{ color: COLORS.dim, fontSize: 14, marginBottom: 20, lineHeight: 1.4 }}>{body}</div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{ ...pillBtnStyle, flex: 1, textAlign: "center" }}>Cancel</button>
          <button onClick={onConfirm} style={{ ...pillBtnStyle, flex: 1, textAlign: "center", borderColor: danger ? "rgba(255,118,118,0.5)" : "rgba(127,216,255,0.5)", color: danger ? COLORS.red : COLORS.cyan, background: danger ? "rgba(255,118,118,0.12)" : "rgba(127,216,255,0.12)" }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

function DifficultyPicker({ onPick, onCancel }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(3,15,24,0.85)", zIndex: 50, display: "flex", alignItems: "flex-end" }}>
      <div style={{ background: COLORS.bgCard, borderRadius: "20px 20px 0 0", padding: 22, width: "100%", border: "1px solid rgba(127,216,255,0.2)" }}>
        <div style={{ color: COLORS.white, fontWeight: 700, fontSize: 18, fontFamily: DISPLAY_FONT, marginBottom: 14, textAlign: "center" }}>Choose intensity</div>
        {Object.entries(DIFFICULTIES).map(([key, d]) => (
          <button key={key} onClick={() => onPick(key)} style={{
            width: "100%", textAlign: "left", background: "rgba(255,255,255,0.03)", border: `1px solid ${d.color}55`,
            borderRadius: 14, padding: "14px 16px", marginBottom: 10, cursor: "pointer",
          }}>
            <div style={{ color: d.color, fontWeight: 700, fontSize: 16, fontFamily: DISPLAY_FONT }}>{d.emoji} {d.label}</div>
            <div style={{ color: COLORS.dim, fontSize: 12, marginTop: 2 }}>
              {key === "normal" ? "Standard table as designed" : `${d.breatheMul > 1 ? "+" : ""}${Math.round((d.breatheMul - 1) * 100)}% breathe time, ${d.holdMul > 1 ? "+" : ""}${Math.round((d.holdMul - 1) * 100)}% holds`}
            </div>
          </button>
        ))}
        <button onClick={onCancel} style={{ ...pillBtnStyle, width: "100%", textAlign: "center", marginTop: 4 }}>Cancel</button>
      </div>
    </div>
  );
}

const circleBtnStyle = {
  width: 36, height: 36, borderRadius: "50%", border: "1px solid rgba(127,216,255,0.3)",
  background: "rgba(127,216,255,0.08)", color: COLORS.cyan, cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
};
const primaryBtnStyle = {
  width: "100%", padding: "16px 0", borderRadius: 16, fontWeight: 700, fontSize: 15, letterSpacing: 1.5,
  border: "1px solid rgba(127,216,255,0.4)", background: "rgba(127,216,255,0.15)", color: COLORS.cyanBright,
  cursor: "pointer", fontFamily: DISPLAY_FONT, textTransform: "uppercase",
};
const pillBtnStyle = {
  padding: "10px 18px", borderRadius: 20, fontWeight: 600, fontSize: 12.5, letterSpacing: 0.5,
  border: "1px solid rgba(127,216,255,0.35)", background: "rgba(127,216,255,0.08)", color: COLORS.cyan,
  cursor: "pointer", fontFamily: BODY_FONT,
};
const circleBtnStyleBig = {
  width: 54, height: 54, borderRadius: "50%", border: "1px solid rgba(127,216,255,0.3)",
  background: "rgba(127,216,255,0.08)", color: COLORS.cyan, fontWeight: 700, fontSize: 13, cursor: "pointer",
  fontFamily: DISPLAY_FONT,
};
const tabBarStyle = {
  position: "fixed", bottom: 0, left: 0, right: 0, display: "flex", background: "rgba(10,31,46,0.94)",
  borderTop: "1px solid rgba(127,216,255,0.15)", paddingBottom: "env(safe-area-inset-bottom)", zIndex: 10,
  backdropFilter: "blur(10px)",
};
function TabButton({ active, label, Icon, onClick }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, background: "none", border: "none", padding: "12px 0 10px", cursor: "pointer",
      color: active ? COLORS.cyanBright : COLORS.dim, display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
    }}>
      <Icon size={19} strokeWidth={active ? 2.4 : 1.8} />
      <span style={{ fontSize: 11, fontFamily: DISPLAY_FONT, letterSpacing: 1, textTransform: "uppercase" }}>{label}</span>
    </button>
  );
}
function ToggleRow({ label, sub, checked, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: COLORS.bgCard, borderRadius: 16, padding: "16px 18px", marginBottom: 12 }}>
      <div>
        <div style={{ color: COLORS.white, fontWeight: 600, fontSize: 15 }}>{label}</div>
        {sub && <div style={{ color: COLORS.dim, fontSize: 12, marginTop: 2 }}>{sub}</div>}
      </div>
      <button onClick={() => onChange(!checked)} style={{
        width: 46, height: 26, borderRadius: 13, border: "none", cursor: "pointer", position: "relative",
        background: checked ? "rgba(127,216,255,0.4)" : "rgba(255,255,255,0.1)", transition: "background 0.2s",
      }}>
        <div style={{
          position: "absolute", top: 3, left: checked ? 23 : 3, width: 20, height: 20, borderRadius: "50%",
          background: checked ? COLORS.cyanBright : COLORS.dim, transition: "left 0.2s",
        }} />
      </button>
    </div>
  );
}

function useLongPress(callback, ms = 900) {
  const timer = useRef(null);
  const [pressing, setPressing] = useState(false);
  const start = useCallback(() => {
    setPressing(true);
    timer.current = setTimeout(() => { callback(); setPressing(false); }, ms);
  }, [callback, ms]);
  const clear = useCallback(() => {
    setPressing(false);
    if (timer.current) clearTimeout(timer.current);
  }, []);
  return { pressing, handlers: { onMouseDown: start, onMouseUp: clear, onMouseLeave: clear, onTouchStart: start, onTouchEnd: clear } };
}

function LongPressButton({ pressing, ms, children, color, handlers }) {
  return (
    <div {...handlers} style={{
      position: "relative", width: "100%", padding: "17px 0", borderRadius: 16, fontWeight: 700, fontSize: 15,
      letterSpacing: 1, fontFamily: DISPLAY_FONT, textTransform: "uppercase", overflow: "hidden",
      border: "1px solid rgba(127,216,255,0.2)", cursor: "pointer", textAlign: "center", userSelect: "none",
      background: "rgba(127,216,255,0.1)", color,
    }}>
      <div style={{
        position: "absolute", inset: 0, background: "rgba(127,216,255,0.35)", transformOrigin: "left",
        transform: `scaleX(${pressing ? 1 : 0})`, transition: pressing ? `transform ${ms}ms linear` : "transform 0.15s ease-out",
      }} />
      <div style={{ position: "relative" }}>{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
export default function App() {
  const [screen, setScreen] = useState("train");
  const [loaded, setLoaded] = useState(false);

  const [prSeconds, setPrSeconds] = useState(0);
  const [customTables, setCustomTables] = useState([]);
  const [history, setHistory] = useState([]);
  const [hapticsOn, setHapticsOn] = useState(true);

  useEffect(() => {
    (async () => {
      const pr = await loadStored("apnea_pr", { seconds: 0 });
      const cust = await loadStored("apnea_custom_tables", []);
      const hist = await loadStored("apnea_history", []);
      const settings = await loadStored("apnea_settings", { haptics: true });
      setPrSeconds(pr.seconds || 0);
      setCustomTables(Array.isArray(cust) ? cust : []);
      setHistory(Array.isArray(hist) ? hist : []);
      setHapticsOn(settings.haptics !== false);
      setHapticsEnabled(settings.haptics !== false);
      setLoaded(true);
    })();
  }, []);
  useEffect(() => { if (loaded) saveStored("apnea_pr", { seconds: prSeconds }); }, [prSeconds, loaded]);
  useEffect(() => { if (loaded) saveStored("apnea_custom_tables", customTables); }, [customTables, loaded]);
  useEffect(() => { if (loaded) saveStored("apnea_history", history); }, [history, loaded]);
  useEffect(() => { if (loaded) { saveStored("apnea_settings", { haptics: hapticsOn }); setHapticsEnabled(hapticsOn); } }, [hapticsOn, loaded]);

  const logHistory = useCallback((entry) => {
    setHistory((h) => [{ id: uid(), date: todayKey(), timestamp: Date.now(), ...entry }, ...h]);
  }, []);
  const deleteHistoryEntry = useCallback((id) => setHistory((h) => h.filter((e) => e.id !== id)), []);

  const [prDraft, setPrDraft] = useState(60);
  useEffect(() => { setPrDraft(prSeconds || 60); }, [prSeconds]);

  const [hr, setHr] = useState(0);
  const [minHr, setMinHr] = useState(0);
  const [maxHr, setMaxHr] = useState(0);
  const [bleConnected, setBleConnected] = useState(false);
  const [bleStatus, setBleStatus] = useState("");
  const logHr = useCallback((v) => {
    setHr(v);
    if (v > 0) {
      setMinHr((m) => (m === 0 || v < m ? v : m));
      setMaxHr((m) => (v > m ? v : m));
    }
  }, []);
  const resetHr = () => { setHr(0); setMinHr(0); setMaxHr(0); };
  const connectWatch = async () => {
    setBleStatus("");
    await scanAndConnectHrMonitor((r) => logHr(r), (state, message) => {
      setBleStatus(message);
      if (state === "connected") setBleConnected(true);
      if (state === "disconnected" || state === "error") setBleConnected(false);
    });
  };
  const disconnectWatch = async () => { await disconnectHrMonitor(); setBleConnected(false); setBleStatus("Disconnected"); };

  const [showCustomModal, setShowCustomModal] = useState(false);
  const [ctName, setCtName] = useState("");
  const [ctType, setCtType] = useState("O2");
  const [ctRounds, setCtRounds] = useState(8);
  const [ctBreathe, setCtBreathe] = useState(120);
  const [ctHold, setCtHold] = useState(60);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [confirmClearHistory, setConfirmClearHistory] = useState(false);
  const [confirmResetPr, setConfirmResetPr] = useState(false);

  const addCustomTable = () => {
    const t = { id: uid(), name: ctName.trim() || "Custom table", tableType: ctType, baseHold: ctHold, baseBreathe: ctBreathe, step: 15, rounds: ctRounds };
    setCustomTables((c) => [...c, t]);
    setShowCustomModal(false);
    setCtName(""); setCtType("O2"); setCtRounds(8); setCtBreathe(120); setCtHold(60);
  };

  const [pendingTable, setPendingTable] = useState(null);
  const tpList = () => {
    const list = [];
    if (prSeconds > 0) {
      list.push({ id: "auto-pr", name: "Auto O2 (your PR)", tableType: "O2",
        baseHold: Math.max(15, Math.round(prSeconds * 0.5)), baseBreathe: 120,
        step: Math.max(5, Math.round(prSeconds * 0.08)), rounds: 6 });
    }
    return [...list, ...PRESETS, ...customTables];
  };

  const [sTable, setSTable] = useState(null);
  const [sDifficulty, setSDifficulty] = useState("normal");
  const [sRound, setSRound] = useState(1);
  const [sPhase, setSPhase] = useState("ready");
  const [sTimer, setSTimer] = useState(0);
  const [sHoldTime, setSHoldTime] = useState(0);
  const [sBreatheTime, setSBreatheTime] = useState(0);
  const [sRunning, setSRunning] = useState(false);
  const [sContractions, setSContractions] = useState(0);
  const [sRipple, setSRipple] = useState(0);
  const [sBurst, setSBurst] = useState(0);
  const [showSurfaceConfirm, setShowSurfaceConfirm] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const warnedRef = useRef(false);

  const beginSession = (table, difficulty) => {
    const d = DIFFICULTIES[difficulty];
    const scaledBreathe = Math.round(table.baseBreathe * d.breatheMul);
    const scaledHold = Math.round(table.baseHold * d.holdMul);
    setSTable(table); setSDifficulty(difficulty); setSRound(1);
    setSHoldTime(scaledHold); setSBreatheTime(scaledBreathe);
    setSPhase("ready"); setSTimer(scaledBreathe); setSRunning(false); setSContractions(0);
    resetHr(); setPendingTable(null); setScreen("session");
  };

  useEffect(() => {
    if (screen !== "session" || !sRunning) return;
    const id = setTimeout(() => {
      if (sTimer > 1) {
        if (sTimer === 11 && !warnedRef.current) { warnedRef.current = true; warningPulse(); }
        setSTimer(sTimer - 1);
        return;
      }
      warnedRef.current = false;
      transitionPulse();
      setSRipple((n) => n + 1);
      if (sPhase === "ready" || sPhase === "breathe") {
        setSContractions(0); setSPhase("hold"); setSTimer(sHoldTime);
      } else {
        const nextRound = sRound + 1;
        if (nextRound > sTable.rounds) {
          setSRunning(false); setSPhase("done"); setSBurst((n) => n + 1);
          logHistory({ type: "table", name: sTable.name, difficulty: sDifficulty, completed: true, failedRound: null });
        } else {
          let nh = sHoldTime, nb = sBreatheTime;
          if (sTable.tableType === "CO2") nb = Math.max(15, sBreatheTime - sTable.step);
          else nh = sHoldTime + sTable.step;
          setSHoldTime(nh); setSBreatheTime(nb); setSRound(nextRound); setSPhase("breathe"); setSTimer(nb);
        }
      }
    }, 1000);
    return () => clearTimeout(id);
  }, [screen, sRunning, sTimer, sPhase, sHoldTime, sBreatheTime, sRound, sTable, sDifficulty, logHistory]);

  const sPhaseTotal = sPhase === "hold" ? sHoldTime : sBreatheTime;
  const sFraction = sPhaseTotal > 0 ? 1 - sTimer / sPhaseTotal : 0;

  const skipToHold = () => {
    if (sPhase !== "breathe" && sPhase !== "ready") return;
    transitionPulse(); setSRipple((n) => n + 1); setSContractions(0); setSPhase("hold"); setSTimer(sHoldTime);
  };

  const confirmSurface = () => {
    setShowSurfaceConfirm(false);
    setSRunning(false);
    setSBurst((n) => n + 1);
    logHistory({ type: "table", name: sTable.name, difficulty: sDifficulty, completed: false, failedRound: sRound });
    setScreen("train");
  };

  const contractionLongPress = useLongPress(() => setSContractions((c) => c + 1), 900);

  const [paMode, setPaMode] = useState("breathe");
  const [paTimer, setPaTimer] = useState(120);
  const [paElapsed, setPaElapsed] = useState(0);
  const [paContractions, setPaContractions] = useState(0);
  const [paIsPR, setPaIsPR] = useState(false);
  const [paBurst, setPaBurst] = useState(0);
  const lastMinuteRef = useRef(0);

  const startPrAttempt = () => {
    setPaMode("breathe"); setPaTimer(120); setPaElapsed(0); setPaContractions(0); setPaIsPR(false);
    lastMinuteRef.current = 0; resetHr(); setScreen("prattempt");
  };

  useEffect(() => {
    if (screen !== "prattempt") return;
    const id = setInterval(() => {
      if (paMode === "breathe") {
        setPaTimer((t) => { if (t <= 1) { transitionPulse(); setPaMode("attempt"); return 0; } if (t === 11) warningPulse(); return t - 1; });
      } else if (paMode === "attempt") {
        setPaElapsed((t) => {
          const next = t + 1;
          const minute = Math.floor(next / 60);
          if (minute > lastMinuteRef.current && next % 60 === 0) { lastMinuteRef.current = minute; minutePulse(); }
          return next;
        });
      }
    }, 1000);
    return () => clearInterval(id);
  }, [screen, paMode]);

  const paLongPress = useLongPress(() => setPaContractions((c) => c + 1), 900);

  const stopPrAttempt = () => {
    let beat = false;
    if (paElapsed > prSeconds) { setPrSeconds(paElapsed); setPaIsPR(true); beat = true; prBeatPulse(); setPaBurst((n) => n + 1); }
    logHistory({ type: "pr", name: "PR Attempt", completed: true, isPR: beat, duration: paElapsed });
    setPaMode("result");
  };

  const goTab = (tab) => setScreen(tab);

  if (!loaded) {
    return (
      <div style={{ width: "100%", minHeight: "100vh", background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Heart size={40} color={COLORS.red} fill={COLORS.red} style={{ animation: "pulseFade 1.4s ease-in-out infinite" }} />
      </div>
    );
  }

  return (
    <div style={{ width: "100%", minHeight: "100vh", background: COLORS.bg, position: "relative", fontFamily: BODY_FONT, paddingTop: "env(safe-area-inset-top)" }}>
      <Bubbles />
      <div key={screen} style={{ position: "relative", zIndex: 1, paddingBottom: ["train", "pr", "history", "settings"].includes(screen) ? 90 : 40, animation: "fadeIn 0.25s ease-out" }}>

        {screen === "train" && (
          <>
            <div style={{ textAlign: "center", padding: "40px 20px 20px" }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: COLORS.white, letterSpacing: 3, fontFamily: DISPLAY_FONT, textTransform: "uppercase" }}>Apnea Trainer</div>
              <div style={{ fontSize: 12, color: COLORS.dim, marginTop: 6, letterSpacing: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                {prSeconds > 0 ? <><Star size={12} fill={COLORS.orange} color={COLORS.orange} /> PERSONAL BEST &middot; {formatTime(prSeconds)}</> : "NO PR SET YET"}
              </div>
            </div>
            <div style={{ padding: "0 20px" }}>
              {tpList().map((t) => (
                <TableCard key={t.id} table={t} onPlay={() => setPendingTable(t)}
                  onDelete={customTables.find((c) => c.id === t.id) ? () => setDeleteTarget({ kind: "custom", id: t.id }) : null} />
              ))}
              <button onClick={() => setShowCustomModal(true)} style={{ ...primaryBtnStyle, marginTop: 6, background: "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <Plus size={16} /> New custom table
              </button>
            </div>
          </>
        )}

        {screen === "pr" && (
          <>
            <ScreenHeader title="Personal Best" />
            <div style={{ padding: "20px 20px", textAlign: "center" }}>
              <div style={{ fontSize: 58, fontWeight: 700, color: COLORS.white, fontFamily: DISPLAY_FONT, fontVariantNumeric: "tabular-nums" }}>{formatTime(prDraft)}</div>
              <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 20 }}>
                <button onClick={() => setPrDraft((v) => Math.max(5, v - 30))} style={circleBtnStyleBig}>&#8722;30</button>
                <button onClick={() => setPrDraft((v) => Math.max(5, v - 5))} style={circleBtnStyleBig}>&#8722;5</button>
                <button onClick={() => setPrDraft((v) => v + 5)} style={circleBtnStyleBig}>&#43;5</button>
                <button onClick={() => setPrDraft((v) => v + 30)} style={circleBtnStyleBig}>&#43;30</button>
              </div>
              <button onClick={() => setPrSeconds(prDraft)} style={{ ...primaryBtnStyle, marginTop: 24 }}>Save as PR</button>
              <button onClick={startPrAttempt} style={{ ...primaryBtnStyle, marginTop: 14, background: "rgba(127,232,168,0.15)", borderColor: "rgba(127,232,168,0.4)", color: COLORS.greenBright }}>Start PR attempt</button>
            </div>
          </>
        )}

        {screen === "history" && (
          <>
            <ScreenHeader title="History" />
            <div style={{ padding: "0 20px" }}>
              {history.length === 0 && <div style={{ color: COLORS.dim, textAlign: "center", marginTop: 30 }}>No sessions logged yet</div>}
              {Object.entries(history.reduce((acc, e) => { (acc[e.date] = acc[e.date] || []).push(e); return acc; }, {})).map(([date, entries]) => {
                const allDone = entries.every((e) => e.completed);
                const allFailed = entries.every((e) => !e.completed);
                const dotColor = allDone ? COLORS.green : allFailed ? COLORS.red : COLORS.orange;
                return (
                  <div key={date} style={{ marginBottom: 18 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: dotColor }} />
                      <div style={{ color: COLORS.dim, fontSize: 13, letterSpacing: 1 }}>{date}</div>
                    </div>
                    {entries.map((e) => (
                      <div key={e.id} style={{ background: COLORS.bgCard, borderRadius: 14, padding: "12px 16px", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div>
                          <div style={{ color: COLORS.white, fontWeight: 600, fontSize: 14 }}>
                            {e.name} {e.difficulty && e.difficulty !== "normal" && (
                              <span style={{ color: DIFFICULTIES[e.difficulty].color, fontSize: 11, marginLeft: 6 }}>{DIFFICULTIES[e.difficulty].emoji} {DIFFICULTIES[e.difficulty].label}</span>
                            )}
                            {e.isPR && <span style={{ color: COLORS.green, fontSize: 11, marginLeft: 6 }}>&#9733; PR</span>}
                          </div>
                          {!e.completed && <div style={{ color: COLORS.red, fontSize: 11, marginTop: 2 }}>FAILED &middot; surfaced on round {e.failedRound}</div>}
                          {e.duration != null && <div style={{ color: COLORS.dim, fontSize: 11, marginTop: 2 }}>{formatTime(e.duration)}</div>}
                        </div>
                        <span onClick={() => setDeleteTarget({ kind: "history", id: e.id })} style={{ color: COLORS.red, cursor: "pointer", padding: 6 }}><Trash2 size={16} /></span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {screen === "settings" && (
          <>
            <ScreenHeader title="Settings" />
            <div style={{ padding: "0 20px" }}>
              <ToggleRow label="Haptics" sub="Vibration cues during sessions" checked={hapticsOn} onChange={setHapticsOn} />
              <button onClick={() => setConfirmResetPr(true)} style={{ ...primaryBtnStyle, marginBottom: 12, background: "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <RotateCcw size={15} /> Reset personal best
              </button>
              <button onClick={() => setConfirmClearHistory(true)} style={{ ...primaryBtnStyle, background: "rgba(255,118,118,0.1)", borderColor: "rgba(255,118,118,0.3)", color: COLORS.red, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <Trash2 size={15} /> Clear history
              </button>
              <div style={{ textAlign: "center", marginTop: 30, color: COLORS.dim, fontSize: 12, lineHeight: 1.6 }}>
                Apnea Trainer<br />Built for CO2/O2 tables, PR attempts, and live watch HR
              </div>
            </div>
          </>
        )}

        {screen === "session" && sTable && (
          <div style={{ position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 20px 4px" }}>
              <button onClick={() => setShowExitConfirm(true)} style={{ background: "none", border: "none", color: COLORS.dim, cursor: "pointer" }}><X size={22} /></button>
              <div style={{ textAlign: "center" }}>
                <div style={{ color: COLORS.dim, fontSize: 12 }}>{sTable.name}</div>
                <div style={{ color: COLORS.cyan, fontWeight: 700, fontFamily: DISPLAY_FONT, letterSpacing: 2 }}>{sPhase === "done" ? "COMPLETE" : `ROUND ${sRound}/${sTable.rounds}`}</div>
              </div>
              <div style={{ width: 22 }} />
            </div>
            {sDifficulty !== "normal" && (
              <div style={{ textAlign: "center", color: DIFFICULTIES[sDifficulty].color, fontSize: 12, fontWeight: 700, letterSpacing: 2, marginBottom: 4 }}>
                {DIFFICULTIES[sDifficulty].emoji} {DIFFICULTIES[sDifficulty].label.toUpperCase()}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 20px" }}
              onDoubleClick={skipToHold}
              onTouchEnd={(e) => { const now = Date.now(); if (now - (e.currentTarget._lastTap || 0) < 300) skipToHold(); e.currentTarget._lastTap = now; }}>
              <div style={{ position: "relative", marginTop: 12 }}>
                <RippleRings trigger={sRipple} color={sPhase === "breathe" || sPhase === "ready" ? COLORS.green : COLORS.cyan} />
                <BubbleBurst burstTrigger={sBurst} />
                <ProgressRing fraction={sRunning || sPhase === "hold" || sPhase === "breathe" ? sFraction : 0} color={sPhase === "breathe" || sPhase === "ready" ? COLORS.green : COLORS.cyan} />
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ fontSize: 13, letterSpacing: 3, color: sPhase === "breathe" || sPhase === "ready" ? COLORS.greenBright : COLORS.cyanBright, fontWeight: 700, fontFamily: DISPLAY_FONT }}>
                    {sPhase === "ready" ? "READY" : sPhase === "breathe" ? "BREATHE" : sPhase === "hold" ? "HOLD" : "DONE"}
                  </div>
                  <div style={{ fontSize: 44, fontWeight: 700, color: COLORS.white, fontFamily: DISPLAY_FONT, fontVariantNumeric: "tabular-nums" }}>{formatTime(sTimer)}</div>
                </div>
              </div>
              {sPhase === "ready" && !sRunning && <button onClick={() => { setSRunning(true); setSPhase("breathe"); }} style={{ ...primaryBtnStyle, marginTop: 26 }}>Start</button>}
              {(sPhase === "breathe" || sPhase === "ready") && sRunning && <div style={{ color: COLORS.dim, fontSize: 11, marginTop: 10, letterSpacing: 1 }}>DOUBLE-TAP TO SKIP TO HOLD</div>}
              {sPhase === "done" && <button onClick={() => beginSession(sTable, sDifficulty)} style={{ ...primaryBtnStyle, marginTop: 26 }}>Restart</button>}
              {sPhase === "hold" && (
                <div style={{ width: "100%", marginTop: 22 }}>
                  <LongPressButton pressing={contractionLongPress.pressing} ms={900} color={COLORS.cyanBright} handlers={contractionLongPress.handlers}>
                    <Zap size={14} style={{ display: "inline", verticalAlign: -2, marginRight: 4 }} />{sContractions} &middot; hold 1s to log
                  </LongPressButton>
                  <button onClick={() => setShowSurfaceConfirm(true)} style={{
                    width: "100%", marginTop: 14, padding: "13px 0", borderRadius: 16, fontWeight: 700, fontSize: 13, letterSpacing: 1,
                    border: "1px solid rgba(255,118,118,0.4)", background: "rgba(255,118,118,0.1)", color: COLORS.red, cursor: "pointer", fontFamily: DISPLAY_FONT,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  }}><AlertTriangle size={14} /> I surfaced</button>
                </div>
              )}
              <div style={{ width: "100%", marginTop: 22 }}>
                <HrGauge hr={hr} min={minHr} max={maxHr} bleStatus={bleStatus} bleConnected={bleConnected} onConnect={connectWatch} onDisconnect={disconnectWatch} manualHr={hr} setManualHr={logHr} />
              </div>
            </div>
          </div>
        )}

        {screen === "prattempt" && (
          <div style={{ position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 20px 4px" }}>
              <button onClick={() => setScreen("pr")} style={{ background: "none", border: "none", color: COLORS.dim, cursor: "pointer" }}><X size={22} /></button>
              <div style={{ color: COLORS.cyan, fontWeight: 700, fontFamily: DISPLAY_FONT, letterSpacing: 2 }}>
                {paMode === "result" ? "RESULT" : prSeconds > 0 ? `BEAT ${formatTime(prSeconds)}` : "PR ATTEMPT"}
              </div>
              <div style={{ width: 22 }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 20px" }}>
              <div style={{ position: "relative", marginTop: 12 }}>
                <BubbleBurst burstTrigger={paBurst} />
                <ProgressRing fraction={paMode === "attempt" && prSeconds > 0 ? paElapsed / prSeconds : paMode === "breathe" ? 1 - paTimer / 120 : 0} color={paMode === "breathe" ? COLORS.green : COLORS.cyan} />
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ fontSize: 13, letterSpacing: 3, color: paMode === "breathe" ? COLORS.greenBright : COLORS.cyanBright, fontWeight: 700, fontFamily: DISPLAY_FONT }}>
                    {paMode === "breathe" ? "BREATHE UP" : paMode === "attempt" ? "HOLD - GO" : paIsPR ? "NEW PR!" : "GOOD EFFORT"}
                  </div>
                  <div style={{ fontSize: 44, fontWeight: 700, color: COLORS.white, fontFamily: DISPLAY_FONT, fontVariantNumeric: "tabular-nums" }}>{formatTime(paMode === "breathe" ? paTimer : paElapsed)}</div>
                </div>
              </div>
              {paMode === "breathe" && <button onClick={() => { transitionPulse(); setPaMode("attempt"); setPaElapsed(0); }} style={{ ...primaryBtnStyle, marginTop: 26 }}>Skip to hold</button>}
              {paMode === "attempt" && (
                <>
                  <div style={{ width: "100%", marginTop: 22 }}>
                    <LongPressButton pressing={paLongPress.pressing} ms={900} color={COLORS.cyanBright} handlers={paLongPress.handlers}>
                      <Zap size={14} style={{ display: "inline", verticalAlign: -2, marginRight: 4 }} />{paContractions} &middot; hold 1s to log
                    </LongPressButton>
                  </div>
                  <button onClick={stopPrAttempt} style={{ ...primaryBtnStyle, marginTop: 14, background: "rgba(255,118,118,0.15)", borderColor: "rgba(255,118,118,0.4)", color: COLORS.red }}>Stop</button>
                </>
              )}
              {paMode === "result" && <button onClick={() => setScreen("pr")} style={{ ...primaryBtnStyle, marginTop: 26 }}>Back</button>}
              {paMode !== "result" && (
                <div style={{ width: "100%", marginTop: 22 }}>
                  <HrGauge hr={hr} min={minHr} max={maxHr} bleStatus={bleStatus} bleConnected={bleConnected} onConnect={connectWatch} onDisconnect={disconnectWatch} manualHr={hr} setManualHr={logHr} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {["train", "pr", "history", "settings"].includes(screen) && (
        <div style={tabBarStyle}>
          <TabButton active={screen === "train"} label="Train" Icon={Dumbbell} onClick={() => goTab("train")} />
          <TabButton active={screen === "pr"} label="PR" Icon={Timer} onClick={() => goTab("pr")} />
          <TabButton active={screen === "history"} label="History" Icon={BarChart3} onClick={() => goTab("history")} />
          <TabButton active={screen === "settings"} label="Settings" Icon={Settings2} onClick={() => goTab("settings")} />
        </div>
      )}

      {pendingTable && <DifficultyPicker onPick={(diff) => beginSession(pendingTable, diff)} onCancel={() => setPendingTable(null)} />}

      {showCustomModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(3,15,24,0.9)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: COLORS.bgCard, borderRadius: 18, padding: 22, width: "100%", maxWidth: 360, border: "1px solid rgba(127,216,255,0.2)" }}>
            <div style={{ color: COLORS.white, fontWeight: 700, fontSize: 17, fontFamily: DISPLAY_FONT, marginBottom: 14, textAlign: "center", letterSpacing: 1 }}>NEW CUSTOM TABLE</div>
            <input value={ctName} onChange={(e) => setCtName(e.target.value)} placeholder="Table name" style={{
              width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(127,216,255,0.3)",
              background: "rgba(255,255,255,0.03)", color: COLORS.white, fontSize: 15, marginBottom: 12, fontFamily: BODY_FONT,
            }} />
            <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              {["O2", "CO2"].map((tt) => (
                <button key={tt} onClick={() => setCtType(tt)} style={{
                  flex: 1, padding: "12px 0", borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: DISPLAY_FONT,
                  border: ctType === tt ? `1px solid ${COLORS.cyan}` : "1px solid rgba(127,216,255,0.15)",
                  background: ctType === tt ? "rgba(127,216,255,0.15)" : "transparent", color: ctType === tt ? COLORS.cyanBright : COLORS.dim,
                }}>{tt}</button>
              ))}
            </div>
            <Stepper label="Rounds" value={ctRounds} onDec={() => setCtRounds((v) => Math.max(1, v - 1))} onInc={() => setCtRounds((v) => v + 1)} />
            <Stepper label="Breathe (s)" value={ctBreathe} onDec={() => setCtBreathe((v) => Math.max(15, v - 5))} onInc={() => setCtBreathe((v) => v + 5)} />
            <Stepper label="Hold (s)" value={ctHold} onDec={() => setCtHold((v) => Math.max(15, v - 5))} onInc={() => setCtHold((v) => v + 5)} />
            <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
              <button onClick={() => setShowCustomModal(false)} style={{ ...pillBtnStyle, flex: 1, textAlign: "center" }}>Cancel</button>
              <button onClick={addCustomTable} style={{ ...pillBtnStyle, flex: 1, textAlign: "center", background: "rgba(127,216,255,0.2)" }}>Add</button>
            </div>
          </div>
        </div>
      )}

      {showSurfaceConfirm && <ConfirmModal title="Surface now?" body="This will end the session and log it as failed, noting the round you surfaced on." confirmLabel="I surfaced" danger onConfirm={confirmSurface} onCancel={() => setShowSurfaceConfirm(false)} />}
      {showExitConfirm && <ConfirmModal title="Exit session?" body="Your progress on this session won't be saved." confirmLabel="Exit" danger onConfirm={() => { setShowExitConfirm(false); setSRunning(false); setScreen("train"); }} onCancel={() => setShowExitConfirm(false)} />}
      {deleteTarget && (
        <ConfirmModal title="Delete this?" body="This can't be undone." confirmLabel="Delete" danger
          onConfirm={() => { if (deleteTarget.kind === "custom") setCustomTables((c) => c.filter((t) => t.id !== deleteTarget.id)); else deleteHistoryEntry(deleteTarget.id); setDeleteTarget(null); }}
          onCancel={() => setDeleteTarget(null)} />
      )}
      {confirmClearHistory && <ConfirmModal title="Clear all history?" body="This can't be undone." confirmLabel="Clear" danger onConfirm={() => { setHistory([]); setConfirmClearHistory(false); }} onCancel={() => setConfirmClearHistory(false)} />}
      {confirmResetPr && <ConfirmModal title="Reset your PR?" body="Your personal best will be cleared." confirmLabel="Reset" danger onConfirm={() => { setPrSeconds(0); setConfirmResetPr(false); }} onCancel={() => setConfirmResetPr(false)} />}
    </div>
  );
}
