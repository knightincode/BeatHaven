import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { Track } from "@/contexts/PlayerContext";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

interface TrackCardProps {
  track: Track;
  onPress: () => void;
  color: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function TrackCard({ track, onPress, color }: TrackCardProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  function handlePressIn() {
    scale.value = withSpring(0.96, { damping: 15, stiffness: 150 });
  }

  function handlePressOut() {
    scale.value = withSpring(1, { damping: 15, stiffness: 150 });
  }

  function formatDuration(seconds: number) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.container, animatedStyle]}
    >
      <View style={[styles.iconContainer, { backgroundColor: color + "20" }]}>
        <Feather name="headphones" size={28} color={color} />
      </View>
      <ThemedText style={styles.title} numberOfLines={1}>
        {track.title}
      </ThemedText>
      <View style={styles.meta}>
        <ThemedText style={styles.frequency}>{track.frequency}</ThemedText>
        <ThemedText style={styles.duration}>{formatDuration(track.duration)}</ThemedText>
      </View>
      <View style={[styles.playButton, { backgroundColor: color }]}>
        <Feather name="play" size={16} color="#FFFFFF" style={{ marginLeft: 2 }} />
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 160,
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  meta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  frequency: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
  },
  duration: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
  },
  playButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-end",
  },
});
