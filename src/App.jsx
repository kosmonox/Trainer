import { useState, useEffect, useRef, useCallback } from "react";
import { loadStored, saveStored } from "./storage.js";
import { scanAndConnectHrMonitor, disconnectHrMonitor } from "./ble.js";

const COLORS = {
  bg: "#030f18",
  bgCard: "#0a1f2e",
  cyan: "#7fd8ff",
  cyanBright: "#a8e8ff",
  green: "#7fe8a8",
  greenBright: "#b0f5cb",
  red: "#ff7676",
  white: "#eaf9ff",
  dim: "#4a7488",
};

const DISPLAY_FONT = "'Oswald', system-ui, sans-serif";
const BODY_FONT = "'Inter', system-ui, sans-serif";

const PRESETS = [
  { name: "CO2 gentle", tableType: "CO2", baseHold: 90, baseBreathe: 120, step: 10, rounds: 6 },
  { name: "CO2 classic", tableType: "CO2", baseHold: 120, baseBreathe: 120, step: 15, rounds: 8 },
  { name: "CO2 advanced", tableType: "CO2", baseHold: 150, baseBreathe: 90, step: 15, rounds: 8 },
  { name: "O2 classic", tableType: "O2", baseHold: 60, baseBreathe: 120, step: 20, rounds: 8 },
  { name: "O2 advanced", tableType: "O2", baseHold: 90, baseBreathe: 150, step: 20, rounds: 8 },
];

function formatTime(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec < 10 ? "0" : ""}${sec}`;
}

function Bubbles({ count = 16 }) {
  const bubbles = useRef(
    Array.from({ length: count }).map(() => ({
      left: 4 + Math.random() * 92,
      size: 3 + Math.random() * 11,
      delay: Math.random() * 9,
      duration: 8 + Math.random() * 9,
      opacity: 0.06 + Math.random() * 0.16,
    }))
  ).current;
  return (
    <div style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
      <style>{`
        @keyframes floatUp {
          0% { transform: translateY(0); opacity: 0; }
          10% { opacity: var(--op); }
          90% { opacity: var(--op); }
          100% { transform: translateY(-100vh) translateX(16px); opacity: 0; }
        }
      `}</style>
      {bubbles.map((b, i) => (
        <div
          key={i}
          style={{
            position: "absolute", left: `${b.left}%`, bottom: -20,
            width: b.size, height: b.size, borderRadius: "50%",
            background: COLORS.cyanBright, opacity: 0, "--op": b.opacity,
            animation: `floatUp ${b.duration}s linear ${b.delay}s infinite`,
          }}
        />
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
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 0.4s linear" }}
      />
    </svg>
  );
}

function HrGauge({ hr, min, max, bleStatus, bleConnected, onConnect, onDisconnect, manualHr, setManualHr }) {
  const pct = (v) => Math.max(0, Math.min(100, (v / 200) * 100));
  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 20 }}>&#10084;</span>
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
          <button onClick={onDisconnect} style={{ ...pillBtnStyle, borderColor: "rgba(255,118,118,0.4)", color: COLORS.red }}>
            Disconnect watch
          </button>
        ) : (
          <button onClick={onConnect} style={pillBtnStyle}>Connect watch via Bluetooth</button>
        )}
      </div>
      {bleStatus && (
        <div style={{ textAlign: "center", fontSize: 12, color: COLORS.dim, marginTop: 6 }}>{bleStatus}</div>
      )}

      {!bleConnected && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 11, color: COLORS.dim, textAlign: "center", marginBottom: 4, letterSpacing: 1 }}>
            OR DRAG TO LOG MANUALLY
          </div>
          <input
            type="range" min={0} max={200} value={manualHr}
            onChange={(e) => setManualHr(Number(e.target.value))}
            style={{ width: "100%", accentColor: COLORS.cyan }}
          />
        </div>
      )}
    </div>
  );
}

function Header({ title, onBack }) {
  return (
    <div style={{ display: "flex", alignItems: "center", padding: "22px 22px 8px" }}>
      {onBack && (
        <button onClick={onBack} style={{ background: "none", border: "none", color: COLORS.cyan, fontSize: 24, padding: 0, marginRight: 12, cursor: "pointer" }}>
          &#8592;
        </button>
      )}
      <div style={{ color: COLORS.cyan, fontWeight: 700, fontSize: 15, letterSpacing: 3, textTransform: "uppercase", fontFamily: DISPLAY_FONT }}>{title}</div>
    </div>
  );
}

function MenuButton({ label, sub, onClick }) {
  return (
    <button onClick={onClick} style={{
      width: "100%", textAlign: "left", background: COLORS.bgCard, border: "1px solid rgba(127,216,255,0.15)",
      borderRadius: 18, padding: "20px 22px", marginBottom: 12, cursor: "pointer",
    }}>
      <div style={{ color: COLORS.white, fontWeight: 700, fontSize: 19, letterSpacing: 0.5, fontFamily: DISPLAY_FONT, textTransform: "uppercase" }}>{label}</div>
      {sub && <div style={{ color: COLORS.dim, fontSize: 13, marginTop: 4, fontFamily: BODY_FONT }}>{sub}</div>}
    </button>
  );
}

function Stepper({ label, value, onDec, onInc }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: COLORS.bgCard, borderRadius: 14, padding: "14px 18px", marginBottom: 10 }}>
      <div style={{ color: COLORS.dim, fontSize: 13, letterSpacing: 1, textTransform: "uppercase", fontFamily: BODY_FONT }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <button onClick={onDec} style={circleBtnStyle}>&#8722;</button>
        <div style={{ color: COLORS.white, fontWeight: 700, fontSize: 18, minWidth: 56, textAlign: "center", fontFamily: DISPLAY_FONT }}>{value}</div>
        <button onClick={onInc} style={circleBtnStyle}>&#43;</button>
      </div>
    </div>
  );
}

const circleBtnStyle = {
  width: 36, height: 36, borderRadius: "50%", border: "1px solid rgba(127,216,255,0.3)",
  background: "rgba(127,216,255,0.08)", color: COLORS.cyan, fontSize: 18, cursor: "pointer",
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

export default function App() {
  const [screen, setScreen] = useState("menu");
  const [loaded, setLoaded] = useState(false);

  const [prSeconds, setPrSeconds] = useState(0);
  const [custom, setCustom] = useState({ tableType: "O2", baseHold: 60, baseBreathe: 120, step: 15, rounds: 8 });

  useEffect(() => {
    (async () => {
      const pr = await loadStored("apnea_pr", { seconds: 0 });
      const cust = await loadStored("apnea_custom", null);
      setPrSeconds(pr.seconds || 0);
      if (cust) setCustom(cust);
      setLoaded(true);
    })();
  }, []);
  useEffect(() => { if (loaded) saveStored("apnea_pr", { seconds: prSeconds }); }, [prSeconds, loaded]);
  useEffect(() => { if (loaded) saveStored("apnea_custom", custom); }, [custom, loaded]);

  const [prDraft, setPrDraft] = useState(60);

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
    await scanAndConnectHrMonitor(
      (reading) => logHr(reading),
      (state, message) => {
        setBleStatus(message);
        if (state === "connected") setBleConnected(true);
        if (state === "disconnected" || state === "error") setBleConnected(false);
      }
    );
  };
  const disconnectWatch = async () => {
    await disconnectHrMonitor();
    setBleConnected(false);
    setBleStatus("Disconnected");
  };

  const tpList = prSeconds > 0
    ? [{ name: "Auto O2 (your PR)", tableType: "O2",
         baseHold: Math.max(15, Math.round(prSeconds * 0.5)),
         baseBreathe: 120, step: Math.max(5, Math.round(prSeconds * 0.08)), rounds: 6 },
       ...PRESETS, { name: "Custom", ...custom }]
    : [...PRESETS, { name: "Custom", ...custom }];

  const [sTable, setSTable] = useState(null);
  const [sRound, setSRound] = useState(1);
  const [sPhase, setSPhase] = useState("ready");
  const [sTimer, setSTimer] = useState(0);
  const [sHoldTime, setSHoldTime] = useState(0);
  const [sBreatheTime, setSBreatheTime] = useState(0);
  const [sRunning, setSRunning] = useState(false);
  const [sContractions, setSContractions] = useState(0);

  const startSession = (table) => {
    setSTable(table);
    setSRound(1);
    setSHoldTime(table.baseHold);
    setSBreatheTime(table.baseBreathe);
    setSPhase("ready");
    setSTimer(table.baseBreathe);
    setSRunning(false);
    setSContractions(0);
    resetHr();
    setScreen("session");
  };

  useEffect(() => {
    if (screen !== "session" || !sRunning) return;
    const id = setTimeout(() => {
      if (sTimer > 1) { setSTimer(sTimer - 1); return; }
      if (sPhase === "ready" || sPhase === "breathe") {
        setSContractions(0);
        setSPhase("hold");
        setSTimer(sHoldTime);
      } else {
        const nextRound = sRound + 1;
        if (nextRound > sTable.rounds) {
          setSRunning(false);
          setSPhase("done");
        } else {
          let nh = sHoldTime, nb = sBreatheTime;
          if (sTable.tableType === "CO2") nb = Math.max(15, sBreatheTime - sTable.step);
          else nh = sHoldTime + sTable.step;
          setSHoldTime(nh);
          setSBreatheTime(nb);
          setSRound(nextRound);
          setSPhase("breathe");
          setSTimer(nb);
        }
      }
    }, 1000);
    return () => clearTimeout(id);
  }, [screen, sRunning, sTimer, sPhase, sHoldTime, sBreatheTime, sRound, sTable]);

  const sPhaseTotal = sPhase === "hold" ? sHoldTime : sBreatheTime;
  const sFraction = sPhaseTotal > 0 ? 1 - sTimer / sPhaseTotal : 0;

  const [paMode, setPaMode] = useState("breathe");
  const [paTimer, setPaTimer] = useState(120);
  const [paElapsed, setPaElapsed] = useState(0);
  const [paContractions, setPaContractions] = useState(0);
  const [paIsPR, setPaIsPR] = useState(false);

  const startPrAttempt = () => {
    setPaMode("breathe");
    setPaTimer(120);
    setPaElapsed(0);
    setPaContractions(0);
    setPaIsPR(false);
    resetHr();
    setScreen("prattempt");
  };

  useEffect(() => {
    if (screen !== "prattempt") return;
    const id = setInterval(() => {
      if (paMode === "breathe") {
        setPaTimer((t) => { if (t <= 1) { setPaMode("attempt"); return 0; } return t - 1; });
      } else if (paMode === "attempt") {
        setPaElapsed((t) => t + 1);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [screen, paMode]);

  const stopPrAttempt = () => {
    if (paElapsed > prSeconds) { setPrSeconds(paElapsed); setPaIsPR(true); }
    setPaMode("result");
  };

  const goMenu = () => setScreen("menu");

  return (
    <div style={{
      width: "100%", minHeight: "100vh", background: COLORS.bg, position: "relative",
      fontFamily: BODY_FONT, paddingBottom: "env(safe-area-inset-bottom)",
      paddingTop: "env(safe-area-inset-top)",
    }}>
      <Bubbles />
      <div style={{ position: "relative", zIndex: 1, paddingBottom: 40 }}>

        {screen === "menu" && (
          <>
            <div style={{ textAlign: "center", padding: "48px 20px 28px" }}>
              <div style={{ fontSize: 30, fontWeight: 700, color: COLORS.white, letterSpacing: 3, fontFamily: DISPLAY_FONT, textTransform: "uppercase" }}>Apnea Trainer</div>
              <div style={{ fontSize: 12, color: COLORS.dim, marginTop: 6, letterSpacing: 1 }}>
                {prSeconds > 0 ? `PERSONAL BEST · ${formatTime(prSeconds)}` : "NO PR SET YET"}
              </div>
            </div>
            <div style={{ padding: "0 20px" }}>
              <MenuButton label="Start table" sub="CO2 / O2 breath-hold tables" onClick={() => setScreen("tablepick")} />
              <MenuButton label="PR attempt" sub="Breathe up, then go for it" onClick={startPrAttempt} />
              <MenuButton label="Set my PR" sub={prSeconds > 0 ? formatTime(prSeconds) : "Not set"} onClick={() => { setPrDraft(prSeconds || 60); setScreen("prsetter"); }} />
              <MenuButton label="Custom table" sub="Build your own progression" onClick={() => setScreen("customsetup")} />
            </div>
          </>
        )}

        {screen === "tablepick" && (
          <>
            <Header title="Pick a table" onBack={goMenu} />
            <div style={{ padding: "10px 20px" }}>
              {tpList.map((t, i) => (
                <MenuButton key={i} label={t.name} sub={`${t.tableType} · hold ${t.baseHold}s · breathe ${t.baseBreathe}s · ${t.rounds} rounds`} onClick={() => startSession(t)} />
              ))}
            </div>
          </>
        )}

        {screen === "customsetup" && (
          <>
            <Header title="Custom table" onBack={goMenu} />
            <div style={{ padding: "14px 20px" }}>
              <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                {["CO2", "O2"].map((tt) => (
                  <button key={tt} onClick={() => setCustom((c) => ({ ...c, tableType: tt }))} style={{
                    flex: 1, padding: "13px 0", borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: DISPLAY_FONT, letterSpacing: 1,
                    border: custom.tableType === tt ? `1px solid ${COLORS.cyan}` : "1px solid rgba(127,216,255,0.15)",
                    background: custom.tableType === tt ? "rgba(127,216,255,0.15)" : COLORS.bgCard,
                    color: custom.tableType === tt ? COLORS.cyanBright : COLORS.dim,
                  }}>{tt} TABLE</button>
                ))}
              </div>
              <Stepper label="Base hold (s)" value={custom.baseHold} onDec={() => setCustom((c) => ({ ...c, baseHold: Math.max(15, c.baseHold - 5) }))} onInc={() => setCustom((c) => ({ ...c, baseHold: c.baseHold + 5 }))} />
              <Stepper label="Base breathe (s)" value={custom.baseBreathe} onDec={() => setCustom((c) => ({ ...c, baseBreathe: Math.max(15, c.baseBreathe - 5) }))} onInc={() => setCustom((c) => ({ ...c, baseBreathe: c.baseBreathe + 5 }))} />
              <Stepper label="Step (s)" value={custom.step} onDec={() => setCustom((c) => ({ ...c, step: Math.max(5, c.step - 5) }))} onInc={() => setCustom((c) => ({ ...c, step: c.step + 5 }))} />
              <Stepper label="Rounds" value={custom.rounds} onDec={() => setCustom((c) => ({ ...c, rounds: Math.max(1, c.rounds - 1) }))} onInc={() => setCustom((c) => ({ ...c, rounds: Math.min(20, c.rounds + 1) }))} />
              <button onClick={() => startSession({ name: "Custom", ...custom })} style={{ ...primaryBtnStyle, marginTop: 6 }}>Start this table</button>
            </div>
          </>
        )}

        {screen === "prsetter" && (
          <>
            <Header title="Set my PR" onBack={goMenu} />
            <div style={{ padding: "34px 20px", textAlign: "center" }}>
              <div style={{ fontSize: 58, fontWeight: 700, color: COLORS.white, fontFamily: DISPLAY_FONT, fontVariantNumeric: "tabular-nums" }}>{formatTime(prDraft)}</div>
              <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 26 }}>
                <button onClick={() => setPrDraft((v) => Math.max(5, v - 30))} style={circleBtnStyleBig}>&#8722;30</button>
                <button onClick={() => setPrDraft((v) => Math.max(5, v - 5))} style={circleBtnStyleBig}>&#8722;5</button>
                <button onClick={() => setPrDraft((v) => v + 5)} style={circleBtnStyleBig}>&#43;5</button>
                <button onClick={() => setPrDraft((v) => v + 30)} style={circleBtnStyleBig}>&#43;30</button>
              </div>
              <button onClick={() => { setPrSeconds(prDraft); setScreen("menu"); }} style={{ ...primaryBtnStyle, marginTop: 32 }}>Save PR</button>
            </div>
          </>
        )}

        {screen === "session" && sTable && (
          <>
            <Header title={sPhase === "done" ? "Complete" : `Round ${sRound}/${sTable.rounds}`} onBack={goMenu} />
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 20px" }}>
              <div style={{ position: "relative", marginTop: 12 }}>
                <ProgressRing fraction={sRunning || sPhase === "hold" || sPhase === "breathe" ? sFraction : 0} color={sPhase === "breathe" || sPhase === "ready" ? COLORS.green : COLORS.cyan} />
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ fontSize: 13, letterSpacing: 3, color: sPhase === "breathe" || sPhase === "ready" ? COLORS.greenBright : COLORS.cyanBright, fontWeight: 700, fontFamily: DISPLAY_FONT }}>
                    {sPhase === "ready" ? "READY" : sPhase === "breathe" ? "BREATHE" : sPhase === "hold" ? "HOLD" : "DONE"}
                  </div>
                  <div style={{ fontSize: 44, fontWeight: 700, color: COLORS.white, fontFamily: DISPLAY_FONT, fontVariantNumeric: "tabular-nums" }}>{formatTime(sTimer)}</div>
                </div>
              </div>

              {sPhase === "ready" && !sRunning && <button onClick={() => { setSRunning(true); setSPhase("breathe"); }} style={{ ...primaryBtnStyle, marginTop: 26 }}>Start</button>}
              {sPhase === "done" && <button onClick={() => startSession(sTable)} style={{ ...primaryBtnStyle, marginTop: 26 }}>Restart</button>}

              {(sPhase === "hold" || sPhase === "breathe") && (
                <div style={{ width: "100%", marginTop: 22 }}>
                  <button onClick={() => setSContractions((c) => c + 1)} disabled={sPhase !== "hold"} style={{
                    width: "100%", padding: "17px 0", borderRadius: 16, fontWeight: 700, fontSize: 15, letterSpacing: 1, fontFamily: DISPLAY_FONT, textTransform: "uppercase",
                    border: "1px solid rgba(127,216,255,0.2)", cursor: sPhase === "hold" ? "pointer" : "default",
                    background: sPhase === "hold" ? "rgba(127,216,255,0.15)" : COLORS.bgCard,
                    color: sPhase === "hold" ? COLORS.cyanBright : COLORS.dim,
                  }}>Log contraction &middot; {sContractions}</button>
                </div>
              )}

              <div style={{ width: "100%", marginTop: 22 }}>
                <HrGauge hr={hr} min={minHr} max={maxHr} bleStatus={bleStatus} bleConnected={bleConnected} onConnect={connectWatch} onDisconnect={disconnectWatch} manualHr={hr} setManualHr={logHr} />
              </div>
            </div>
          </>
        )}

        {screen === "prattempt" && (
          <>
            <Header title={paMode === "result" ? "Result" : prSeconds > 0 ? `PR attempt · beat ${formatTime(prSeconds)}` : "PR attempt"} onBack={goMenu} />
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 20px" }}>
              <div style={{ position: "relative", marginTop: 12 }}>
                <ProgressRing
                  fraction={paMode === "attempt" && prSeconds > 0 ? paElapsed / prSeconds : paMode === "breathe" ? 1 - paTimer / 120 : 0}
                  color={paMode === "breathe" ? COLORS.green : COLORS.cyan}
                />
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ fontSize: 13, letterSpacing: 3, color: paMode === "breathe" ? COLORS.greenBright : COLORS.cyanBright, fontWeight: 700, fontFamily: DISPLAY_FONT }}>
                    {paMode === "breathe" ? "BREATHE UP" : paMode === "attempt" ? "HOLD - GO" : paIsPR ? "NEW PR!" : "GOOD EFFORT"}
                  </div>
                  <div style={{ fontSize: 44, fontWeight: 700, color: COLORS.white, fontFamily: DISPLAY_FONT, fontVariantNumeric: "tabular-nums" }}>
                    {formatTime(paMode === "breathe" ? paTimer : paElapsed)}
                  </div>
                </div>
              </div>

              {paMode === "breathe" && <button onClick={() => { setPaMode("attempt"); setPaElapsed(0); }} style={{ ...primaryBtnStyle, marginTop: 26 }}>Skip to hold</button>}
              {paMode === "attempt" && (
                <>
                  <button onClick={() => setPaContractions((c) => c + 1)} style={{
                    width: "100%", padding: "15px 0", borderRadius: 16, fontWeight: 700, fontSize: 15, letterSpacing: 1, marginTop: 22, fontFamily: DISPLAY_FONT, textTransform: "uppercase",
                    border: "1px solid rgba(127,216,255,0.2)", background: "rgba(127,216,255,0.15)", color: COLORS.cyanBright, cursor: "pointer",
                  }}>Log contraction &middot; {paContractions}</button>
                  <button onClick={stopPrAttempt} style={{ ...primaryBtnStyle, marginTop: 14, background: "rgba(255,118,118,0.15)", borderColor: "rgba(255,118,118,0.4)", color: COLORS.red }}>Stop</button>
                </>
              )}
              {paMode === "result" && <button onClick={goMenu} style={{ ...primaryBtnStyle, marginTop: 26 }}>Back to menu</button>}

              {paMode !== "result" && (
                <div style={{ width: "100%", marginTop: 22 }}>
                  <HrGauge hr={hr} min={minHr} max={maxHr} bleStatus={bleStatus} bleConnected={bleConnected} onConnect={connectWatch} onDisconnect={disconnectWatch} manualHr={hr} setManualHr={logHr} />
                </div>
              )}
            </div>
          </>
        )}

      </div>
    </div>
  );
}
