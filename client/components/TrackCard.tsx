import React from "react";
import { View, StyleSheet, Pressable, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { Track } from "@/contexts/PlayerContext";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

const CARD_WIDTH = 160;
const CARD_HEIGHT = 250;

interface TrackCardProps {
  track: Track;
  onPress: () => void;
  color: string;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onAddToPlaylist?: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function TrackCard({
  track,
  onPress,
  color,
  isFavorite,
  onToggleFavorite,
  onAddToPlaylist,
}: TrackCardProps) {
  const scale = useSharedValue(1);
  const glowShadowOpacity = useSharedValue(0);
  const glowShadowRadius = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    shadowOpacity: glowShadowOpacity.value + 0.25,
    shadowRadius: glowShadowRadius.value + 8,
    elevation: glowShadowOpacity.value * 12 + 3,
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

    glowShadowOpacity.value = withSequence(
      withTiming(0.65, { duration: 150, easing: Easing.out(Easing.ease) }),
      withTiming(0, { duration: 350, easing: Easing.out(Easing.ease) }),
    );
    glowShadowRadius.value = withSequence(
      withTiming(18, { duration: 150, easing: Easing.out(Easing.ease) }),
      withTiming(0, { duration: 350, easing: Easing.out(Easing.ease) }),
    );

    setTimeout(onPress, 100);
  }

  return (
    <View style={styles.wrapper}>
      <AnimatedPressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.container,
          {
            shadowColor: color,
            shadowOffset: { width: 0, height: 2 },
            borderColor: color + "33",
          },
          animatedStyle,
        ]}
      >
        <LinearGradient
          colors={[color + "28", color + "0D", "transparent"]}
          locations={[0, 0.4, 1]}
          style={styles.gradientOverlay}
        />
        <LinearGradient
          colors={["transparent", color + "0D", color + "28"]}
          locations={[0, 0.6, 1]}
          style={styles.gradientOverlayBottom}
        />
        <View style={styles.cardContent}>
          <View style={styles.topRow}>
            <View
              style={[styles.iconContainer, { backgroundColor: color + "25" }]}
            >
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
                  <Feather
                    name="plus"
                    size={18}
                    color="rgba(255,255,255,0.3)"
                  />
                </Pressable>
              ) : null}
            </View>
          </View>
          <View style={styles.contentArea}>
            <View>
              <ThemedText style={styles.title}>{track.title}</ThemedText>
              <View style={styles.meta}>
                <ThemedText style={styles.frequency}>
                  {track.frequency}
                </ThemedText>
              </View>
            </View>
            <View style={[styles.playButton, { backgroundColor: color }]}>
              <Feather
                name="play"
                size={16}
                color="#000000"
                style={{ marginLeft: 2 }}
              />
            </View>
          </View>
        </View>
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "relative",
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  },
  container: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    overflow: "hidden",
  },
  gradientOverlay: {
    position: "relative",
    top: 0,
    left: 0,
    right: 0,
    height: "2%",
    borderTopLeftRadius: BorderRadius.md,
    borderTopRightRadius: BorderRadius.md,
  },
  gradientOverlayBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "2%",
    borderBottomLeftRadius: BorderRadius.xl,
    borderBottomRightRadius: BorderRadius.xl,
  },
  cardContent: {
    flex: 1,
    padding: Spacing.lg,
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
  contentArea: {
    flex: 1,
    justifyContent: "space-between",
  },
  title: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  meta: {
    flexDirection: "column",
    gap: 2,
  },
  frequency: {
    color: Colors.dark.textSecondary,
    fontSize: 11,
    lineHeight: 16,
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
