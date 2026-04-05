import React, { useState, useEffect } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius } from "@/constants/theme";

const STORAGE_KEY = "headphones_tip_dismissed";

interface HeadphonesBannerProps {
  variant?: "default" | "overlay";
}

export function HeadphonesBanner({ variant = "default" }: HeadphonesBannerProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val !== "true") setVisible(true);
    });
  }, []);

  async function handleDismiss() {
    await AsyncStorage.setItem(STORAGE_KEY, "true");
    setVisible(false);
  }

  if (!visible) return null;

  const isOverlay = variant === "overlay";

  return (
    <View style={[styles.banner, isOverlay ? styles.bannerOverlay : styles.bannerDefault]} testID="banner-headphones-tip">
      <Feather name="headphones" size={16} color="#7DD3FC" style={styles.icon} />
      <View style={styles.textBlock}>
        <ThemedText style={styles.primary}>
          Headphones required for binaural effect
        </ThemedText>
        <ThemedText style={styles.secondary}>
          Use a comfortable, low volume for best results
        </ThemedText>
      </View>
      <Pressable onPress={handleDismiss} hitSlop={10} testID="button-dismiss-headphones-tip">
        <Feather name="x" size={16} color="rgba(255,255,255,0.5)" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    borderRadius: BorderRadius.md,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  bannerDefault: {
    backgroundColor: "rgba(125, 211, 252, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(125, 211, 252, 0.25)",
  },
  bannerOverlay: {
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    borderWidth: 1,
    borderColor: "rgba(125, 211, 252, 0.20)",
  },
  icon: {
    flexShrink: 0,
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  primary: {
    fontSize: 12,
    fontWeight: "600",
    color: "#BAE6FD",
    lineHeight: 16,
  },
  secondary: {
    fontSize: 11,
    color: "rgba(255,255,255,0.50)",
    lineHeight: 15,
  },
});
