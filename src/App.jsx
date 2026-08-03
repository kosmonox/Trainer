import { useState, useEffect, useRef, useCallback } from "react";
import {
  Heart, Play, Trash2, X, Zap, AlertTriangle, Plus, Minus,
  Bluetooth, Dumbbell, Timer, BarChart3, Settings2, Star,
  Clock, Layers, TrendingUp, RotateCcw, Check, Pencil, ListPlus,
  Waves, ChevronDown, ChevronUp,
} from "lucide-react";
import { loadStored, saveStored } from "./storage.js";
import { scanAndConnectHrMonitor, disconnectHrMonitor } from "./ble.js";
import { warningPulse, transitionPulse, minutePulse, prBeatPulse, setHapticsEnabled, testVibrate } from "./haptics.js";

const COLORS = {
  bg: "#030f18",
  bgCard: "rgba(10,31,46,0.55)",
  bgCardHi: "rgba(14,42,61,0.6)",
  cyan: "#7fd8ff",
  cyanBright: "#a8e8ff",
  green: "#7fe8a8",
  greenBright: "#b0f5cb",
  red: "#ff7676",
  orange: "#f4b13f",
  white: "#eaf9ff",
  dim: "#6a93a8",
};

const DISPLAY_FONT = "'Oswald', system-ui, sans-serif";
const BODY_FONT = "'Inter', system-ui, sans-serif";
const glass = { backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" };

const DIFFICULTIES = {
  easy: { label: "Easy", emoji: "\u{1F343}", breatheMul: 1.35, holdMul: 0.70, color: COLORS.green },
  normal: { label: "Normal", emoji: "\u26A1", breatheMul: 1, holdMul: 1, color: COLORS.cyan },
  hard: { label: "Hard", emoji: "\u{1F525}", breatheMul: 0.75, holdMul: 1.30, color: COLORS.red },
};

// Checklist extracted from the user's dive-prep reference sheet. A few lines in the
// source PDF were partially garbled by OCR - reconstructed to the clearest sensible
// reading; worth double-checking against the original once visible in the app.
const DIVE_PHASES = [
  { id: "p1", title: "Phase 1 \u2014 \u00C0 sec & Pr\u00E9paration", items: [
    { id: "p1_1", text: "\u00C9tirements thoraciques et diaphragmatiques : ma cage thoracique est-elle souple ? Ai-je fait mes exercices d'assouplissement aujourd'hui ?", influence: "Pelizzari" },
    { id: "p1_2", text: "Pratique du Pranayama / Yoga : suis-je capable de contr\u00F4ler ma respiration pour abaisser mon rythme cardiaque \u00E0 sec ?", influence: "Pelizzari" },
    { id: "p1_3", text: "Entra\u00EEnement de la compensation : est-ce que je pratique mon Frenzel sur le canap\u00E9 avec un ballon (Otovent) ?", influence: "Stern" },
    { id: "p1_4", text: "Visualisation mentale : avant la session, ai-je visualis\u00E9 ma plong\u00E9e parfaite, fluide et relax\u00E9e, du d\u00E9but \u00E0 la fin ?", influence: "Pelizzari" },
  ]},
  { id: "p2", title: "Phase 2 \u2014 En Surface (Breathe-up)", items: [
    { id: "p2_1", text: "Body Scan : j'ai scann\u00E9 mon corps. Mon front, mes m\u00E2choires, mon cou et mes \u00E9paules sont totalement rel\u00E2ch\u00E9s.", influence: "Stern" },
    { id: "p2_2", text: "Respiration ventrale (2:1) : mon expiration est deux fois plus longue que mon inspiration. Seul mon ventre se gonfle sans forcer.", influence: "Stern, Pelizzari" },
    { id: "p2_3", text: "D\u00E9concentration / Introspection : mon esprit n'est plus sur l'objectif, ni sur mes peurs. Je suis concentr\u00E9 sur le moment pr\u00E9sent.", influence: "Molchanov, Pelizzari" },
    { id: "p2_4", text: "Derni\u00E8re inspiration maximale : en 3 temps (ventre, poitrine, clavicules) sans cr\u00E9er de tension extr\u00EAme au niveau du cou.", influence: "Pelizzari" },
  ]},
  { id: "p3", title: "Phase 3 \u2014 L'Immersion (Canard)", items: [
    { id: "p3_1", text: "Fluidit\u00E9 et silence : mon canard a-t-il fait des \u00E9claboussures ? Il doit \u00EAtre silencieux et utiliser le poids du torse pour couler.", influence: "Stern, Pelizzari" },
    { id: "p3_2", text: "Gainage imm\u00E9diat : d\u00E8s que mes palmes sont sous l'eau, mon corps est parfaitement align\u00E9 (streamline).", influence: "Molchanov" },
    { id: "p3_3", text: "Premi\u00E8re compensation : ai-je compens\u00E9 avant m\u00EAme d'avoir mal, d\u00E8s le passage de la surface ?", influence: "Stern" },
  ]},
  { id: "p4", title: "Phase 4 \u2014 La Descente", items: [
    { id: "p4_1", text: "Position de la t\u00EAte (Head Neutral) : mon menton est-il rentr\u00E9 ? Interdiction de regarder le fond pour ne pas cambrer la nuque.", influence: "Molchanov" },
    { id: "p4_2", text: "Palmage efficace : mon mouvement part-il bien de la hanche avec des genoux souples, sans faire de mouvement de \u00AB v\u00E9lo \u00BB ?", influence: "Molchanov" },
    { id: "p4_3", text: "Anticipation Frenzel : je compense fr\u00E9quemment et doucement. Ma langue fait le piston, mon ventre reste d\u00E9tendu.", influence: "Stern" },
    { id: "p4_4", text: "Acceptation des spasmes : si le besoin de respirer appara\u00EEt, est-ce que je l'accueille avec calme et rel\u00E2chement plut\u00F4t que de lutter ?", influence: "Molchanov" },
  ]},
  { id: "p5", title: "Phase 5 \u2014 La Chute Libre (Freefall)", items: [
    { id: "p5_1", text: "Arr\u00EAt de la propulsion : ai-je identifi\u00E9 ma zone de flottabilit\u00E9 n\u00E9gative pour cesser tout mouvement au bon moment ?", influence: "Stern, Molchanov" },
    { id: "p5_2", text: "Rel\u00E2chement absolu : mes bras le long du corps, \u00E9paules tombantes. Je me laisse \u00AB couler \u00BB sans aucune r\u00E9sistance.", influence: "Pelizzari" },
    { id: "p5_3", text: "Focus sur l'\u00E9galisation : la seule chose qui bouge est la glotte et la langue pour compenser. Le reste du corps dort.", influence: "Stern" },
  ]},
  { id: "p6", title: "Phase 6 \u2014 Le Virage et Remont\u00E9e", items: [
    { id: "p6_1", text: "Virage fluide : mon virage a-t-il \u00E9t\u00E9 ample et \u00E9conome (sans mouvements brusques qui consomment de l'oxyg\u00E8ne) ?", influence: "Pelizzari" },
    { id: "p6_2", text: "Palmage de remont\u00E9e : pos\u00E9, r\u00E9gulier. Je ne pr\u00E9cipite pas le rythme (pas de sprint final).", influence: "Molchanov" },
    { id: "p6_3", text: "Regard droit : je ne regarde pas la surface, je regarde droit devant / le fil.", influence: "Molchanov" },
    { id: "p6_4", text: "Flottabilit\u00E9 positive : dans les derniers m\u00E8tres (les plus faciles), j'arr\u00EAte de nager et je laisse la flottabilit\u00E9 m'amener.", influence: "Stern" },
  ]},
  { id: "p7", title: "Phase 7 \u2014 La Surface", items: [
    { id: "p7_1", text: "Recovery Breathing (Respirations Crochet) : expiration l\u00E9g\u00E8re puis inspirations rapides et courtes (au moins 3 \u00E0 4).", influence: "Stern, Molchanov" },
    { id: "p7_2", text: "Signe OK : je donne le signe visuel et vocal (\u00AB I'm okay \u00BB) avant de r\u00E9cup\u00E9rer ma vue / parler normalement.", influence: "Molchanov" },
    { id: "p7_3", text: "Analyse \u00E0 froid : qu'est-ce qui m'a manqu\u00E9 ? (Contr\u00F4le / D\u00E9tente / Chrono ?)", influence: "Tous" },
  ]},
];

function computeFocusSummary(entry) {
  if (!entry) return null;
  const workItems = [];
  DIVE_PHASES.forEach((phase) => phase.items.forEach((item) => {
    if (entry.statuses[item.id] === "work") workItems.push(item.text);
  }));
  return { objective: entry.objective, blocker: entry.blocker, gear: entry.gear, workItems };
}
function countWork(entry) {
  let n = 0;
  DIVE_PHASES.forEach((phase) => phase.items.forEach((item) => { if (entry.statuses[item.id] === "work") n++; }));
  return n;
}

function formatTime(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec < 10 ? "0" : ""}${sec}`;
}
function todayKey() { return new Date().toISOString().slice(0, 10); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function fireMiniBurst(x, y) {
  window.dispatchEvent(new CustomEvent("miniburst", { detail: { x, y } }));
}
function getEventXY(e) {
  if (e.clientX != null && e.clientY != null && (e.clientX !== 0 || e.clientY !== 0)) return { x: e.clientX, y: e.clientY };
  const t = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]);
  if (t) return { x: t.clientX, y: t.clientY };
  return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
}

function autoTable(type, prSeconds) {
  if (type === "O2") {
    const hold = prSeconds > 0 ? Math.max(15, Math.round(prSeconds * 0.5)) : 60;
    const step = prSeconds > 0 ? Math.max(5, Math.round(prSeconds * 0.08)) : 15;
    return { id: "auto-o2", name: "O2 Table", tableType: "O2", baseHold: hold, baseBreathe: 120, step, rounds: 8 };
  }
  const hold = prSeconds > 0 ? Math.max(15, Math.round(prSeconds * 0.5)) : 90;
  const step = prSeconds > 0 ? Math.max(5, Math.round(prSeconds * 0.06)) : 15;
  return { id: "auto-co2", name: "CO2 Table", tableType: "CO2", baseHold: hold, baseBreathe: 150, step, rounds: 8 };
}

// Works for both algorithmic ("simple") tables and explicit-per-round ("advanced") tables.
function computeRoundPreview(table) {
  if (table.advanced) return table.customRounds.map((r) => ({ hold: r.hold, breathe: r.breathe }));
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

function PhaseTint({ active, mode }) {
  const color = mode === "breathe" ? "rgba(127,232,168,0.10)" : mode === "hold" ? "rgba(127,216,255,0.10)" : "transparent";
  return <div style={{ position: "fixed", inset: 0, zIndex: 0, background: active ? color : "transparent", transition: "background 0.6s ease" }} />;
}

function BubbleBurst({ burstTrigger }) {
  const [particles, setParticles] = useState([]);
  useEffect(() => {
    if (!burstTrigger) return;
    const n = 24;
    const arr = Array.from({ length: n }).map(() => {
      const angle = Math.random() * 360, dist = 60 + Math.random() * 90;
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
        return <div key={p.id} style={{
          position: "absolute", top: "50%", left: "50%", width: p.size, height: p.size, borderRadius: "50%",
          background: COLORS.cyanBright, boxShadow: "0 0 6px rgba(168,232,255,0.9)",
          animation: `burstOut 1s ease-out ${p.delay}s forwards`, "--dx": `${dx}px`, "--dy": `${dy}px`,
        }} />;
      })}
    </div>
  );
}

function MiniBurstLayer() {
  const [bursts, setBursts] = useState([]);
  useEffect(() => {
    const handler = (e) => {
      const id = uid();
      const { x, y } = e.detail;
      const particles = Array.from({ length: 8 }).map(() => ({
        angle: Math.random() * 360, dist: 16 + Math.random() * 22, size: 2 + Math.random() * 3.5,
      }));
      setBursts((b) => [...b, { id, x, y, particles }]);
      setTimeout(() => setBursts((b) => b.filter((it) => it.id !== id)), 550);
    };
    window.addEventListener("miniburst", handler);
    return () => window.removeEventListener("miniburst", handler);
  }, []);
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 55 }}>
      {bursts.map((b) => (
        <div key={b.id} style={{ position: "absolute", left: b.x, top: b.y }}>
          {b.particles.map((p, i) => {
            const rad = (p.angle * Math.PI) / 180;
            const dx = Math.cos(rad) * p.dist, dy = Math.sin(rad) * p.dist;
            return <div key={i} style={{
              position: "absolute", width: p.size, height: p.size, borderRadius: "50%",
              background: COLORS.cyanBright, boxShadow: "0 0 4px rgba(168,232,255,0.9)",
              animation: "miniBurstOut 0.5s ease-out forwards", "--dx": `${dx}px`, "--dy": `${dy}px`,
            }} />;
          })}
        </div>
      ))}
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

function ProgressRing({ fraction, color, size = 260, stroke = 11 }) {
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
  const stop = (e) => e.stopPropagation();
  return (
    <div style={{ width: "100%" }} onClick={stop} onTouchStart={stop} onMouseDown={stop}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Heart size={20} color={COLORS.red} fill={COLORS.red} />
        <div style={{ position: "relative", flex: 1, height: 11, borderRadius: 6,
          background: "linear-gradient(to right, #4fc3f7 0%, #7fe8a8 18%, #f4d03f 55%, #ff7676 100%)" }}>
          {min > 0 && <div style={{ position: "absolute", left: `${pct(min)}%`, top: -9, transform: "translateX(-50%)", color: COLORS.cyan, fontSize: 13 }}>&#9650;</div>}
          {max > 0 && <div style={{ position: "absolute", left: `${pct(max)}%`, bottom: -9, transform: "translateX(-50%)", color: COLORS.red, fontSize: 13 }}>&#9660;</div>}
          {hr > 0 && <div style={{ position: "absolute", left: `${pct(hr)}%`, top: "50%", transform: "translate(-50%,-50%)", width: 18, height: 18, borderRadius: "50%", background: COLORS.white, border: `2px solid ${COLORS.bg}` }} />}
        </div>
      </div>
      <div style={{ textAlign: "center", marginTop: 7, color: COLORS.red, fontWeight: 700, fontSize: 17, fontFamily: DISPLAY_FONT, letterSpacing: 1 }}>
        {hr > 0 ? `${hr} BPM` : "-- BPM"}
      </div>
      <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
        {bleConnected ? (
          <button onClick={onDisconnect} style={{ ...pillBtnStyle, borderColor: "rgba(255,118,118,0.4)", color: COLORS.red, display: "flex", alignItems: "center", gap: 6 }}><Bluetooth size={14} /> Disconnect watch</button>
        ) : (
          <button onClick={onConnect} style={{ ...pillBtnStyle, display: "flex", alignItems: "center", gap: 6 }}><Bluetooth size={14} /> Connect watch via Bluetooth</button>
        )}
      </div>
      {bleStatus && <div style={{ textAlign: "center", fontSize: 12, color: COLORS.dim, marginTop: 6 }}>{bleStatus}</div>}
      {!bleConnected && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, color: COLORS.dim, textAlign: "center", marginBottom: 4, letterSpacing: 1 }}>OR DRAG TO LOG MANUALLY</div>
          <input type="range" min={0} max={200} value={manualHr} onChange={(e) => setManualHr(Number(e.target.value))} style={{ width: "100%", accentColor: COLORS.cyan }} />
        </div>
      )}
    </div>
  );
}

function ScreenHeader({ title }) {
  return <div style={{ textAlign: "center", padding: "46px 20px 20px" }}>
    <div style={{ fontSize: 24, fontWeight: 700, color: COLORS.white, letterSpacing: 2, fontFamily: DISPLAY_FONT, textTransform: "uppercase" }}>{title}</div>
  </div>;
}

function TableCard({ table, onPlay, onDelete }) {
  const { rounds, totalSeconds, maxHold } = tableStats(table);
  const maxVal = Math.max(...rounds.map((r) => r.hold));
  const isO2 = table.tableType === "O2";
  const badgeColor = isO2 ? COLORS.cyan : COLORS.green;
  return (
    <div style={{ ...glass, background: COLORS.bgCard, borderRadius: 22, padding: "22px 22px 20px", marginBottom: 16, border: "1px solid rgba(127,216,255,0.15)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ display: "inline-block", padding: "5px 11px", borderRadius: 8, fontSize: 12, fontWeight: 700, letterSpacing: 1, color: badgeColor, background: `${badgeColor}22`, fontFamily: DISPLAY_FONT }}>
          {table.tableType} TABLE {table.advanced && "\u00B7 ADV"}
        </span>
        {onDelete && <span onClick={onDelete} style={{ color: COLORS.red, cursor: "pointer", padding: 4 }}><Trash2 size={17} /></span>}
      </div>
      <div style={{ color: COLORS.white, fontWeight: 700, fontSize: 22, fontFamily: DISPLAY_FONT, marginTop: 10, marginBottom: 8 }}>{table.name}</div>
      <div style={{ display: "flex", gap: 18, color: COLORS.dim, fontSize: 13.5, marginBottom: 18, flexWrap: "wrap" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Layers size={14} /> {rounds.length} rounds</span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Clock size={14} /> {formatTime(totalSeconds)}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 5, color: badgeColor }}><TrendingUp size={14} /> max {formatTime(maxHold)}</span>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 34, marginBottom: 18 }}>
        {rounds.map((r, i) => {
          const h = 8 + (r.hold / maxVal) * 26;
          const t = i / Math.max(1, rounds.length - 1);
          const color = isO2
            ? `rgba(${79 + (127 - 79) * t}, ${195 + (216 - 195) * t}, ${247 + (255 - 247) * t}, ${0.5 + t * 0.5})`
            : `rgba(${79 + (127 - 79) * t}, ${200 + (232 - 200) * t}, ${150 + (168 - 150) * t}, ${0.5 + t * 0.5})`;
          return <div key={i} style={{ flex: 1, height: h, background: color, borderRadius: 3 }} />;
        })}
      </div>
      <button onClick={(e) => { const { x, y } = getEventXY(e); fireMiniBurst(x, y); onPlay(); }} style={{
        width: 48, height: 48, borderRadius: "50%", border: `1px solid ${badgeColor}66`, background: `${badgeColor}18`,
        color: badgeColor, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
      }}><Play size={19} fill={badgeColor} /></button>
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
function MiniStepper({ value, onDec, onInc }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <button onClick={onDec} style={{ ...circleBtnStyle, width: 26, height: 26 }}><Minus size={11} /></button>
      <div style={{ color: COLORS.white, fontWeight: 700, fontSize: 13, minWidth: 30, textAlign: "center", fontFamily: DISPLAY_FONT }}>{value}</div>
      <button onClick={onInc} style={{ ...circleBtnStyle, width: 26, height: 26 }}><Plus size={11} /></button>
    </div>
  );
}

function ConfirmModal({ title, body, confirmLabel, danger, onConfirm, onCancel }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(3,15,24,0.85)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ ...glass, background: "rgba(10,31,46,0.9)", borderRadius: 18, padding: 24, width: "100%", maxWidth: 340, border: "1px solid rgba(127,216,255,0.2)" }}>
        <div style={{ color: COLORS.white, fontWeight: 700, fontSize: 18, fontFamily: DISPLAY_FONT, marginBottom: 10 }}>{title}</div>
        <div style={{ color: COLORS.dim, fontSize: 14, marginBottom: 20, lineHeight: 1.4 }}>{body}</div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{ ...pillBtnStyle, flex: 1, textAlign: "center" }}>Cancel</button>
          <button onClick={onConfirm} style={{ ...pillBtnStyle, flex: 1, textAlign: "center", borderColor: danger ? "rgba(255,118,118,0.5)" : "rgba(127,216,255,0.5)", color: danger ? COLORS.red : COLORS.cyan, background: danger ? "rgba(255,118,118,0.15)" : "rgba(127,216,255,0.15)" }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

function DifficultyPicker({ onPick, onCancel }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(3,15,24,0.85)", zIndex: 50, display: "flex", alignItems: "flex-end" }}>
      <div style={{ ...glass, background: "rgba(10,31,46,0.9)", borderRadius: "20px 20px 0 0", padding: 22, width: "100%", border: "1px solid rgba(127,216,255,0.2)" }}>
        <div style={{ color: COLORS.white, fontWeight: 700, fontSize: 18, fontFamily: DISPLAY_FONT, marginBottom: 14, textAlign: "center" }}>Choose intensity</div>
        {Object.entries(DIFFICULTIES).map(([key, d]) => (
          <button key={key} onClick={(e) => { const { x, y } = getEventXY(e); fireMiniBurst(x, y); onPick(key); }} style={{
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

function Toast({ message }) {
  if (!message) return null;
  return (
    <div style={{
      position: "fixed", top: "calc(env(safe-area-inset-top) + 16px)", left: "50%", transform: "translateX(-50%)",
      zIndex: 60, ...glass, background: "rgba(127,216,255,0.18)", border: "1px solid rgba(127,216,255,0.4)",
      borderRadius: 14, padding: "10px 18px", display: "flex", alignItems: "center", gap: 8,
      color: COLORS.cyanBright, fontSize: 14, fontWeight: 600, animation: "toastIn 0.25s ease-out",
    }}>
      <Check size={16} /> {message}
    </div>
  );
}

function CalendarGrid({ history, selectedDate, onSelectDate }) {
  const now = new Date();
  const year = now.getFullYear(), month = now.getMonth();
  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const byDate = {};
  history.forEach((e) => { (byDate[e.date] = byDate[e.date] || []).push(e); });
  const monthName = now.toLocaleString("default", { month: "long" });
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div style={{ ...glass, background: COLORS.bgCard, borderRadius: 20, padding: 18, marginBottom: 20, border: "1px solid rgba(127,216,255,0.15)" }}>
      <div style={{ textAlign: "center", color: COLORS.white, fontWeight: 700, fontFamily: DISPLAY_FONT, letterSpacing: 1, marginBottom: 12 }}>{monthName} {year}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i} style={{ textAlign: "center", color: COLORS.dim, fontSize: 11, fontWeight: 600 }}>{d}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const entries = byDate[dateStr];
          const isToday = dateStr === todayKey();
          const isSelected = dateStr === selectedDate;
          let dotColor = null;
          if (entries) {
            const allDone = entries.every((e) => e.completed);
            const allFailed = entries.every((e) => !e.completed);
            dotColor = allDone ? COLORS.green : allFailed ? COLORS.red : COLORS.orange;
          }
          return (
            <button key={i} onClick={() => onSelectDate(entries ? dateStr : null)} style={{
              aspectRatio: "1", borderRadius: 10, border: isSelected ? `1px solid ${COLORS.cyan}` : isToday ? "1px solid rgba(127,216,255,0.4)" : "1px solid transparent",
              background: isSelected ? "rgba(127,216,255,0.15)" : "transparent", cursor: entries ? "pointer" : "default",
              color: COLORS.white, fontSize: 13, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, fontFamily: BODY_FONT,
            }}>
              <span>{d}</span>
              {dotColor && <span style={{ width: 5, height: 5, borderRadius: "50%", background: dotColor }} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const circleBtnStyle = {
  width: 38, height: 38, borderRadius: "50%", border: "1px solid rgba(127,216,255,0.3)",
  background: "rgba(127,216,255,0.1)", color: COLORS.cyan, cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
};
const primaryBtnStyle = {
  width: "100%", padding: "17px 0", borderRadius: 16, fontWeight: 700, fontSize: 16, letterSpacing: 1.5,
  border: "1px solid rgba(127,216,255,0.4)", background: "rgba(127,216,255,0.15)", color: COLORS.cyanBright,
  cursor: "pointer", fontFamily: DISPLAY_FONT, textTransform: "uppercase", ...glass,
};
const pillBtnStyle = {
  padding: "11px 18px", borderRadius: 20, fontWeight: 600, fontSize: 13, letterSpacing: 0.5,
  border: "1px solid rgba(127,216,255,0.35)", background: "rgba(127,216,255,0.1)", color: COLORS.cyan,
  cursor: "pointer", fontFamily: BODY_FONT, ...glass,
};
const circleBtnStyleBig = {
  width: 58, height: 58, borderRadius: "50%", border: "1px solid rgba(127,216,255,0.3)",
  background: "rgba(127,216,255,0.1)", color: COLORS.cyan, fontWeight: 700, fontSize: 14, cursor: "pointer",
  fontFamily: DISPLAY_FONT,
};
const tabBarStyle = {
  position: "fixed", bottom: 0, left: 0, right: 0, display: "flex", background: "rgba(10,31,46,0.75)",
  borderTop: "1px solid rgba(127,216,255,0.15)", paddingBottom: "env(safe-area-inset-bottom)", zIndex: 10, ...glass,
};
function TabButton({ active, label, Icon, onClick }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, background: "none", border: "none", padding: "13px 0 11px", cursor: "pointer",
      color: active ? COLORS.cyanBright : COLORS.dim, display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
    }}>
      <Icon size={21} strokeWidth={active ? 2.4 : 1.8} />
      <span style={{ fontSize: 11.5, fontFamily: DISPLAY_FONT, letterSpacing: 1, textTransform: "uppercase" }}>{label}</span>
    </button>
  );
}
function ToggleRow({ label, sub, checked, onChange }) {
  return (
    <div style={{ ...glass, display: "flex", alignItems: "center", justifyContent: "space-between", background: COLORS.bgCard, borderRadius: 16, padding: "17px 19px", marginBottom: 12, border: "1px solid rgba(127,216,255,0.12)" }}>
      <div>
        <div style={{ color: COLORS.white, fontWeight: 600, fontSize: 16 }}>{label}</div>
        {sub && <div style={{ color: COLORS.dim, fontSize: 12.5, marginTop: 2 }}>{sub}</div>}
      </div>
      <button onClick={() => onChange(!checked)} style={{
        width: 48, height: 27, borderRadius: 14, border: "none", cursor: "pointer", position: "relative",
        background: checked ? "rgba(127,216,255,0.4)" : "rgba(255,255,255,0.1)", transition: "background 0.2s",
      }}>
        <div style={{ position: "absolute", top: 3, left: checked ? 24 : 3, width: 21, height: 21, borderRadius: "50%", background: checked ? COLORS.cyanBright : COLORS.dim, transition: "left 0.2s" }} />
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
  const clear = useCallback(() => { setPressing(false); if (timer.current) clearTimeout(timer.current); }, []);
  return { pressing, handlers: { onMouseDown: start, onMouseUp: clear, onMouseLeave: clear, onTouchStart: start, onTouchEnd: clear } };
}

// ---------------------------------------------------------------------------
// Custom table creation modal - simple mode (with optional PR-based prefill and
// an editable increment) or advanced mode (explicit per-round editing).
// ---------------------------------------------------------------------------
function CustomTableModal({ prSeconds, onAdd, onCancel }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("O2");
  const [rounds, setRounds] = useState(8);
  const [breathe, setBreathe] = useState(120);
  const [hold, setHold] = useState(60);
  const [step, setStep] = useState(15);
  const [advanced, setAdvanced] = useState(false);
  const [customRounds, setCustomRounds] = useState(null);

  const applyPrBase = () => {
    if (prSeconds <= 0) return;
    setHold(Math.max(15, Math.round(prSeconds * 0.5)));
    setStep(Math.max(5, Math.round(prSeconds * (type === "O2" ? 0.08 : 0.06))));
    setBreathe(type === "O2" ? 120 : 150);
  };

  const enterAdvanced = () => {
    const plan = computeRoundPreview({ tableType: type, baseHold: hold, baseBreathe: breathe, step, rounds });
    setCustomRounds(plan);
    setAdvanced(true);
  };
  const backToSimple = () => setAdvanced(false);

  const addRound = () => setCustomRounds((r) => [...r, { ...r[r.length - 1] }]);
  const removeRound = (i) => setCustomRounds((r) => r.filter((_, idx) => idx !== i));
  const updateRound = (i, field, delta) => setCustomRounds((r) => r.map((rd, idx) => idx === i ? { ...rd, [field]: Math.max(5, rd[field] + delta) } : rd));

  const handleAdd = () => {
    if (advanced) {
      onAdd({ id: uid(), name: name.trim() || "Custom table", tableType: type, advanced: true, customRounds });
    } else {
      onAdd({ id: uid(), name: name.trim() || "Custom table", tableType: type, baseHold: hold, baseBreathe: breathe, step, rounds });
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(3,15,24,0.92)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, overflowY: "auto" }}>
      <div style={{ ...glass, background: "rgba(10,31,46,0.92)", borderRadius: 18, padding: 22, width: "100%", maxWidth: 380, border: "1px solid rgba(127,216,255,0.2)", maxHeight: "88vh", overflowY: "auto" }}>
        <div style={{ color: COLORS.white, fontWeight: 700, fontSize: 17, fontFamily: DISPLAY_FONT, marginBottom: 14, textAlign: "center", letterSpacing: 1 }}>
          {advanced ? "CUSTOMIZE ROUNDS" : "NEW CUSTOM TABLE"}
        </div>

        {!advanced && (
          <>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Table name" style={{
              width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(127,216,255,0.3)",
              background: "rgba(255,255,255,0.04)", color: COLORS.white, fontSize: 15, marginBottom: 12, fontFamily: BODY_FONT,
            }} />
            <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              {["O2", "CO2"].map((tt) => (
                <button key={tt} onClick={() => setType(tt)} style={{
                  flex: 1, padding: "12px 0", borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: DISPLAY_FONT,
                  border: type === tt ? `1px solid ${COLORS.cyan}` : "1px solid rgba(127,216,255,0.15)",
                  background: type === tt ? "rgba(127,216,255,0.15)" : "transparent", color: type === tt ? COLORS.cyanBright : COLORS.dim,
                }}>{tt}</button>
              ))}
            </div>
            {prSeconds > 0 && (
              <button onClick={applyPrBase} style={{ ...pillBtnStyle, width: "100%", textAlign: "center", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <Star size={13} /> Base on my PR ({formatTime(prSeconds)})
              </button>
            )}
            <Stepper label="Rounds" value={rounds} onDec={() => setRounds((v) => Math.max(1, v - 1))} onInc={() => setRounds((v) => v + 1)} />
            <Stepper label="Breathe (s)" value={breathe} onDec={() => setBreathe((v) => Math.max(15, v - 5))} onInc={() => setBreathe((v) => v + 5)} />
            <Stepper label="Hold (s)" value={hold} onDec={() => setHold((v) => Math.max(15, v - 5))} onInc={() => setHold((v) => v + 5)} />
            <Stepper label="Increment (s)" value={step} onDec={() => setStep((v) => Math.max(5, v - 5))} onInc={() => setStep((v) => v + 5)} />
            <button onClick={enterAdvanced} style={{ ...pillBtnStyle, width: "100%", textAlign: "center", marginTop: 4, marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <ListPlus size={14} /> Customize each round
            </button>
          </>
        )}

        {advanced && customRounds && (
          <>
            <div style={{ maxHeight: 280, overflowY: "auto", marginBottom: 12 }}>
              {customRounds.map((r, i) => (
                <div key={i} style={{ background: COLORS.bgCardHi, borderRadius: 12, padding: "10px 12px", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ color: COLORS.dim, fontSize: 12, fontWeight: 700, minWidth: 46 }}>R{i + 1}</div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                    <div style={{ color: COLORS.dim, fontSize: 9, letterSpacing: 0.5 }}>BREATHE</div>
                    <MiniStepper value={r.breathe} onDec={() => updateRound(i, "breathe", -5)} onInc={() => updateRound(i, "breathe", 5)} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                    <div style={{ color: COLORS.dim, fontSize: 9, letterSpacing: 0.5 }}>HOLD</div>
                    <MiniStepper value={r.hold} onDec={() => updateRound(i, "hold", -5)} onInc={() => updateRound(i, "hold", 5)} />
                  </div>
                  {customRounds.length > 1 && <span onClick={() => removeRound(i)} style={{ color: COLORS.red, cursor: "pointer", padding: 4 }}><Trash2 size={14} /></span>}
                </div>
              ))}
            </div>
            <button onClick={addRound} style={{ ...pillBtnStyle, width: "100%", textAlign: "center", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <Plus size={14} /> Add round
            </button>
            <button onClick={backToSimple} style={{ ...pillBtnStyle, width: "100%", textAlign: "center", marginBottom: 14 }}>Back to simple mode</button>
          </>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{ ...pillBtnStyle, flex: 1, textAlign: "center" }}>Cancel</button>
          <button onClick={handleAdd} style={{ ...pillBtnStyle, flex: 1, textAlign: "center", background: "rgba(127,216,255,0.2)" }}>Add</button>
        </div>
      </div>
    </div>
  );
}

function PrEditSheet({ initial, onSave, onCancel }) {
  const [draft, setDraft] = useState(initial);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(3,15,24,0.85)", zIndex: 50, display: "flex", alignItems: "flex-end" }}>
      <div style={{ ...glass, background: "rgba(10,31,46,0.92)", borderRadius: "20px 20px 0 0", padding: 24, width: "100%", border: "1px solid rgba(127,216,255,0.2)" }}>
        <div style={{ color: COLORS.white, fontWeight: 700, fontSize: 17, fontFamily: DISPLAY_FONT, marginBottom: 18, textAlign: "center", letterSpacing: 1 }}>SET PERSONAL BEST</div>
        <div style={{ textAlign: "center", fontSize: 56, fontWeight: 700, color: COLORS.white, fontFamily: DISPLAY_FONT, fontVariantNumeric: "tabular-nums", marginBottom: 20 }}>{formatTime(draft)}</div>
        <div style={{ display: "flex", justifyContent: "center", gap: 14, marginBottom: 22 }}>
          <button onClick={() => setDraft((v) => Math.max(5, v - 30))} style={circleBtnStyleBig}>&#8722;30</button>
          <button onClick={() => setDraft((v) => Math.max(5, v - 5))} style={circleBtnStyleBig}>&#8722;5</button>
          <button onClick={() => setDraft((v) => v + 5)} style={circleBtnStyleBig}>&#43;5</button>
          <button onClick={() => setDraft((v) => v + 30)} style={circleBtnStyleBig}>&#43;30</button>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{ ...pillBtnStyle, flex: 1, textAlign: "center" }}>Cancel</button>
          <button onClick={() => onSave(draft)} style={{ ...pillBtnStyle, flex: 1, textAlign: "center", background: "rgba(127,216,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Check size={14} /> Save</button>
        </div>
      </div>
    </div>
  );
}

const STATUS_CYCLE = ["none", "good", "work", "na"];
const STATUS_META = {
  none: { label: "Tap to set", color: COLORS.dim, bg: "rgba(255,255,255,0.04)" },
  good: { label: "Bon", color: COLORS.green, bg: "rgba(127,232,168,0.15)" },
  work: { label: "\u00C0 travailler", color: COLORS.orange, bg: "rgba(244,177,63,0.15)" },
  na: { label: "N/A", color: COLORS.dim, bg: "rgba(255,255,255,0.06)" },
};

function DiveItemRow({ item, status, note, onCycle, onNoteChange }) {
  const [showNote, setShowNote] = useState(!!note);
  const meta = STATUS_META[status || "none"];
  return (
    <div style={{ background: COLORS.bgCardHi, borderRadius: 14, padding: "12px 14px", marginBottom: 8 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <button onClick={onCycle} style={{
          flexShrink: 0, marginTop: 1, minWidth: 84, padding: "6px 10px", borderRadius: 10, border: `1px solid ${meta.color}55`,
          background: meta.bg, color: meta.color, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: DISPLAY_FONT, letterSpacing: 0.5,
        }}>{meta.label}</button>
        <div style={{ flex: 1 }}>
          <div style={{ color: COLORS.white, fontSize: 13.5, lineHeight: 1.4 }}>{item.text}</div>
          <div style={{ color: COLORS.dim, fontSize: 11, marginTop: 4, fontStyle: "italic" }}>{item.influence}</div>
          {showNote ? (
            <textarea value={note || ""} onChange={(e) => onNoteChange(e.target.value)} placeholder="Note personnelle..." rows={2} style={{
              width: "100%", marginTop: 8, padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(127,216,255,0.2)",
              background: "rgba(255,255,255,0.03)", color: COLORS.white, fontSize: 12.5, fontFamily: BODY_FONT, resize: "vertical",
            }} />
          ) : (
            <button onClick={() => setShowNote(true)} style={{ background: "none", border: "none", color: COLORS.cyan, fontSize: 11.5, marginTop: 6, cursor: "pointer", padding: 0 }}>+ ajouter une note</button>
          )}
        </div>
      </div>
    </div>
  );
}

function PhaseAccordion({ phase, expanded, onToggle, statuses, notes, onCycle, onNoteChange }) {
  const doneCount = phase.items.filter((it) => statuses[it.id] && statuses[it.id] !== "none").length;
  return (
    <div style={{ ...glass, background: COLORS.bgCard, borderRadius: 16, marginBottom: 12, border: "1px solid rgba(127,216,255,0.12)", overflow: "hidden" }}>
      <button onClick={onToggle} style={{ width: "100%", padding: "16px 18px", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ color: COLORS.white, fontWeight: 700, fontSize: 14.5, fontFamily: DISPLAY_FONT, textAlign: "left" }}>{phase.title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: COLORS.dim, fontSize: 11.5 }}>{doneCount}/{phase.items.length}</span>
          {expanded ? <ChevronUp size={16} color={COLORS.dim} /> : <ChevronDown size={16} color={COLORS.dim} />}
        </div>
      </button>
      {expanded && (
        <div style={{ padding: "0 14px 14px" }}>
          {phase.items.map((item) => (
            <DiveItemRow key={item.id} item={item} status={statuses[item.id]} note={notes[item.id]}
              onCycle={() => onCycle(item.id)} onNoteChange={(v) => onNoteChange(item.id, v)} />
          ))}
        </div>
      )}
    </div>
  );
}

function DiveLogForm({ onSave, onCancel }) {
  const [date, setDate] = useState(todayKey());
  const [location, setLocation] = useState("");
  const [depth, setDepth] = useState("");
  const [statuses, setStatuses] = useState({});
  const [notes, setNotes] = useState({});
  const [expandedPhase, setExpandedPhase] = useState("p1");
  const [objective, setObjective] = useState("");
  const [blocker, setBlocker] = useState("");
  const [gear, setGear] = useState("");

  const cycleStatus = (itemId) => {
    setStatuses((s) => {
      const current = s[itemId] || "none";
      const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(current) + 1) % STATUS_CYCLE.length];
      return { ...s, [itemId]: next };
    });
  };
  const updateNote = (itemId, value) => setNotes((n) => ({ ...n, [itemId]: value }));

  const handleSave = () => {
    onSave({ id: uid(), date, location: location.trim(), depth: depth ? Number(depth) : null, statuses, notes, objective: objective.trim(), blocker: blocker.trim(), gear: gear.trim(), timestamp: Date.now() });
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "22px 22px 4px" }}>
        <button onClick={onCancel} style={{ background: "none", border: "none", color: COLORS.dim, cursor: "pointer" }}><X size={24} /></button>
        <div style={{ color: COLORS.cyan, fontWeight: 700, fontFamily: DISPLAY_FONT, letterSpacing: 2, fontSize: 15 }}>LOGGER UNE PLONGÉE</div>
        <div style={{ width: 24 }} />
      </div>
      <div style={{ padding: "12px 20px 100px", overflowY: "auto" }}>
        <div style={{ ...glass, background: COLORS.bgCard, borderRadius: 16, padding: 16, marginBottom: 16, border: "1px solid rgba(127,216,255,0.12)" }}>
          <div style={{ color: COLORS.dim, fontSize: 11, letterSpacing: 1, marginBottom: 6 }}>DATE</div>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{
            width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(127,216,255,0.3)",
            background: "rgba(255,255,255,0.04)", color: COLORS.white, fontSize: 14, fontFamily: BODY_FONT, marginBottom: 12, colorScheme: "dark",
          }} />
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ color: COLORS.dim, fontSize: 11, letterSpacing: 1, marginBottom: 6 }}>LIEU (OPTIONNEL)</div>
              <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Lac, mer..." style={{
                width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(127,216,255,0.3)",
                background: "rgba(255,255,255,0.04)", color: COLORS.white, fontSize: 14, fontFamily: BODY_FONT,
              }} />
            </div>
            <div style={{ width: 100 }}>
              <div style={{ color: COLORS.dim, fontSize: 11, letterSpacing: 1, marginBottom: 6 }}>PROF. (M)</div>
              <input value={depth} onChange={(e) => setDepth(e.target.value.replace(/[^0-9]/g, ""))} placeholder="0" inputMode="numeric" style={{
                width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(127,216,255,0.3)",
                background: "rgba(255,255,255,0.04)", color: COLORS.white, fontSize: 14, fontFamily: BODY_FONT,
              }} />
            </div>
          </div>
        </div>

        {DIVE_PHASES.map((phase) => (
          <PhaseAccordion key={phase.id} phase={phase} expanded={expandedPhase === phase.id}
            onToggle={() => setExpandedPhase(expandedPhase === phase.id ? null : phase.id)}
            statuses={statuses} notes={notes} onCycle={cycleStatus} onNoteChange={updateNote} />
        ))}

        <div style={{ ...glass, background: COLORS.bgCard, borderRadius: 16, padding: 16, marginTop: 4, border: "1px solid rgba(244,177,63,0.25)" }}>
          <div style={{ color: COLORS.orange, fontWeight: 700, fontSize: 14.5, fontFamily: DISPLAY_FONT, marginBottom: 12 }}>Phase 8 — Projection & prochaine séance</div>
          <div style={{ color: COLORS.dim, fontSize: 11.5, marginBottom: 6 }}>OBJECTIF PRIORITAIRE (focus unique pour la prochaine fois)</div>
          <textarea value={objective} onChange={(e) => setObjective(e.target.value)} rows={2} style={{
            width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(127,216,255,0.3)",
            background: "rgba(255,255,255,0.04)", color: COLORS.white, fontSize: 13.5, fontFamily: BODY_FONT, marginBottom: 12, resize: "vertical",
          }} />
          <div style={{ color: COLORS.dim, fontSize: 11.5, marginBottom: 6 }}>PRINCIPAL FACTEUR LIMITANT (mental, technique, physique, froid...)</div>
          <textarea value={blocker} onChange={(e) => setBlocker(e.target.value)} rows={2} style={{
            width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(127,216,255,0.3)",
            background: "rgba(255,255,255,0.04)", color: COLORS.white, fontSize: 13.5, fontFamily: BODY_FONT, marginBottom: 12, resize: "vertical",
          }} />
          <div style={{ color: COLORS.dim, fontSize: 11.5, marginBottom: 6 }}>AJUSTEMENT MATÉRIEL / LESTE</div>
          <textarea value={gear} onChange={(e) => setGear(e.target.value)} rows={2} style={{
            width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(127,216,255,0.3)",
            background: "rgba(255,255,255,0.04)", color: COLORS.white, fontSize: 13.5, fontFamily: BODY_FONT, resize: "vertical",
          }} />
        </div>
      </div>
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "14px 20px calc(env(safe-area-inset-bottom) + 14px)", ...glass, background: "rgba(3,15,24,0.85)", borderTop: "1px solid rgba(127,216,255,0.15)" }}>
        <button onClick={handleSave} style={{ ...primaryBtnStyle, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Check size={17} /> Enregistrer la plongée</button>
      </div>
    </div>
  );
}

function DiveFocusCard({ entry }) {
  const summary = computeFocusSummary(entry);
  if (!summary) {
    return (
      <div style={{ ...glass, background: COLORS.bgCard, borderRadius: 18, padding: 20, marginBottom: 18, border: "1px solid rgba(127,216,255,0.15)", textAlign: "center" }}>
        <Waves size={22} color={COLORS.cyan} style={{ marginBottom: 8 }} />
        <div style={{ color: COLORS.dim, fontSize: 13.5 }}>Aucune plongée loggée pour l'instant. Ton premier mémo apparaîtra ici.</div>
      </div>
    );
  }
  return (
    <div style={{ ...glass, background: COLORS.bgCard, borderRadius: 18, padding: 20, marginBottom: 18, border: "1px solid rgba(127,216,255,0.2)" }}>
      <div style={{ color: COLORS.cyan, fontWeight: 700, fontSize: 13, letterSpacing: 1.5, fontFamily: DISPLAY_FONT, marginBottom: 12 }}>FOCUS POUR LA PROCHAINE PLONGÉE</div>
      {summary.objective && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ color: COLORS.dim, fontSize: 11 }}>Objectif</div>
          <div style={{ color: COLORS.white, fontSize: 14 }}>{summary.objective}</div>
        </div>
      )}
      {summary.blocker && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ color: COLORS.dim, fontSize: 11 }}>Facteur limitant</div>
          <div style={{ color: COLORS.white, fontSize: 14 }}>{summary.blocker}</div>
        </div>
      )}
      {summary.workItems.length > 0 && (
        <div>
          <div style={{ color: COLORS.dim, fontSize: 11, marginBottom: 4 }}>À travailler</div>
          {summary.workItems.map((t, i) => (
            <div key={i} style={{ color: COLORS.orange, fontSize: 12.5, marginBottom: 3, display: "flex", gap: 6 }}>
              <span>&#8226;</span><span>{t}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
export default function App() {
  const [screen, setScreen] = useState("train");
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState(null);
  const showToast = (msg) => setToast(msg);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2200); return () => clearTimeout(t); }, [toast]);

  const [prSeconds, setPrSeconds] = useState(0);
  const [customTables, setCustomTables] = useState([]);
  const [history, setHistory] = useState([]);
  const [diveLog, setDiveLog] = useState([]);
  const [hapticsOn, setHapticsOn] = useState(true);
  const [prBreatheSeconds, setPrBreatheSeconds] = useState(120);
  const [selectedDate, setSelectedDate] = useState(null);
  const [showPrEdit, setShowPrEdit] = useState(false);

  useEffect(() => {
    (async () => {
      const pr = await loadStored("apnea_pr", { seconds: 0 });
      const cust = await loadStored("apnea_custom_tables", []);
      const hist = await loadStored("apnea_history", []);
      const dives = await loadStored("apnea_dive_log", []);
      const settings = await loadStored("apnea_settings", { haptics: true });
      setPrSeconds(pr.seconds || 0);
      setCustomTables(Array.isArray(cust) ? cust : []);
      setHistory(Array.isArray(hist) ? hist : []);
      setDiveLog(Array.isArray(dives) ? dives : []);
      setHapticsOn(settings.haptics !== false);
      setHapticsEnabled(settings.haptics !== false);
      setPrBreatheSeconds(settings.prBreatheSeconds || 120);
      setLoaded(true);
    })();
  }, []);
  useEffect(() => { if (loaded) saveStored("apnea_pr", { seconds: prSeconds }); }, [prSeconds, loaded]);
  useEffect(() => { if (loaded) saveStored("apnea_custom_tables", customTables); }, [customTables, loaded]);
  useEffect(() => { if (loaded) saveStored("apnea_history", history); }, [history, loaded]);
  useEffect(() => { if (loaded) saveStored("apnea_dive_log", diveLog); }, [diveLog, loaded]);
  useEffect(() => { if (loaded) { saveStored("apnea_settings", { haptics: hapticsOn, prBreatheSeconds }); setHapticsEnabled(hapticsOn); } }, [hapticsOn, prBreatheSeconds, loaded]);

  const logHistory = useCallback((entry) => setHistory((h) => [{ id: uid(), date: todayKey(), timestamp: Date.now(), ...entry }, ...h]), []);
  const deleteHistoryEntry = useCallback((id) => setHistory((h) => h.filter((e) => e.id !== id)), []);

  const prAttemptStats = (() => {
    const attempts = history.filter((e) => e.type === "pr");
    return { count: attempts.length, last: attempts[0] || null };
  })();

  const [hr, setHr] = useState(0);
  const [minHr, setMinHr] = useState(0);
  const [maxHr, setMaxHr] = useState(0);
  const [bleConnected, setBleConnected] = useState(false);
  const [bleStatus, setBleStatus] = useState("");
  const logHr = useCallback((v) => {
    setHr(v);
    if (v > 0) { setMinHr((m) => (m === 0 || v < m ? v : m)); setMaxHr((m) => (v > m ? v : m)); }
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
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [confirmClearHistory, setConfirmClearHistory] = useState(false);
  const [confirmResetPr, setConfirmResetPr] = useState(false);

  const addCustomTable = (t) => {
    setCustomTables((c) => [...c, t]);
    setShowCustomModal(false);
    showToast("Custom table added");
  };

  const saveDiveEntry = (entry) => {
    setDiveLog((d) => [entry, ...d]);
    setScreen("diving");
    showToast("Plong\u00E9e enregistr\u00E9e");
  };
  const deleteDiveEntry = (id) => setDiveLog((d) => d.filter((e) => e.id !== id));

  const [pendingTable, setPendingTable] = useState(null);
  const tpList = () => [autoTable("O2", prSeconds), autoTable("CO2", prSeconds), ...customTables];

  const [sTable, setSTable] = useState(null);
  const [sDifficulty, setSDifficulty] = useState("normal");
  const [sRoundsPlan, setSRoundsPlan] = useState([]);
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
    const plan = computeRoundPreview(table).map((r) => ({ hold: Math.round(r.hold * d.holdMul), breathe: Math.round(r.breathe * d.breatheMul) }));
    setSTable(table); setSDifficulty(difficulty); setSRoundsPlan(plan); setSRound(1);
    setSHoldTime(plan[0].hold); setSBreatheTime(plan[0].breathe);
    setSPhase("ready"); setSTimer(plan[0].breathe); setSRunning(false); setSContractions(0);
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
        if (nextRound > sRoundsPlan.length) {
          setSRunning(false); setSPhase("done"); setSBurst((n) => n + 1);
          logHistory({ type: "table", name: sTable.name, difficulty: sDifficulty, completed: true, failedRound: null });
        } else {
          const next = sRoundsPlan[nextRound - 1];
          setSHoldTime(next.hold); setSBreatheTime(next.breathe); setSRound(nextRound); setSPhase("breathe"); setSTimer(next.breathe);
        }
      }
    }, 1000);
    return () => clearTimeout(id);
  }, [screen, sRunning, sTimer, sPhase, sHoldTime, sBreatheTime, sRound, sTable, sDifficulty, sRoundsPlan, logHistory]);

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
    setPaMode("breathe"); setPaTimer(prBreatheSeconds); setPaElapsed(0); setPaContractions(0); setPaIsPR(false);
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

  const goTab = (tab) => { setScreen(tab); setSelectedDate(null); };

  if (!loaded) {
    return (
      <div style={{ width: "100%", minHeight: "100vh", background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Heart size={44} color={COLORS.red} fill={COLORS.red} style={{ animation: "pulseFade 1.4s ease-in-out infinite" }} />
      </div>
    );
  }

  const sessionTintActive = screen === "session" || screen === "prattempt";
  const sessionTintMode = screen === "session" ? (sPhase === "hold" ? "hold" : "breathe") : screen === "prattempt" ? (paMode === "attempt" ? "hold" : "breathe") : null;

  return (
    <div style={{ width: "100%", minHeight: "100vh", background: COLORS.bg, position: "relative", fontFamily: BODY_FONT, paddingTop: "env(safe-area-inset-top)" }}>
      <PhaseTint active={sessionTintActive} mode={sessionTintMode} />
      <Bubbles />
      <Toast message={toast} />
      <MiniBurstLayer />
      <div key={screen} style={{ position: "relative", zIndex: 1, minHeight: "100vh", display: "flex", flexDirection: "column", paddingBottom: ["train", "pr", "history", "diving", "settings"].includes(screen) ? 90 : 0, animation: "fadeIn 0.25s ease-out" }}>

        {screen === "train" && (
          <>
            <div style={{ textAlign: "center", padding: "44px 20px 22px" }}>
              <div style={{ fontSize: 30, fontWeight: 700, color: COLORS.white, letterSpacing: 3, fontFamily: DISPLAY_FONT, textTransform: "uppercase" }}>Apnea Trainer</div>
              <div style={{ fontSize: 13, color: COLORS.dim, marginTop: 8, letterSpacing: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                {prSeconds > 0 ? <><Star size={13} fill={COLORS.orange} color={COLORS.orange} /> PERSONAL BEST &middot; {formatTime(prSeconds)}</> : "NO PR SET YET"}
              </div>
            </div>
            <div style={{ padding: "0 20px" }}>
              {tpList().map((t) => (
                <TableCard key={t.id} table={t} onPlay={() => setPendingTable(t)}
                  onDelete={customTables.find((c) => c.id === t.id) ? () => setDeleteTarget({ kind: "custom", id: t.id }) : null} />
              ))}
              <button onClick={(e) => { const { x, y } = getEventXY(e); fireMiniBurst(x, y); setShowCustomModal(true); }} style={{ ...primaryBtnStyle, marginTop: 8, background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <Plus size={17} /> New custom table
              </button>
            </div>
          </>
        )}

        {screen === "pr" && (
          <>
            <ScreenHeader title="Personal Best" />
            <div style={{ padding: "10px 20px", textAlign: "center" }}>
              <Star size={30} fill={COLORS.orange} color={COLORS.orange} style={{ marginBottom: 8 }} />
              <div style={{ fontSize: 60, fontWeight: 700, color: COLORS.white, fontFamily: DISPLAY_FONT, fontVariantNumeric: "tabular-nums" }}>{prSeconds > 0 ? formatTime(prSeconds) : "--:--"}</div>
              <button onClick={() => setShowPrEdit(true)} style={{ ...pillBtnStyle, marginTop: 14, display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Pencil size={13} /> Edit
              </button>
              <div style={{ marginTop: 10 }}>
                <button onClick={async () => { const ok = await testVibrate(); showToast(ok ? "Vibration triggered - did you feel it?" : "Vibration call failed"); }} style={{ ...pillBtnStyle, display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Zap size={13} /> Test vibration
                </button>
              </div>

              {prAttemptStats.count > 0 && (
                <div style={{ color: COLORS.dim, fontSize: 13, marginTop: 18 }}>
                  {prAttemptStats.count} attempt{prAttemptStats.count !== 1 ? "s" : ""} logged
                  {prAttemptStats.last && ` \u00B7 last: ${formatTime(prAttemptStats.last.duration)}`}
                </div>
              )}

              <button onClick={(e) => { const { x, y } = getEventXY(e); fireMiniBurst(x, y); startPrAttempt(); }} style={{ ...primaryBtnStyle, marginTop: 26, background: "rgba(127,232,168,0.18)", borderColor: "rgba(127,232,168,0.45)", color: COLORS.greenBright, fontSize: 17, padding: "20px 0" }}>
                Start PR attempt
              </button>
            </div>
          </>
        )}

        {screen === "history" && (
          <>
            <ScreenHeader title="History" />
            <div style={{ padding: "0 20px" }}>
              <CalendarGrid history={history} selectedDate={selectedDate} onSelectDate={setSelectedDate} />
              {(() => {
                const dateToShow = selectedDate || todayKey();
                const entries = history.filter((e) => e.date === dateToShow);
                return (
                  <>
                    <div style={{ color: COLORS.dim, fontSize: 13, letterSpacing: 1, marginBottom: 10 }}>{selectedDate ? selectedDate : "TODAY"}</div>
                    {entries.length === 0 && <div style={{ color: COLORS.dim, textAlign: "center", marginTop: 10, marginBottom: 10 }}>No sessions this day</div>}
                    {entries.map((e) => (
                      <div key={e.id} style={{ ...glass, background: COLORS.bgCard, borderRadius: 14, padding: "14px 16px", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid rgba(127,216,255,0.1)" }}>
                        <div>
                          <div style={{ color: COLORS.white, fontWeight: 600, fontSize: 14.5 }}>
                            {e.name} {e.difficulty && e.difficulty !== "normal" && (
                              <span style={{ color: DIFFICULTIES[e.difficulty].color, fontSize: 11, marginLeft: 6 }}>{DIFFICULTIES[e.difficulty].emoji} {DIFFICULTIES[e.difficulty].label}</span>
                            )}
                            {e.isPR && <span style={{ color: COLORS.green, fontSize: 11, marginLeft: 6 }}>&#9733; PR</span>}
                          </div>
                          {!e.completed && <div style={{ color: COLORS.red, fontSize: 11.5, marginTop: 3 }}>FAILED &middot; surfaced on round {e.failedRound}</div>}
                          {e.duration != null && <div style={{ color: COLORS.dim, fontSize: 11.5, marginTop: 3 }}>{formatTime(e.duration)}</div>}
                        </div>
                        <span onClick={() => setDeleteTarget({ kind: "history", id: e.id })} style={{ color: COLORS.red, cursor: "pointer", padding: 6 }}><Trash2 size={17} /></span>
                      </div>
                    ))}
                  </>
                );
              })()}
            </div>
          </>
        )}

        {screen === "diving" && (
          <>
            <ScreenHeader title="Diving" />
            <div style={{ padding: "0 20px" }}>
              <DiveFocusCard entry={diveLog[0]} />
              <button onClick={(e) => { const { x, y } = getEventXY(e); fireMiniBurst(x, y); setScreen("divelogform"); }} style={{ ...primaryBtnStyle, marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <Plus size={17} /> Logger une plongée
              </button>
              {diveLog.length > 0 && <div style={{ color: COLORS.dim, fontSize: 12, letterSpacing: 1, marginBottom: 10 }}>HISTORIQUE</div>}
              {diveLog.map((entry) => {
                const work = countWork(entry);
                const dotColor = work === 0 ? COLORS.green : work <= 2 ? COLORS.orange : COLORS.red;
                return (
                  <div key={entry.id} style={{ ...glass, background: COLORS.bgCard, borderRadius: 14, padding: "14px 16px", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between", border: "1px solid rgba(127,216,255,0.1)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 9, height: 9, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
                      <div>
                        <div style={{ color: COLORS.white, fontWeight: 600, fontSize: 14 }}>{entry.date}{entry.location && ` \u00B7 ${entry.location}`}</div>
                        <div style={{ color: COLORS.dim, fontSize: 11.5, marginTop: 2 }}>
                          {entry.depth ? `${entry.depth}m \u00B7 ` : ""}{work} à travailler
                        </div>
                      </div>
                    </div>
                    <span onClick={() => setDeleteTarget({ kind: "dive", id: entry.id })} style={{ color: COLORS.red, cursor: "pointer", padding: 6 }}><Trash2 size={16} /></span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {screen === "divelogform" && (
          <DiveLogForm onSave={saveDiveEntry} onCancel={() => setScreen("diving")} />
        )}

        {screen === "settings" && (
          <>
            <ScreenHeader title="Settings" />
            <div style={{ padding: "0 20px" }}>
              <ToggleRow label="Haptics" sub="Vibration cues during sessions" checked={hapticsOn} onChange={setHapticsOn} />
              <Stepper label="PR breathe-up (s)" value={prBreatheSeconds} onDec={() => setPrBreatheSeconds((v) => Math.max(15, v - 10))} onInc={() => setPrBreatheSeconds((v) => v + 10)} />
              <div style={{ height: 4 }} />
              <button onClick={() => setConfirmResetPr(true)} style={{ ...primaryBtnStyle, marginBottom: 12, background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <RotateCcw size={16} /> Reset personal best
              </button>
              <button onClick={() => setConfirmClearHistory(true)} style={{ ...primaryBtnStyle, background: "rgba(255,118,118,0.12)", borderColor: "rgba(255,118,118,0.3)", color: COLORS.red, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                <Trash2 size={16} /> Clear history
              </button>
              <div style={{ textAlign: "center", marginTop: 32, color: COLORS.dim, fontSize: 12.5, lineHeight: 1.6 }}>
                Apnea Trainer<br />Built for CO2/O2 tables, PR attempts, and live watch HR
              </div>
            </div>
          </>
        )}

        {screen === "session" && sTable && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "22px 22px 4px" }}>
              <button onClick={() => setShowExitConfirm(true)} style={{ background: "none", border: "none", color: COLORS.dim, cursor: "pointer" }}><X size={24} /></button>
              <div style={{ textAlign: "center" }}>
                <div style={{ color: COLORS.dim, fontSize: 12.5 }}>{sTable.name}</div>
                <div style={{ color: COLORS.cyan, fontWeight: 700, fontFamily: DISPLAY_FONT, letterSpacing: 2, fontSize: 15 }}>{sPhase === "done" ? "COMPLETE" : `ROUND ${sRound}/${sRoundsPlan.length}`}</div>
              </div>
              <div style={{ width: 24 }} />
            </div>
            {sDifficulty !== "normal" && (
              <div style={{ textAlign: "center", color: DIFFICULTIES[sDifficulty].color, fontSize: 12.5, fontWeight: 700, letterSpacing: 2, marginBottom: 4 }}>
                {DIFFICULTIES[sDifficulty].emoji} {DIFFICULTIES[sDifficulty].label.toUpperCase()}
              </div>
            )}

            <div
              style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "10px 20px", touchAction: "manipulation" }}
              onDoubleClick={skipToHold}
              onTouchEnd={(e) => { const now = Date.now(); if (now - (e.currentTarget._lastTap || 0) < 300) skipToHold(); e.currentTarget._lastTap = now; }}
              {...(sPhase === "hold" ? contractionLongPress.handlers : {})}
            >
              <div style={{ position: "relative" }}>
                <RippleRings trigger={sRipple} color={sPhase === "breathe" || sPhase === "ready" ? COLORS.green : COLORS.cyan} />
                <BubbleBurst burstTrigger={sBurst} />
                <ProgressRing fraction={sRunning || sPhase === "hold" || sPhase === "breathe" ? sFraction : 0} color={sPhase === "breathe" || sPhase === "ready" ? COLORS.green : COLORS.cyan} />
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ fontSize: 14, letterSpacing: 3, color: sPhase === "breathe" || sPhase === "ready" ? COLORS.greenBright : COLORS.cyanBright, fontWeight: 700, fontFamily: DISPLAY_FONT }}>
                    {sPhase === "ready" ? "READY" : sPhase === "breathe" ? "BREATHE" : sPhase === "hold" ? "HOLD" : "DONE"}
                  </div>
                  <div style={{ fontSize: 50, fontWeight: 700, color: COLORS.white, fontFamily: DISPLAY_FONT, fontVariantNumeric: "tabular-nums" }}>{formatTime(sTimer)}</div>
                </div>
              </div>

              {sPhase === "ready" && !sRunning && (
                <button onClick={(e) => { e.stopPropagation(); const { x, y } = getEventXY(e); fireMiniBurst(x, y); setSRunning(true); setSPhase("breathe"); }} style={{ ...primaryBtnStyle, marginTop: 30, maxWidth: 280 }}>Start</button>
              )}
              {(sPhase === "breathe" || sPhase === "ready") && sRunning && (
                <div style={{ color: COLORS.dim, fontSize: 12, marginTop: 16, letterSpacing: 1, textAlign: "center" }}>DOUBLE-TAP TO SKIP</div>
              )}
              {sPhase === "done" && (
                <button onClick={(e) => { e.stopPropagation(); beginSession(sTable, sDifficulty); }} style={{ ...primaryBtnStyle, marginTop: 30, maxWidth: 280 }}>Restart</button>
              )}
              {sPhase === "hold" && (
                <div style={{ textAlign: "center", marginTop: 20 }}>
                  <div style={{ width: 200, height: 3, borderRadius: 2, background: "rgba(127,216,255,0.15)", overflow: "hidden", margin: "0 auto 10px" }}>
                    <div style={{ height: "100%", background: COLORS.cyanBright, transformOrigin: "left",
                      transform: `scaleX(${contractionLongPress.pressing ? 1 : 0})`,
                      transition: contractionLongPress.pressing ? "transform 900ms linear" : "transform 0.15s ease-out" }} />
                  </div>
                  <div style={{ color: COLORS.cyanBright, fontSize: 13, letterSpacing: 1.5, fontFamily: DISPLAY_FONT, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <Zap size={14} /> {sContractions} &middot; HOLD TO LOG
                  </div>
                  <div style={{ color: COLORS.dim, fontSize: 11, marginTop: 4, letterSpacing: 1 }}>ANYWHERE ON SCREEN</div>
                </div>
              )}
            </div>

            <div style={{ padding: "0 20px 22px" }}>
              {sPhase === "hold" && (
                <button onClick={() => setShowSurfaceConfirm(true)} style={{
                  width: "100%", marginBottom: 14, padding: "13px 0", borderRadius: 16, fontWeight: 700, fontSize: 13, letterSpacing: 1,
                  border: "1px solid rgba(255,118,118,0.4)", background: "rgba(255,118,118,0.12)", color: COLORS.red, cursor: "pointer", fontFamily: DISPLAY_FONT,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6, ...glass,
                }}><AlertTriangle size={14} /> I surfaced</button>
              )}
              <HrGauge hr={hr} min={minHr} max={maxHr} bleStatus={bleStatus} bleConnected={bleConnected} onConnect={connectWatch} onDisconnect={disconnectWatch} manualHr={hr} setManualHr={logHr} />
            </div>
          </div>
        )}

        {screen === "prattempt" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "22px 22px 4px" }}>
              <button onClick={() => setScreen("pr")} style={{ background: "none", border: "none", color: COLORS.dim, cursor: "pointer" }}><X size={24} /></button>
              <div style={{ color: COLORS.cyan, fontWeight: 700, fontFamily: DISPLAY_FONT, letterSpacing: 2, fontSize: 15 }}>
                {paMode === "result" ? "RESULT" : prSeconds > 0 ? `BEAT ${formatTime(prSeconds)}` : "PR ATTEMPT"}
              </div>
              <div style={{ width: 24 }} />
            </div>
            <div
              style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "10px 20px", touchAction: "manipulation" }}
              onDoubleClick={() => { if (paMode === "breathe") { transitionPulse(); setPaMode("attempt"); setPaElapsed(0); } }}
              onTouchEnd={(e) => { const now = Date.now(); if (now - (e.currentTarget._lastTap || 0) < 300 && paMode === "breathe") { transitionPulse(); setPaMode("attempt"); setPaElapsed(0); } e.currentTarget._lastTap = now; }}
              {...(paMode === "attempt" ? paLongPress.handlers : {})}
            >
              <div style={{ position: "relative" }}>
                <BubbleBurst burstTrigger={paBurst} />
                <ProgressRing fraction={paMode === "attempt" && prSeconds > 0 ? paElapsed / prSeconds : paMode === "breathe" ? 1 - paTimer / prBreatheSeconds : 0} color={paMode === "breathe" ? COLORS.green : COLORS.cyan} />
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ fontSize: 14, letterSpacing: 3, color: paMode === "breathe" ? COLORS.greenBright : COLORS.cyanBright, fontWeight: 700, fontFamily: DISPLAY_FONT }}>
                    {paMode === "breathe" ? "BREATHE UP" : paMode === "attempt" ? "HOLD - GO" : paIsPR ? "NEW PR!" : "GOOD EFFORT"}
                  </div>
                  <div style={{ fontSize: 50, fontWeight: 700, color: COLORS.white, fontFamily: DISPLAY_FONT, fontVariantNumeric: "tabular-nums" }}>{formatTime(paMode === "breathe" ? paTimer : paElapsed)}</div>
                </div>
              </div>
              {paMode === "breathe" && <div style={{ color: COLORS.dim, fontSize: 12, marginTop: 16, letterSpacing: 1 }}>DOUBLE-TAP TO SKIP</div>}
              {paMode === "attempt" && (
                <div style={{ textAlign: "center", marginTop: 20 }}>
                  <div style={{ width: 200, height: 3, borderRadius: 2, background: "rgba(127,216,255,0.15)", overflow: "hidden", margin: "0 auto 10px" }}>
                    <div style={{ height: "100%", background: COLORS.cyanBright, transformOrigin: "left",
                      transform: `scaleX(${paLongPress.pressing ? 1 : 0})`,
                      transition: paLongPress.pressing ? "transform 900ms linear" : "transform 0.15s ease-out" }} />
                  </div>
                  <div style={{ color: COLORS.cyanBright, fontSize: 13, letterSpacing: 1.5, fontFamily: DISPLAY_FONT, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <Zap size={14} /> {paContractions} &middot; HOLD TO LOG
                  </div>
                  <div style={{ color: COLORS.dim, fontSize: 11, marginTop: 4, letterSpacing: 1 }}>ANYWHERE ON SCREEN</div>
                </div>
              )}
              {paMode === "result" && <button onClick={(e) => { e.stopPropagation(); setScreen("pr"); }} style={{ ...primaryBtnStyle, marginTop: 30, maxWidth: 280 }}>Back</button>}
            </div>
            <div style={{ padding: "0 20px 22px" }}>
              {paMode === "attempt" && (
                <button onClick={stopPrAttempt} style={{ ...primaryBtnStyle, marginBottom: 14, background: "rgba(255,118,118,0.15)", borderColor: "rgba(255,118,118,0.4)", color: COLORS.red }}>Stop</button>
              )}
              {paMode !== "result" && (
                <HrGauge hr={hr} min={minHr} max={maxHr} bleStatus={bleStatus} bleConnected={bleConnected} onConnect={connectWatch} onDisconnect={disconnectWatch} manualHr={hr} setManualHr={logHr} />
              )}
            </div>
          </div>
        )}
      </div>

      {["train", "pr", "history", "diving", "settings"].includes(screen) && (
        <div style={tabBarStyle}>
          <TabButton active={screen === "train"} label="Train" Icon={Dumbbell} onClick={() => goTab("train")} />
          <TabButton active={screen === "pr"} label="PR" Icon={Timer} onClick={() => goTab("pr")} />
          <TabButton active={screen === "history"} label="History" Icon={BarChart3} onClick={() => goTab("history")} />
          <TabButton active={screen === "diving"} label="Diving" Icon={Waves} onClick={() => goTab("diving")} />
          <TabButton active={screen === "settings"} label="Settings" Icon={Settings2} onClick={() => goTab("settings")} />
        </div>
      )}

      {pendingTable && <DifficultyPicker onPick={(diff) => beginSession(pendingTable, diff)} onCancel={() => setPendingTable(null)} />}
      {showCustomModal && <CustomTableModal prSeconds={prSeconds} onAdd={addCustomTable} onCancel={() => setShowCustomModal(false)} />}
      {showPrEdit && <PrEditSheet initial={prSeconds || 60} onSave={(v) => { setPrSeconds(v); setShowPrEdit(false); showToast(`PR saved: ${formatTime(v)}`); }} onCancel={() => setShowPrEdit(false)} />}

      {showSurfaceConfirm && <ConfirmModal title="Surface now?" body="This will end the session and log it as failed, noting the round you surfaced on." confirmLabel="I surfaced" danger onConfirm={confirmSurface} onCancel={() => setShowSurfaceConfirm(false)} />}
      {showExitConfirm && <ConfirmModal title="Exit session?" body="Your progress on this session won't be saved." confirmLabel="Exit" danger onConfirm={() => { setShowExitConfirm(false); setSRunning(false); setScreen("train"); }} onCancel={() => setShowExitConfirm(false)} />}
      {deleteTarget && (
        <ConfirmModal title="Delete this?" body="This can't be undone." confirmLabel="Delete" danger
          onConfirm={() => {
            if (deleteTarget.kind === "custom") setCustomTables((c) => c.filter((t) => t.id !== deleteTarget.id));
            else if (deleteTarget.kind === "dive") deleteDiveEntry(deleteTarget.id);
            else deleteHistoryEntry(deleteTarget.id);
            setDeleteTarget(null);
          }}
          onCancel={() => setDeleteTarget(null)} />
      )}
      {confirmClearHistory && <ConfirmModal title="Clear all history?" body="This can't be undone." confirmLabel="Clear" danger onConfirm={() => { setHistory([]); setConfirmClearHistory(false); showToast("History cleared"); }} onCancel={() => setConfirmClearHistory(false)} />}
      {confirmResetPr && <ConfirmModal title="Reset your PR?" body="Your personal best will be cleared." confirmLabel="Reset" danger onConfirm={() => { setPrSeconds(0); setConfirmResetPr(false); showToast("PR reset"); }} onCancel={() => setConfirmResetPr(false)} />}
    </div>
  );
}
