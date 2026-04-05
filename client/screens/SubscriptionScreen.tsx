import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Platform,
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
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

export default function SubscriptionScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { hasActiveSubscription, refreshUser, token } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const subscribeMutation = useMutation({
    mutationFn: async () => {
      const baseUrl = getApiUrl();
      const res = await fetch(`${baseUrl}api/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        throw new Error("Failed to create checkout session");
      }
      return res.json();
    },
    onSuccess: async (data) => {
      if (data.url) {
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
          } catch (e) {
            console.warn("Subscription sync failed:", e);
          }
          await refreshUser();
        }
      }
    },
  });

  const manageMutation = useMutation({
    mutationFn: async () => {
      const baseUrl = getApiUrl();
      const res = await fetch(`${baseUrl}api/billing-portal`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        throw new Error("Failed to create portal session");
      }
      return res.json();
    },
    onSuccess: async (data) => {
      if (data.url) {
        if (Platform.OS === "web") {
          window.location.href = data.url;
        } else {
          await WebBrowser.openBrowserAsync(data.url);
          await refreshUser();
        }
      }
    },
  });

  function handleSubscribe() {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    subscribeMutation.mutate();
  }

  function handleManage() {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    manageMutation.mutate();
  }

  const features = [
    {
      icon: "headphones" as const,
      text: "Unlimited access to all binaural beats",
    },
    { icon: "list" as const, text: "Create unlimited playlists" },
    { icon: "heart" as const, text: "Save your favorite tracks" },
    { icon: "x" as const, text: "Cancel anytime" },
  ];

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollViewCompat
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: headerHeight + Spacing.xl,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
      >
        {hasActiveSubscription ? (
          <>
            <View style={styles.statusCard}>
              <View style={styles.activeIcon}>
                <Feather
                  name="check-circle"
                  size={48}
                  color={Colors.dark.success}
                />
              </View>
              <ThemedText type="h3" style={styles.statusTitle}>
                Active Subscription
              </ThemedText>
              <ThemedText style={styles.statusText}>
                You have full access to all Beat Haven features
              </ThemedText>
            </View>

            <Button
              onPress={handleManage}
              disabled={manageMutation.isPending}
              style={styles.manageButton}
            >
              {manageMutation.isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                "Manage Subscription"
              )}
            </Button>
          </>
        ) : (
          <>
            <View style={styles.priceSection}>
              <ThemedText style={styles.price}>$4.99</ThemedText>
              <ThemedText style={styles.priceInterval}>per month</ThemedText>
            </View>

            <Card style={styles.featuresCard}>
              {features.map((feature, index) => (
                <View key={index} style={styles.featureRow}>
                  <Feather
                    name={feature.icon}
                    size={20}
                    color={Colors.dark.success}
                  />
                  <ThemedText style={styles.featureText}>
                    {feature.text}
                  </ThemedText>
                </View>
              ))}
            </Card>

            <Button
              onPress={handleSubscribe}
              disabled={subscribeMutation.isPending}
              style={styles.subscribeButton}
            >
              {subscribeMutation.isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                "Start 7-Day Free Trial"
              )}
            </Button>

            <ThemedText style={styles.disclaimer}>
              After your free trial, you'll be charged $4.99/month. Cancel
              anytime.
            </ThemedText>
          </>
        )}
      </KeyboardAwareScrollViewCompat>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    alignItems: "center",
  },
  statusCard: {
    alignItems: "center",
    marginBottom: Spacing["2xl"],
  },
  activeIcon: {
    marginBottom: Spacing.lg,
  },
  statusTitle: {
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  statusText: {
    color: Colors.dark.textSecondary,
    textAlign: "center",
  },
  manageButton: {
    width: "100%",
  },
  priceSection: {
    alignItems: "center",
    marginBottom: Spacing["2xl"],
    paddingTop: Spacing.lg,
  },
  price: {
    fontSize: 36,
    fontWeight: "700",
    color: Colors.dark.link,
    lineHeight: 44,
  },
  priceInterval: {
    color: Colors.dark.textSecondary,
    fontSize: 18,
  },
  featuresCard: {
    width: "100%",
    marginBottom: Spacing["2xl"],
    padding: Spacing.xl,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
  },
  featureText: {
    flex: 1,
    fontSize: 16,
  },
  subscribeButton: {
    width: "100%",
    marginBottom: Spacing.lg,
  },
  disclaimer: {
    color: Colors.dark.textSecondary,
    textAlign: "center",
    fontSize: 13,
  },
});
