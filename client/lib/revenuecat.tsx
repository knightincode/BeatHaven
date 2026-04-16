import React, { createContext, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import { useMutation, useQuery } from "@tanstack/react-query";
import Constants from "expo-constants";

const REVENUECAT_TEST_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY;
const REVENUECAT_IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
const REVENUECAT_ANDROID_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;

export const REVENUECAT_ENTITLEMENT_IDENTIFIER = "premium";

export const REVENUECAT_AVAILABLE = !!(
  REVENUECAT_TEST_API_KEY &&
  REVENUECAT_IOS_API_KEY &&
  REVENUECAT_ANDROID_API_KEY
);

function getRevenueCatApiKey(): string | null {
  if (!REVENUECAT_AVAILABLE) return null;
  if (__DEV__ || Platform.OS === "web" || Constants.executionEnvironment === "storeClient") {
    return REVENUECAT_TEST_API_KEY!;
  }
  if (Platform.OS === "ios") return REVENUECAT_IOS_API_KEY!;
  if (Platform.OS === "android") return REVENUECAT_ANDROID_API_KEY!;
  return REVENUECAT_TEST_API_KEY!;
}

let purchasesModule: any = null;
let initialized = false;

async function loadPurchasesModule() {
  if (purchasesModule) return purchasesModule;
  try {
    const mod = await import("react-native-purchases");
    purchasesModule = mod.default ?? mod;
    return purchasesModule;
  } catch (err) {
    console.warn("[RevenueCat] Failed to load react-native-purchases:", err);
    return null;
  }
}

export async function initializeRevenueCat(): Promise<boolean> {
  if (initialized) return true;
  const apiKey = getRevenueCatApiKey();
  if (!apiKey) {
    console.log("[RevenueCat] API keys not configured; skipping init");
    return false;
  }
  const Purchases = await loadPurchasesModule();
  if (!Purchases) return false;
  try {
    if (Purchases.setLogLevel && Purchases.LOG_LEVEL) {
      Purchases.setLogLevel(Purchases.LOG_LEVEL.INFO);
    }
    Purchases.configure({ apiKey });
    initialized = true;
    console.log("[RevenueCat] Configured");
    return true;
  } catch (err) {
    console.warn("[RevenueCat] configure() failed:", err);
    return false;
  }
}

export async function identifyRevenueCatUser(userId: string): Promise<void> {
  if (!initialized) return;
  const Purchases = await loadPurchasesModule();
  if (!Purchases) return;
  try {
    await Purchases.logIn(userId);
  } catch (err) {
    console.warn("[RevenueCat] logIn failed:", err);
  }
}

export async function resetRevenueCatUser(): Promise<void> {
  if (!initialized) return;
  const Purchases = await loadPurchasesModule();
  if (!Purchases) return;
  try {
    await Purchases.logOut();
  } catch (err) {
    // logOut throws if user is anonymous — safe to ignore
  }
}

type SubscriptionContextValue = {
  available: boolean;
  isSubscribed: boolean;
  customerInfo: any;
  offerings: any;
  isLoading: boolean;
  purchase: (pkg: any) => Promise<any>;
  restore: () => Promise<any>;
  isPurchasing: boolean;
  isRestoring: boolean;
  refetch: () => void;
};

const Context = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(REVENUECAT_AVAILABLE && Platform.OS !== "web");

  useEffect(() => {
    if (!REVENUECAT_AVAILABLE) return;
    if (Platform.OS === "web") return;
    (async () => {
      const ok = await initializeRevenueCat();
      setReady(ok);
    })();
  }, []);

  const customerInfoQuery = useQuery({
    queryKey: ["revenuecat", "customer-info"],
    enabled: ready,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const Purchases = await loadPurchasesModule();
      if (!Purchases) return null;
      try {
        return await Purchases.getCustomerInfo();
      } catch (err) {
        console.warn("[RevenueCat] getCustomerInfo failed:", err);
        return null;
      }
    },
  });

  const offeringsQuery = useQuery({
    queryKey: ["revenuecat", "offerings"],
    enabled: ready,
    staleTime: 300 * 1000,
    queryFn: async () => {
      const Purchases = await loadPurchasesModule();
      if (!Purchases) return null;
      try {
        return await Purchases.getOfferings();
      } catch (err) {
        console.warn("[RevenueCat] getOfferings failed:", err);
        return null;
      }
    },
  });

  const purchaseMutation = useMutation({
    mutationFn: async (pkg: any) => {
      const Purchases = await loadPurchasesModule();
      if (!Purchases) throw new Error("RevenueCat unavailable");
      const result = await Purchases.purchasePackage(pkg);
      return result?.customerInfo ?? result;
    },
    onSuccess: () => customerInfoQuery.refetch(),
  });

  const restoreMutation = useMutation({
    mutationFn: async () => {
      const Purchases = await loadPurchasesModule();
      if (!Purchases) throw new Error("RevenueCat unavailable");
      return Purchases.restorePurchases();
    },
    onSuccess: () => customerInfoQuery.refetch(),
  });

  const isSubscribed =
    !!customerInfoQuery.data?.entitlements?.active?.[REVENUECAT_ENTITLEMENT_IDENTIFIER];

  const value: SubscriptionContextValue = {
    available: ready,
    isSubscribed,
    customerInfo: customerInfoQuery.data,
    offerings: offeringsQuery.data,
    isLoading: ready && (customerInfoQuery.isLoading || offeringsQuery.isLoading),
    purchase: purchaseMutation.mutateAsync,
    restore: restoreMutation.mutateAsync,
    isPurchasing: purchaseMutation.isPending,
    isRestoring: restoreMutation.isPending,
    refetch: () => {
      customerInfoQuery.refetch();
      offeringsQuery.refetch();
    },
  };

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSubscription() {
  const ctx = useContext(Context);
  if (!ctx) {
    throw new Error("useSubscription must be used within a SubscriptionProvider");
  }
  return ctx;
}
