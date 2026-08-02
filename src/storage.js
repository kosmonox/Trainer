import { Preferences } from "@capacitor/preferences";

export async function loadStored(key, fallback) {
  try {
    const { value } = await Preferences.get({ key });
    if (value) return JSON.parse(value);
  } catch (e) {}
  return fallback;
}

export async function saveStored(key, value) {
  try {
    await Preferences.set({ key, value: JSON.stringify(value) });
  } catch (e) {}
}
