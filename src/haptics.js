import { Haptics, ImpactStyle } from "@capacitor/haptics";

let enabled = true;
export function setHapticsEnabled(v) { enabled = v; }
export function getHapticsEnabled() { return enabled; }

async function pulse() {
  if (!enabled) return;
  try { await Haptics.impact({ style: ImpactStyle.Heavy }); } catch (e) {}
}

export async function warningPulse() {
  await pulse();
  await new Promise((r) => setTimeout(r, 160));
  await pulse();
}
export async function transitionPulse() {
  await pulse();
  await new Promise((r) => setTimeout(r, 110));
  await pulse();
  await new Promise((r) => setTimeout(r, 110));
  await pulse();
}
export async function minutePulse() {
  await pulse();
  await new Promise((r) => setTimeout(r, 160));
  await pulse();
}
export async function prBeatPulse() {
  await pulse();
  await new Promise((r) => setTimeout(r, 140));
  await pulse();
  await new Promise((r) => setTimeout(r, 140));
  await pulse();
}
