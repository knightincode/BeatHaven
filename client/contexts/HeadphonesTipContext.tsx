import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "headphones_tip_dismissed";

interface HeadphonesTipContextType {
  dismissed: boolean;
  dismiss: () => void;
}

const HeadphonesTipContext = createContext<HeadphonesTipContextType>({
  dismissed: true,
  dismiss: () => {},
});

export function HeadphonesTipProvider({ children }: { children: ReactNode }) {
  "use no memo";
  const [hydrated, setHydrated] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((val) => {
        setDismissed(val === "true");
      })
      .catch(() => {
        setDismissed(false);
      })
      .finally(() => {
        setHydrated(true);
      });
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
    AsyncStorage.setItem(STORAGE_KEY, "true").catch(() => {});
  }, []);

  const effectiveDismissed = !hydrated || dismissed;

  const value = useMemo(
    () => ({ dismissed: effectiveDismissed, dismiss }),
    [effectiveDismissed, dismiss]
  );

  return (
    <HeadphonesTipContext.Provider value={value}>
      {children}
    </HeadphonesTipContext.Provider>
  );
}

export function useHeadphonesTip() {
  "use no memo";
  return useContext(HeadphonesTipContext);
}
