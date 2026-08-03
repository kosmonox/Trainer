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
