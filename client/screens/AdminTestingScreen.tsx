import React, { useState } from "react";
import { View, StyleSheet, Switch, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

export default function AdminTestingScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { user, hasActiveSubscription, refreshUser } = useAuth();
  const [isToggling, setIsToggling] = useState(false);

  async function handleToggle() {
    if (isToggling) return;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setIsToggling(true);
    try {
      await apiRequest("POST", "/api/admin/toggle-subscription");
      await refreshUser();
    } catch (error) {
      console.error("Failed to toggle subscription:", error);
    } finally {
      setIsToggling(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <View
        style={[
          styles.content,
          { paddingTop: headerHeight + Spacing.xl, paddingBottom: insets.bottom + Spacing.xl },
        ]}
      >
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Feather name="tool" size={28} color={Colors.dark.accent} />
          </View>
          <ThemedText type="h3" style={styles.title}>
            Admin Testing
          </ThemedText>
          <ThemedText style={styles.description}>
            Simulate subscription states to test both free and premium user experiences.
          </ThemedText>
        </View>

        <Card style={styles.toggleCard}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <ThemedText style={styles.toggleLabel}>
                Premium Subscription
              </ThemedText>
              <ThemedText style={styles.toggleSubtitle}>
                {hasActiveSubscription
                  ? "Viewing as a premium user"
                  : "Viewing as a free user"}
              </ThemedText>
            </View>
            {isToggling ? (
              <ActivityIndicator size="small" color={Colors.dark.link} />
            ) : (
              <Switch
                testID="switch-toggle-subscription"
                value={hasActiveSubscription}
                onValueChange={handleToggle}
                trackColor={{
                  false: Colors.dark.backgroundSecondary,
                  true: Colors.dark.success + "80",
                }}
                thumbColor={hasActiveSubscription ? Colors.dark.success : Colors.dark.textSecondary}
              />
            )}
          </View>
        </Card>

        <View style={styles.statusSection}>
          <View style={[styles.statusIndicator, hasActiveSubscription ? styles.statusActive : styles.statusInactive]}>
            <Feather
              name={hasActiveSubscription ? "check-circle" : "x-circle"}
              size={18}
              color={hasActiveSubscription ? Colors.dark.success : Colors.dark.textSecondary}
            />
            <ThemedText
              style={[
                styles.statusText,
                hasActiveSubscription ? { color: Colors.dark.success } : {},
              ]}
            >
              {hasActiveSubscription ? "Active" : "Inactive"}
            </ThemedText>
          </View>
        </View>

        <Card style={styles.infoCard}>
          <ThemedText style={styles.infoTitle}>What this does</ThemedText>
          <View style={styles.infoItem}>
            <Feather name="toggle-right" size={16} color={Colors.dark.success} />
            <ThemedText style={styles.infoText}>
              ON: Full access to all categories, playlists, and unlimited playback
            </ThemedText>
          </View>
          <View style={styles.infoItem}>
            <Feather name="toggle-left" size={16} color={Colors.dark.textSecondary} />
            <ThemedText style={styles.infoText}>
              OFF: First+last track per category, 5-minute previews, no playlists
            </ThemedText>
          </View>
        </Card>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing["2xl"],
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.dark.accent + "20",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  title: {
    marginBottom: Spacing.sm,
  },
  description: {
    color: Colors.dark.textSecondary,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
  },
  toggleCard: {
    marginBottom: Spacing.lg,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  toggleInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  toggleSubtitle: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  statusSection: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  statusIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
  },
  statusActive: {
    backgroundColor: Colors.dark.success + "15",
  },
  statusInactive: {
    backgroundColor: Colors.dark.backgroundSecondary,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.dark.textSecondary,
  },
  infoCard: {
    gap: Spacing.md,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.dark.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: Colors.dark.textSecondary,
    lineHeight: 20,
  },
});
