import { Haptics, ImpactStyle } from "@capacitor/haptics";

async function pulse() {
  try { await Haptics.impact({ style: ImpactStyle.Heavy }); } catch (e) {}
}

// Two sharp pulses - used for the "10s left in this phase" warning
export async function warningPulse() {
  await pulse();
  await new Promise((r) => setTimeout(r, 160));
  await pulse();
}

// Three quick pulses - used when breathe/hold phases actually switch over
export async function transitionPulse() {
  await pulse();
  await new Promise((r) => setTimeout(r, 110));
  await pulse();
  await new Promise((r) => setTimeout(r, 110));
  await pulse();
}

// Double pulse - used for the once-a-minute marker during a PR attempt hold
export async function minutePulse() {
  await pulse();
  await new Promise((r) => setTimeout(r, 160));
  await pulse();
}

// Three pulses spaced further apart - layered after the success chime when a PR is beaten
export async function prBeatPulse() {
  await pulse();
  await new Promise((r) => setTimeout(r, 140));
  await pulse();
  await new Promise((r) => setTimeout(r, 140));
  await pulse();
}
