import { registerPlugin } from "@capacitor/core";

const MediaHaptics = registerPlugin("MediaHaptics");

export async function mediaVibrate(duration) {
  await MediaHaptics.vibrate({ duration });
}
