import { play, setEnabled, setVolume, type SoundName } from "cuelume";
import {
  play as playLegacy,
  setEnabled as setLegacyEnabled,
  setVolume as setLegacyVolume,
  type SoundName as LegacySoundName,
} from "cuelume-legacy";

export type SoundPreference = "on" | "off";

const soundStorageKey = "incessant-sound";
const defaultVolume = 0.32;
const legacySounds = {
  chime: true,
  droplet: true,
  bloom: true,
  tick: true,
} satisfies Partial<Record<LegacySoundName, true>>;
type InterfaceSound = SoundName | keyof typeof legacySounds;

const applySoundSettings = (enabled: boolean) => {
  setVolume(defaultVolume);
  setLegacyVolume(defaultVolume);
  setEnabled(enabled);
  setLegacyEnabled(enabled);
};

export const getSoundPreference = (): SoundPreference => {
  try {
    return localStorage.getItem(soundStorageKey) === "on" ? "on" : "off";
  } catch {
    return "off";
  }
};

export const initializeSound = (): SoundPreference => {
  const preference = getSoundPreference();
  applySoundSettings(preference === "on");
  document.documentElement.dataset.soundPreference = preference;
  return preference;
};

export const playInterfaceSound = (sound: InterfaceSound, volume = 1) => {
  if (sound in legacySounds) playLegacy(sound as keyof typeof legacySounds, { volume });
  else play(sound as SoundName, { volume });
};

export const setSoundPreference = (preference: SoundPreference) => {
  try { localStorage.setItem(soundStorageKey, preference); } catch { /* Sound preferences can remain in memory. */ }
  document.documentElement.dataset.soundPreference = preference;
  setVolume(defaultVolume);
  setLegacyVolume(defaultVolume);

  if (preference === "on") {
    setEnabled(true);
    setLegacyEnabled(true);
    playLegacy("chime", { volume: 0.75 });
    return;
  }

  playLegacy("droplet", { volume: 0.55 });
  setEnabled(false);
  setLegacyEnabled(false);
};
