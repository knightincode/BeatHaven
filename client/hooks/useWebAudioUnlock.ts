import { useEffect } from "react";
import { Platform } from "react-native";

let unlocked = false;
let audioContext: AudioContext | null = null;

export function getSharedAudioContext(): AudioContext | null {
  return audioContext;
}

export function useWebAudioUnlock() {
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined" || unlocked) {
      return;
    }

    const cleanup = () => {
      document.removeEventListener("click", unlock, { capture: true });
      document.removeEventListener("touchstart", unlock, { capture: true });
    };

    const unlock = async () => {
      if (unlocked) return;
      unlocked = true;
      cleanup();
      try {
        const AC =
          window.AudioContext ||
          (window as any).webkitAudioContext;
        if (AC) {
          if (!audioContext) {
            audioContext = new AC();
          }
          if (audioContext.state === "suspended") {
            await audioContext.resume();
          }
        }

        const audio = new Audio(
          "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=",
        );
        audio.volume = 0;
        await audio.play().catch(() => {});
        audio.pause();
        audio.src = "";
      } catch {}
    };

    document.addEventListener("click", unlock, { capture: true });
    document.addEventListener("touchstart", unlock, { capture: true });

    return cleanup;
  }, []);
}
