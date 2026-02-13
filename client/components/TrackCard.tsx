import React from "react";
import { View, StyleSheet, Pressable, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  withTiming,
  Easing,
  runOnJS,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { Track } from "@/contexts/PlayerContext";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

interface TrackCardProps {
  track: Track;
  onPress: () => void;
  color: string;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onAddToPlaylist?: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function TrackCard({ track, onPress, color, isFavorite, onToggleFavorite, onAddToPlaylist }: TrackCardProps) {
  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(0);
  const glowScale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));

  function handlePressIn() {
    scale.value = withSpring(0.96, { damping: 15, stiffness: 150 });
  }

  function handlePressOut() {
    scale.value = withSpring(1, { damping: 15, stiffness: 150 });
  }

  function triggerHaptic() {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }

  function handlePress() {
    triggerHaptic();
    
    glowOpacity.value = withSequence(
      withTiming(0.8, { duration: 150, easing: Easing.out(Easing.ease) }),
      withTiming(0, { duration: 400, easing: Easing.out(Easing.ease) })
    );
    glowScale.value = withSequence(
      withTiming(1.15, { duration: 150, easing: Easing.out(Easing.ease) }),
      withTiming(1.3, { duration: 400, easing: Easing.out(Easing.ease) })
    );
    
    setTimeout(onPress, 100);
  }

  function formatDuration(seconds: number) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  return (
    <View style={styles.wrapper}>
      <Animated.View
        style={[
          styles.glowEffect,
          { backgroundColor: color },
          glowStyle,
        ]}
      />
      <AnimatedPressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.container, animatedStyle]}
      >
        <View style={styles.topRow}>
          <View style={[styles.iconContainer, { backgroundColor: color + "20" }]}>
            <Feather name="headphones" size={28} color={color} />
          </View>
          <View style={styles.actionButtons}>
            {onToggleFavorite ? (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  if (Platform.OS !== "web") {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                  onToggleFavorite();
                }}
                style={styles.heartButton}
                hitSlop={8}
                testID={`button-favorite-${track.id}`}
              >
                <Feather
                  name={isFavorite ? "heart" : "heart"}
                  size={18}
                  color={isFavorite ? "#FF6B8A" : "rgba(255,255,255,0.3)"}
                />
              </Pressable>
            ) : null}
            {onAddToPlaylist ? (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  if (Platform.OS !== "web") {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }
                  onAddToPlaylist();
                }}
                style={styles.heartButton}
                hitSlop={8}
                testID={`button-add-playlist-${track.id}`}
              >
                <Feather name="plus" size={18} color="rgba(255,255,255,0.3)" />
              </Pressable>
            ) : null}
          </View>
        </View>
        <ThemedText style={styles.title} numberOfLines={2} ellipsizeMode="tail">
          {track.title}
        </ThemedText>
        <View style={styles.meta}>
          <ThemedText style={styles.frequency} numberOfLines={1} ellipsizeMode="tail">
            {track.frequency}
          </ThemedText>
          <ThemedText style={styles.duration}>{formatDuration(track.duration)}</ThemedText>
        </View>
        <View style={[styles.playButton, { backgroundColor: color }]}>
          <Feather name="play" size={16} color="#FFFFFF" style={{ marginLeft: 2 }} />
        </View>
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "relative",
  },
  glowEffect: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: BorderRadius.lg,
  },
  container: {
    width: 160,
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    overflow: "hidden",
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  heartButton: {
    padding: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: Spacing.xs,
    flexShrink: 1,
  },
  meta: {
    flexDirection: "column",
    marginBottom: Spacing.md,
    gap: 2,
  },
  frequency: {
    color: Colors.dark.textSecondary,
    fontSize: 11,
    flexShrink: 1,
  },
  duration: {
    color: Colors.dark.textSecondary,
    fontSize: 11,
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
