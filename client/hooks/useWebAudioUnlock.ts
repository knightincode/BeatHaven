import { useEffect } from "react";
import { Platform } from "react-native";

const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

let unlocked = false;

export function useWebAudioUnlock() {
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined" || unlocked) {
      return;
    }

    const unlock = () => {
      if (unlocked) return;
      unlocked = true;
      try {
        const audio = new Audio(SILENT_WAV);
        audio.volume = 0;
        const p = audio.play();
        if (p) {
          p.then(() => {
            audio.pause();
            audio.src = "";
          }).catch(() => {});
        }
      } catch {
      }
    };

    document.addEventListener("click", unlock, { once: true, capture: true });
    document.addEventListener("touchstart", unlock, {
      once: true,
      capture: true,
    });

    return () => {
      document.removeEventListener("click", unlock, { capture: true });
      document.removeEventListener("touchstart", unlock, { capture: true });
    };
  }, []);
}
