import { useEffect, useRef, useSyncExternalStore } from "react";
import { createTableAudio, preloadTableSounds, type TableCue } from "@/lib/tableAudio";

const storageKey = "gamess:table-sound";
const soundChange = "table-sound-change";
let sessionPreference = true;

function getEnabled() {
  try {
    const saved = window.localStorage.getItem(storageKey);
    if (saved === "on" || saved === "off") return saved === "on";
  } catch {
    // Some embedded browsers block local storage.
  }
  return sessionPreference;
}

function subscribe(onChange: () => void) {
  window.addEventListener(soundChange, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(soundChange, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useTableAudio() {
  const enabled = useSyncExternalStore(subscribe, getEnabled, () => true);
  const audio = useRef<ReturnType<typeof createTableAudio> | null>(null);

  useEffect(() => () => {
    audio.current?.stop();
    audio.current = null;
  }, []);

  useEffect(() => {
    if (enabled) {
      if (getEnabled() && typeof window.OfflineAudioContext === "function") void preloadTableSounds();
      return;
    }
    audio.current?.stop();
    audio.current = null;
  }, [enabled]);

  function play(cue: TableCue, delay = 0) {
    // Round timers may hold an older render's handler.
    if (!getEnabled() || typeof window.AudioContext !== "function") return;
    try {
      audio.current ??= createTableAudio();
    } catch {
      return;
    }
    audio.current.play(cue, delay);
  }

  function toggle() {
    const next = !getEnabled();
    sessionPreference = next;
    try {
      window.localStorage.setItem(storageKey, next ? "on" : "off");
    } catch {
      // Keep the preference for client-side navigation when storage is blocked.
    }
    if (next) play("enabled");
    else {
      audio.current?.stop();
      audio.current = null;
    }
    window.dispatchEvent(new Event(soundChange));
  }

  return { enabled, play, toggle };
}
