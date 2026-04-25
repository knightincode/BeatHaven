import React, { useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Pressable,
  Modal,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as WebBrowser from "expo-web-browser";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useAuth } from "@/contexts/AuthContext";
import {
  useSubscription,
  type PurchasesPackage,
  getRevenueCatInitFailureReason,
  getRevenueCatInitFailureDetail,
} from "@/lib/revenuecat";
import { getApiUrl } from "@/lib/query-client";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

type PlanTier = "monthly" | "yearly" | "lifetime";

type ServerPlan = {
  tier: PlanTier;
  amount: number;
  currency: string;
  interval: "month" | "year" | null;
  mode: "subscription" | "payment";
  trialDays: number;
  productName: string;
  priceString: string;
};

const TIER_ORDER: PlanTier[] = ["monthly", "yearly", "lifetime"];

const TIER_LABEL: Record<
  PlanTier,
  { title: string; sub: string; badge?: string }
> = {
  monthly: { title: "Monthly", sub: "Flexible, billed monthly" },
  yearly: {
    title: "Yearly",
    sub: "Best value — save over 30%",
    badge: "Most Popular",
  },
  lifetime: { title: "Lifetime", sub: "One payment, forever" },
};

const PREMIUM_FEATURES = [
  { icon: "headphones" as const, text: "Unlimited binaural beats library" },
  { icon: "list" as const, text: "Create unlimited playlists" },
  { icon: "heart" as const, text: "Save your favorite tracks" },
  { icon: "zap" as const, text: "Hi-fi streaming quality" },
];

export default function SubscriptionScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { hasActiveSubscription, user, refreshUser, token } = useAuth();
  const rcSubscription = useSubscription();

  const [selectedTier, setSelectedTier] = useState<PlanTier>("yearly");
  const [errorModal, setErrorModal] = useState<{
    title: string;
    message: string;
  } | null>(null);

  const pricesQuery = useQuery<{ plans: ServerPlan[] }>({
    queryKey: ["/api/subscription/prices"],
  });

  const serverPlans = pricesQuery.data?.plans ?? [];
  const planByTier = useMemo(() => {
    const map: Partial<Record<PlanTier, ServerPlan>> = {};
    for (const p of serverPlans) map[p.tier] = p;
    return map;
  }, [serverPlans]);

  const rcPackages = useMemo<
    Partial<Record<PlanTier, PurchasesPackage>>
  >(() => {
    const offering = rcSubscription.offerings?.current;
    if (!offering) return {};
    const pkgs: PurchasesPackage[] = offering.availablePackages ?? [];
    const map: Partial<Record<PlanTier, PurchasesPackage>> = {};
    for (const pkg of pkgs) {
      const id = pkg.product?.identifier;
      if (!id) continue;
      if (id.includes("monthly")) map.monthly = pkg;
      else if (id.includes("yearly") || id.includes("annual")) map.yearly = pkg;
      else if (id.includes("lifetime")) map.lifetime = pkg;
    }
    return map;
  }, [rcSubscription.offerings]);

  const useRevenueCat = Platform.OS !== "web" && rcSubscription.available;

  const stripeCheckoutMutation = useMutation({
    mutationFn: async (tier: PlanTier) => {
      const baseUrl = getApiUrl();
      const res = await fetch(`${baseUrl}api/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ tier }),
      });
      if (!res.ok) throw new Error("Failed to create checkout session");
      return res.json();
    },
    onSuccess: async (data) => {
      if (!data.url) return;
      if (Platform.OS === "web") {
        window.location.href = data.url;
      } else {
        await WebBrowser.openBrowserAsync(data.url);
        try {
          const baseUrl = getApiUrl();
          await fetch(`${baseUrl}api/sync-subscription`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
          });
        } catch {}
        await refreshUser();
      }
    },
  });

  const manageMutation = useMutation({
    mutationFn: async () => {
      const baseUrl = getApiUrl();
      const res = await fetch(`${baseUrl}api/billing-portal`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to create portal session");
      return res.json();
    },
    onSuccess: async (data) => {
      if (!data.url) return;
      if (Platform.OS === "web") window.location.href = data.url;
      else {
        await WebBrowser.openBrowserAsync(data.url);
        await refreshUser();
      }
    },
  });

  function hapticTap() {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
  }

  function handleContinue() {
    hapticTap();
    if (Platform.OS !== "web") {
      if (!rcSubscription.available) {
        const reason = getRevenueCatInitFailureReason();
        const detail = getRevenueCatInitFailureDetail();
        console.warn(
          `[SubscriptionScreen] Store Unavailable shown — reason=${reason ?? "unknown"} detail=${detail ?? "n/a"} platform=${Platform.OS}`,
        );
        setErrorModal({
          title: "Store Unavailable",
          message:
            "In-app purchases are not available right now. Please try again in a moment or restart the app.",
        });
        return;
      }
      const pkg = rcPackages[selectedTier];
      if (!pkg) {
        setErrorModal({
          title: "Product Not Available",
          message:
            "This plan isn't available on your device yet. Please try again shortly or restore a previous purchase.",
        });
        return;
      }
      runRcPurchase(pkg);
      return;
    }
    stripeCheckoutMutation.mutate(selectedTier, {
      onError: (err: unknown) => {
        const message =
          err instanceof Error
            ? err.message
            : "We couldn't start your checkout. Please try again.";
        setErrorModal({ title: "Checkout Unavailable", message });
      },
    });
  }

  async function runRcPurchase(pkg: PurchasesPackage) {
    try {
      await rcSubscription.purchase(pkg);
      await refreshUser();
    } catch (err: unknown) {
      const e = err as
        | { userCancelled?: boolean; message?: string }
        | undefined;
      if (e?.userCancelled) return;
      setErrorModal({
        title: "Purchase Failed",
        message:
          e?.message ??
          "The purchase could not be completed. Please try again.",
      });
    }
  }

  async function handleRestore() {
    hapticTap();
    if (useRevenueCat) {
      try {
        await rcSubscription.restore();
        await refreshUser();
        setErrorModal({
          title: "Restore Complete",
          message: "Your purchases have been restored.",
        });
      } catch (err: any) {
        setErrorModal({
          title: "Restore Failed",
          message: err?.message ?? "We couldn't restore your purchases.",
        });
      }
    } else {
      try {
        const baseUrl = getApiUrl();
        await fetch(`${baseUrl}api/sync-subscription`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        await refreshUser();
      } catch (err: any) {
        setErrorModal({
          title: "Restore Failed",
          message: err?.message ?? "We couldn't sync your subscription.",
        });
      }
    }
  }

  async function openStoreManagement() {
    hapticTap();
    const url =
      Platform.OS === "ios"
        ? "https://apps.apple.com/account/subscriptions"
        : "https://play.google.com/store/account/subscriptions";
    try {
      await Linking.openURL(url);
    } catch {
      setErrorModal({
        title: "Unable to Open",
        message:
          "Please manage your subscription from your device's store app.",
      });
    }
  }

  const priceForTier = (
    tier: PlanTier,
  ): { price: string; sub: string; trialDays: number } => {
    if (useRevenueCat && rcPackages[tier]) {
      const p = rcPackages[tier]?.product;
      const priceString = p?.priceString ?? "—";
      const period =
        tier === "monthly"
          ? "/month"
          : tier === "yearly"
            ? "/year"
            : "one-time";
      return {
        price: priceString,
        sub: period,
        trialDays:
          p?.introPrice?.periodNumberOfUnits ?? (tier === "lifetime" ? 0 : 7),
      };
    }
    const sp = planByTier[tier];
    if (!sp) return { price: "—", sub: "", trialDays: 0 };
    const period =
      sp.interval === "month"
        ? "/month"
        : sp.interval === "year"
          ? "/year"
          : "one-time";
    return { price: sp.priceString, sub: period, trialDays: sp.trialDays };
  };

  const isWorking =
    stripeCheckoutMutation.isPending ||
    rcSubscription.isPurchasing ||
    rcSubscription.isRestoring;

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollViewCompat
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: headerHeight + Spacing.xl,
            paddingBottom: insets.bottom + Spacing["2xl"],
          },
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
      >
        {hasActiveSubscription ? (
          <>
            <View style={styles.statusCard}>
              <Feather
                name="check-circle"
                size={48}
                color={Colors.dark.success}
              />
              <ThemedText type="h3" style={styles.statusTitle}>
                You're Premium
              </ThemedText>
              <ThemedText style={styles.statusText}>
                {user?.plan && user.plan !== "none"
                  ? `Current plan: ${user.plan.charAt(0).toUpperCase() + user.plan.slice(1)}`
                  : "Full access to all Beat Haven features"}
              </ThemedText>
            </View>

            <Card style={styles.featuresCard}>
              {PREMIUM_FEATURES.map((f) => (
                <View key={f.text} style={styles.featureRow}>
                  <Feather
                    name={f.icon}
                    size={20}
                    color={Colors.dark.success}
                  />
                  <ThemedText style={styles.featureText}>{f.text}</ThemedText>
                </View>
              ))}
            </Card>

            {user?.plan === "lifetime" ? null : user?.subscriptionSource ===
              "revenuecat" ? (
              <Button
                onPress={openStoreManagement}
                style={styles.primaryButton}
                testID="button-manage-subscription"
              >
                {Platform.OS === "ios"
                  ? "Manage in App Store"
                  : Platform.OS === "android"
                    ? "Manage in Google Play"
                    : "Manage Subscription"}
              </Button>
            ) : (
              <Button
                onPress={() =>
                  manageMutation.mutate(undefined, {
                    onError: (err: unknown) =>
                      setErrorModal({
                        title: "Unable to Open Billing",
                        message:
                          err instanceof Error
                            ? err.message
                            : "Please try again shortly.",
                      }),
                  })
                }
                disabled={manageMutation.isPending}
                style={styles.primaryButton}
                testID="button-manage-subscription"
              >
                {manageMutation.isPending ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  "Manage Subscription"
                )}
              </Button>
            )}

            <Pressable onPress={handleRestore} style={styles.restoreLink}>
              <ThemedText style={styles.restoreText}>
                Restore Purchases
              </ThemedText>
            </Pressable>
          </>
        ) : (
          <>
            <View style={styles.heroSection}>
              <ThemedText type="h2" style={styles.heroTitle}>
                Unlock Beat Haven Premium
              </ThemedText>
              <ThemedText style={styles.heroSub}>
                Choose the plan that fits you
              </ThemedText>
            </View>

            <View style={styles.tiersContainer}>
              {TIER_ORDER.map((tier) => {
                const info = TIER_LABEL[tier];
                const p = priceForTier(tier);
                const isSelected = selectedTier === tier;
                const hasPrice = p.price !== "—";
                return (
                  <Pressable
                    key={tier}
                    onPress={() => {
                      hapticTap();
                      setSelectedTier(tier);
                    }}
                    disabled={!hasPrice}
                    style={[
                      styles.tierCard,
                      isSelected && styles.tierCardSelected,
                      !hasPrice && styles.tierCardDisabled,
                    ]}
                    testID={`tier-${tier}`}
                  >
                    {info.badge ? (
                      <View style={styles.badge}>
                        <ThemedText style={styles.badgeText}>
                          {info.badge}
                        </ThemedText>
                      </View>
                    ) : null}
                    <View style={styles.tierHeader}>
                      <View style={styles.radio}>
                        {isSelected ? <View style={styles.radioDot} /> : null}
                      </View>
                      <View style={styles.tierTitleBlock}>
                        <ThemedText style={styles.tierTitle}>
                          {info.title}
                        </ThemedText>
                        <ThemedText style={styles.tierSub}>
                          {info.sub}
                        </ThemedText>
                      </View>
                      <View style={styles.tierPriceBlock}>
                        <ThemedText style={styles.tierPrice}>
                          {p.price}
                        </ThemedText>
                        <ThemedText style={styles.tierPeriod}>
                          {p.sub}
                        </ThemedText>
                      </View>
                    </View>
                    {p.trialDays > 0 && tier !== "lifetime" ? (
                      <ThemedText style={styles.trialText}>
                        {p.trialDays}-day free trial
                      </ThemedText>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>

            <Card style={styles.featuresCard}>
              {PREMIUM_FEATURES.map((f) => (
                <View key={f.text} style={styles.featureRow}>
                  <Feather
                    name={f.icon}
                    size={20}
                    color={Colors.dark.success}
                  />
                  <ThemedText style={styles.featureText}>{f.text}</ThemedText>
                </View>
              ))}
            </Card>

            <Button
              onPress={handleContinue}
              disabled={isWorking}
              style={styles.primaryButton}
              testID="button-subscribe"
            >
              {isWorking ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : selectedTier === "lifetime" ? (
                "Purchase Lifetime Access"
              ) : priceForTier(selectedTier).trialDays > 0 ? (
                `Start ${priceForTier(selectedTier).trialDays}-Day Free Trial`
              ) : (
                "Continue"
              )}
            </Button>

            <Pressable onPress={handleRestore} style={styles.restoreLink}>
              <ThemedText style={styles.restoreText}>
                Restore Purchases
              </ThemedText>
            </Pressable>

            <ThemedText style={styles.disclaimer}>
              {selectedTier === "lifetime"
                ? "One-time payment. Lifetime access to all features."
                : `You'll be charged ${priceForTier(selectedTier).price}${priceForTier(selectedTier).sub} after any trial. Cancel anytime.`}
            </ThemedText>
          </>
        )}
      </KeyboardAwareScrollViewCompat>

      <Modal
        visible={errorModal !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setErrorModal(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <ThemedText type="h3" style={styles.modalTitle}>
              {errorModal?.title ?? ""}
            </ThemedText>
            <ThemedText style={styles.modalBody}>
              {errorModal?.message ?? ""}
            </ThemedText>
            <View style={styles.modalButtons}>
              <Button
                onPress={() => setErrorModal(null)}
                style={styles.modalConfirm}
                testID="button-dismiss-error"
              >
                OK
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg },
  heroSection: {
    alignItems: "center",
    marginBottom: Spacing.xl,
    paddingTop: Spacing.md,
  },
  heroTitle: { textAlign: "center", marginBottom: Spacing.sm },
  heroSub: {
    textAlign: "center",
    color: Colors.dark.textSecondary,
    fontSize: 15,
  },
  tiersContainer: { width: "100%", marginBottom: Spacing.xl, gap: Spacing.md },
  tierCard: {
    width: "100%",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    borderColor: Colors.dark.border ?? "rgba(255,255,255,0.12)",
    backgroundColor: Colors.dark.backgroundElevated ?? "rgba(255,255,255,0.04)",
    position: "relative",
  },
  tierCardSelected: {
    borderColor: Colors.dark.link,
    backgroundColor: "rgba(56,139,253,0.08)",
  },
  tierCardDisabled: { opacity: 0.4 },
  badge: {
    position: "absolute",
    top: -10,
    alignSelf: "center",
    backgroundColor: Colors.dark.link,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: BorderRadius.full ?? 999,
  },
  badgeText: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" },
  tierHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.dark.link,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.dark.link,
  },
  tierTitleBlock: { flex: 1 },
  tierTitle: { fontSize: 16, fontWeight: "700" },
  tierSub: { fontSize: 13, color: Colors.dark.textSecondary, marginTop: 2 },
  tierPriceBlock: { alignItems: "flex-end" },
  tierPrice: { fontSize: 18, fontWeight: "700", color: Colors.dark.link },
  tierPeriod: { fontSize: 12, color: Colors.dark.textSecondary },
  trialText: {
    marginTop: Spacing.sm,
    marginLeft: 34,
    fontSize: 12,
    color: Colors.dark.success,
    fontWeight: "600",
  },
  featuresCard: {
    width: "100%",
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  featureText: { flex: 1, fontSize: 15 },
  primaryButton: { width: "100%", marginBottom: Spacing.md },
  restoreLink: { paddingVertical: Spacing.sm, marginBottom: Spacing.md },
  restoreText: {
    textAlign: "center",
    color: Colors.dark.link,
    fontSize: 14,
    fontWeight: "600",
  },
  disclaimer: {
    color: Colors.dark.textSecondary,
    textAlign: "center",
    fontSize: 12,
    marginTop: Spacing.sm,
  },
  statusCard: {
    alignItems: "center",
    marginBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  statusTitle: { marginTop: Spacing.md },
  statusText: { color: Colors.dark.textSecondary, textAlign: "center" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  modalCard: {
    backgroundColor: Colors.dark.backgroundElevated ?? "#1a1a1a",
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    gap: Spacing.md,
  },
  modalTitle: { textAlign: "center" },
  modalBody: { textAlign: "center", color: Colors.dark.textSecondary },
  modalButtons: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  modalCancel: { flex: 1, backgroundColor: "rgba(255,255,255,0.1)" },
  modalConfirm: { flex: 1 },
});
