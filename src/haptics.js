import { Haptics } from "@capacitor/haptics";

let enabled = true;
export function setHapticsEnabled(v) { enabled = v; }
export function getHapticsEnabled() { return enabled; }

// Using vibrate(duration) instead of impact() - impact() relies on predefined
// Android vibration effects that silently no-op on some OS versions/OEM skins.
// vibrate() uses the basic Vibrator API directly, which is far more universally
// supported.
async function pulse(ms = 45) {
  if (!enabled) return;
  try { await Haptics.vibrate({ duration: ms }); } catch (e) { console.warn("haptics failed", e); }
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
