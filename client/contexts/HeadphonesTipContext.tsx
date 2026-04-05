import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
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
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val !== "true") setDismissed(false);
    });
  }, []);

  async function dismiss() {
    await AsyncStorage.setItem(STORAGE_KEY, "true");
    setDismissed(true);
  }

  return (
    <HeadphonesTipContext.Provider value={{ dismissed, dismiss }}>
      {children}
    </HeadphonesTipContext.Provider>
  );
}

export function useHeadphonesTip() {
  return useContext(HeadphonesTipContext);
}
