import React, { useEffect, useState } from "react";
import { View, StyleSheet, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

let useNetInfo: any = null;
try {
  const NetInfo = require("@react-native-community/netinfo");
  useNetInfo = NetInfo.useNetInfo;
} catch (e) {}

export function OfflineIndicator() {
  const insets = useSafeAreaInsets();
  const [isOffline, setIsOffline] = useState(false);
  const slideY = useSharedValue(-60);
  const pulseOpacity = useSharedValue(1);

  useEffect(() => {
    if (Platform.OS === "web") {
      function handleOnline() {
        setIsOffline(false);
      }
      function handleOffline() {
        setIsOffline(true);
      }
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
      setIsOffline(!navigator.onLine);
      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }
  }, []);

  if (useNetInfo && Platform.OS !== "web") {
    const netInfo = useNetInfo();
    useEffect(() => {
      if (netInfo.isConnected === false) {
        setIsOffline(true);
      } else {
        setIsOffline(false);
      }
    }, [netInfo.isConnected]);
  }

  useEffect(() => {
    if (isOffline) {
      slideY.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.ease) });
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.5, { duration: 1500 }),
          withTiming(1, { duration: 1500 })
        ),
        -1
      );
    } else {
      slideY.value = withTiming(-60, { duration: 300, easing: Easing.in(Easing.ease) });
    }
  }, [isOffline]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slideY.value }],
  }));

  const dotStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  if (!isOffline) return null;

  return (
    <Animated.View style={[styles.container, { paddingTop: insets.top + 4 }, animatedStyle]}>
      <Animated.View style={[styles.dot, dotStyle]} />
      <Feather name="wifi-off" size={14} color="#FFFFFF" />
      <ThemedText style={styles.text}>No internet connection</ThemedText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(233, 75, 60, 0.95)",
    paddingBottom: 8,
    gap: Spacing.xs,
    zIndex: 9999,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FFB74D",
  },
  text: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "500",
  },
});
