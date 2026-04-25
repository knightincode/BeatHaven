import React, { createContext, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import { useMutation, useQuery } from "@tanstack/react-query";
import Constants, { ExecutionEnvironment } from "expo-constants";
import type {
  CustomerInfo,
  PurchasesOfferings,
  PurchasesPackage,
  PurchasesStoreProduct,
  MakePurchaseResult,
} from "react-native-purchases";

type PurchasesSdk = {
  configure: (options: { apiKey: string }) => void;
  setLogLevel?: (level: unknown) => void;
  LOG_LEVEL?: { INFO: unknown };
  logIn: (userId: string) => Promise<unknown>;
  logOut: () => Promise<unknown>;
  getCustomerInfo: () => Promise<CustomerInfo>;
  getOfferings: () => Promise<PurchasesOfferings>;
  purchasePackage: (pkg: PurchasesPackage) => Promise<MakePurchaseResult>;
  restorePurchases: () => Promise<CustomerInfo>;
};

const REVENUECAT_IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
const REVENUECAT_ANDROID_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;

export const REVENUECAT_ENTITLEMENT_IDENTIFIER = "premium";

export const REVENUECAT_AVAILABLE =
  Platform.OS === "ios"
    ? !!REVENUECAT_IOS_API_KEY
    : Platform.OS === "android"
      ? !!REVENUECAT_ANDROID_API_KEY
      : false;

function getRevenueCatApiKey(): string | null {
  if (Platform.OS === "ios") return REVENUECAT_IOS_API_KEY ?? null;
  if (Platform.OS === "android") return REVENUECAT_ANDROID_API_KEY ?? null;
  return null;
}

let purchasesModule: PurchasesSdk | null = null;
let initialized = false;

async function loadPurchasesModule(): Promise<PurchasesSdk | null> {
  if (purchasesModule) return purchasesModule;
  try {
    const mod = await import("react-native-purchases");
    const resolved = (mod as unknown as { default?: PurchasesSdk }).default ?? (mod as unknown as PurchasesSdk);
    purchasesModule = resolved;
    return purchasesModule;
  } catch (err) {
    console.warn("[RevenueCat] Failed to load react-native-purchases:", err);
    return null;
  }
}

export type RevenueCatInitFailureReason =
  | "missing_api_key"
  | "expo_go_unsupported"
  | "sdk_load_failed"
  | "configure_failed"
  | null;

function isRunningInExpoGo(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

let lastInitFailureReason: RevenueCatInitFailureReason = null;
let lastInitFailureDetail: string | null = null;

export function getRevenueCatInitFailureReason(): RevenueCatInitFailureReason {
  return lastInitFailureReason;
}

export function getRevenueCatInitFailureDetail(): string | null {
  return lastInitFailureDetail;
}

export async function initializeRevenueCat(): Promise<boolean> {
  if (initialized) return true;
  if (isRunningInExpoGo()) {
    lastInitFailureReason = "expo_go_unsupported";
    lastInitFailureDetail =
      "react-native-purchases requires a development or production build (EAS build). It cannot run in Expo Go. RevenueCat features are disabled in this preview.";
    console.log(`[RevenueCat] ${lastInitFailureDetail}`);
    return false;
  }
  const apiKey = getRevenueCatApiKey();
  if (!apiKey) {
    lastInitFailureReason = "missing_api_key";
    lastInitFailureDetail = `EXPO_PUBLIC_REVENUECAT_${Platform.OS === "ios" ? "IOS" : "ANDROID"}_API_KEY was not bundled into this build. Add it to eas.json env for the build profile and rebuild.`;
    console.warn(
      `[RevenueCat] init aborted: ${lastInitFailureDetail} (platform=${Platform.OS})`,
    );
    return false;
  }
  const Purchases = await loadPurchasesModule();
  if (!Purchases) {
    lastInitFailureReason = "sdk_load_failed";
    lastInitFailureDetail =
      "react-native-purchases failed to load. The native module may not be linked in this build.";
    console.warn(`[RevenueCat] init aborted: ${lastInitFailureDetail}`);
    return false;
  }
  try {
    if (Purchases.setLogLevel && Purchases.LOG_LEVEL) {
      Purchases.setLogLevel(Purchases.LOG_LEVEL.INFO);
    }
    Purchases.configure({ apiKey });
    initialized = true;
    lastInitFailureReason = null;
    lastInitFailureDetail = null;
    const keyHint = `${apiKey.slice(0, 5)}…${apiKey.slice(-4)}`;
    console.log(
      `[RevenueCat] Configured (platform=${Platform.OS} key=${keyHint})`,
    );
    return true;
  } catch (err) {
    lastInitFailureReason = "configure_failed";
    lastInitFailureDetail =
      err instanceof Error ? err.message : "Purchases.configure() threw";
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
  } catch {
    // logOut throws if user is anonymous — safe to ignore
  }
}

type SubscriptionContextValue = {
  available: boolean;
  isSubscribed: boolean;
  customerInfo: CustomerInfo | null;
  offerings: PurchasesOfferings | null;
  isLoading: boolean;
  purchase: (pkg: PurchasesPackage) => Promise<MakePurchaseResult>;
  restore: () => Promise<CustomerInfo>;
  isPurchasing: boolean;
  isRestoring: boolean;
  refetch: () => void;
};

const Context = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (Platform.OS === "web") return;
    let cancelled = false;
    (async () => {
      const ok = await initializeRevenueCat();
      if (!cancelled) setReady(ok);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const customerInfoQuery = useQuery<CustomerInfo>({
    queryKey: ["revenuecat", "customer-info"],
    enabled: ready,
    staleTime: 60 * 1000,
    retry: 2,
    queryFn: async () => {
      const Purchases = await loadPurchasesModule();
      if (!Purchases) throw new Error("RevenueCat SDK unavailable");
      return Purchases.getCustomerInfo();
    },
  });

  const offeringsQuery = useQuery<PurchasesOfferings>({
    queryKey: ["revenuecat", "offerings"],
    enabled: ready,
    staleTime: 300 * 1000,
    retry: 2,
    queryFn: async () => {
      const Purchases = await loadPurchasesModule();
      if (!Purchases) throw new Error("RevenueCat SDK unavailable");
      return Purchases.getOfferings();
    },
  });

  const purchaseMutation = useMutation<MakePurchaseResult, Error, PurchasesPackage>({
    mutationFn: async (pkg) => {
      const Purchases = await loadPurchasesModule();
      if (!Purchases) throw new Error("RevenueCat unavailable");
      return Purchases.purchasePackage(pkg);
    },
    onSuccess: () => {
      customerInfoQuery.refetch();
    },
  });

  const restoreMutation = useMutation<CustomerInfo>({
    mutationFn: async () => {
      const Purchases = await loadPurchasesModule();
      if (!Purchases) throw new Error("RevenueCat unavailable");
      return Purchases.restorePurchases();
    },
    onSuccess: () => {
      customerInfoQuery.refetch();
    },
  });

  const isSubscribed =
    !!customerInfoQuery.data?.entitlements?.active?.[REVENUECAT_ENTITLEMENT_IDENTIFIER];

  const value: SubscriptionContextValue = {
    available: ready,
    isSubscribed,
    customerInfo: customerInfoQuery.data ?? null,
    offerings: offeringsQuery.data ?? null,
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

export type { CustomerInfo, PurchasesOfferings, PurchasesPackage, PurchasesStoreProduct };
