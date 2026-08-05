import { Haptics } from "@capacitor/haptics";
import { mediaVibrate } from "./mediaHaptics.js";

let enabled = true;
export function setHapticsEnabled(v) { enabled = v; }
export function getHapticsEnabled() { return enabled; }

// Tries our custom native plugin first (uses the MEDIA vibration usage category,
// which works independently of the "Touch feedback" system setting - the same
// way games/media apps vibrate). Falls back to the stock Capacitor Haptics
// plugin if the native call fails for any reason.
async function pulse(ms = 45) {
  if (!enabled) return;
  try {
    await mediaVibrate(ms);
  } catch (e) {
    try { await Haptics.vibrate({ duration: ms }); } catch (e2) { console.warn("haptics failed", e2); }
  }
}

// Bypasses our own on/off toggle - used by the "test vibration" button.
export async function testVibrate() {
  try { await mediaVibrate(200); return true; } catch (e) {
    try { await Haptics.vibrate({ duration: 200 }); return true; } catch (e2) { console.warn("test vibrate failed", e2); return false; }
  }
}

// A single tick used for a real per-second countdown in the last few seconds
// before a phase change. Duration escalates slightly as secondsLeft approaches
// 1, so it builds a bit of tension rather than feeling uniform/flat.
export async function countdownTick(secondsLeft) {
  const duration = 25 + (5 - secondsLeft) * 10;
  await pulse(Math.max(25, duration));
}

// A "shake" alert - a rapid burst of short pulses, clearly distinct from the
// single countdown tick and the 3-pulse transition. Used for the 20s/10s
// heads-up warnings, well before the final 5-second countdown starts.
export async function shakeAlert() {
  for (let i = 0; i < 5; i++) {
    await pulse(40);
    await new Promise((r) => setTimeout(r, 55));
  }
}

// Two soft, gentle pulses marking the end of the recovery breathing period -
// deliberately calmer than the other alerts since recovery is a wind-down moment.
export async function recoveryCompletePulse() {
  await pulse(55);
  await new Promise((r) => setTimeout(r, 220));
  await pulse(55);
}

export async function warningPulse() {
  await pulse(45);
  await new Promise((r) => setTimeout(r, 160));
  await pulse(45);
}
export async function transitionPulse() {
  await pulse(50);
  await new Promise((r) => setTimeout(r, 110));
  await pulse(50);
  await new Promise((r) => setTimeout(r, 110));
  await pulse(50);
}
export async function minutePulse() {
  await pulse(45);
  await new Promise((r) => setTimeout(r, 160));
  await pulse(45);
}
export async function prBeatPulse() {
  await pulse(60);
  await new Promise((r) => setTimeout(r, 140));
  await pulse(60);
  await new Promise((r) => setTimeout(r, 140));
  await pulse(60);
}
