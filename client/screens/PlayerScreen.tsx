import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Dimensions,
  Modal,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  interpolate,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { usePlayer } from "@/contexts/PlayerContext";
import { Colors, Spacing, BorderRadius, FrequencyColors } from "@/constants/theme";

const { width, height } = Dimensions.get("window");

function WaveAnimation() {
  const wave1 = useSharedValue(0);
  const wave2 = useSharedValue(0);
  const wave3 = useSharedValue(0);

  useEffect(() => {
    wave1.value = withRepeat(
      withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
    wave2.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 500 }),
        withTiming(1, { duration: 5000, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
    wave3.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 1000 }),
        withTiming(1, { duration: 6000, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
  }, []);

  const style1 = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(wave1.value, [0, 1], [0, -30]) },
      { scaleY: interpolate(wave1.value, [0, 0.5, 1], [1, 1.2, 1]) },
    ],
    opacity: interpolate(wave1.value, [0, 0.5, 1], [0.3, 0.6, 0.3]),
  }));

  const style2 = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(wave2.value, [0, 1], [0, -40]) },
      { scaleY: interpolate(wave2.value, [0, 0.5, 1], [1, 1.3, 1]) },
    ],
    opacity: interpolate(wave2.value, [0, 0.5, 1], [0.2, 0.5, 0.2]),
  }));

  const style3 = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(wave3.value, [0, 1], [0, -50]) },
      { scaleY: interpolate(wave3.value, [0, 0.5, 1], [1, 1.4, 1]) },
    ],
    opacity: interpolate(wave3.value, [0, 0.5, 1], [0.15, 0.4, 0.15]),
  }));

  return (
    <View style={styles.waveContainer}>
      <Animated.View style={[styles.wave, styles.wave3, style3]} />
      <Animated.View style={[styles.wave, styles.wave2, style2]} />
      <Animated.View style={[styles.wave, styles.wave1, style1]} />
    </View>
  );
}

function ParticleAnimation() {
  const particles = Array.from({ length: 20 }, (_, i) => {
    const progress = useSharedValue(0);
    const startX = Math.random() * width;
    const duration = 3000 + Math.random() * 4000;

    useEffect(() => {
      progress.value = withRepeat(
        withTiming(1, { duration, easing: Easing.linear }),
        -1
      );
    }, []);

    const style = useAnimatedStyle(() => ({
      transform: [
        { translateY: interpolate(progress.value, [0, 1], [height, -50]) },
        { translateX: interpolate(progress.value, [0, 0.5, 1], [0, 20, 0]) },
      ],
      opacity: interpolate(progress.value, [0, 0.1, 0.9, 1], [0, 1, 1, 0]),
    }));

    return (
      <Animated.View
        key={i}
        style={[
          styles.particle,
          { left: startX, width: 4 + Math.random() * 4, height: 4 + Math.random() * 4 },
          style,
        ]}
      />
    );
  });

  return <View style={styles.particleContainer}>{particles}</View>;
}

function WaterAnimation() {
  const ripple = useSharedValue(0);

  useEffect(() => {
    ripple.value = withRepeat(
      withTiming(1, { duration: 3000, easing: Easing.out(Easing.ease) }),
      -1
    );
  }, []);

  const ripples = Array.from({ length: 4 }, (_, i) => {
    const style = useAnimatedStyle(() => {
      const delay = i * 0.25;
      const progress = (ripple.value + delay) % 1;
      return {
        transform: [{ scale: interpolate(progress, [0, 1], [0.5, 2.5]) }],
        opacity: interpolate(progress, [0, 0.5, 1], [0.5, 0.3, 0]),
      };
    });

    return <Animated.View key={i} style={[styles.ripple, style]} />;
  });

  return <View style={styles.waterContainer}>{ripples}</View>;
}

export default function PlayerScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const {
    currentTrack,
    isPlaying,
    isLoading,
    progress,
    duration,
    visualType,
    visualEnabled,
    pause,
    resume,
    stop,
    seek,
    setVisualType,
    setVisualEnabled,
  } = usePlayer();

  const [settingsVisible, setSettingsVisible] = useState(false);

  function handleClose() {
    navigation.goBack();
  }

  function handlePlayPause() {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (isPlaying) {
      pause();
    } else {
      resume();
    }
  }

  function handleSeek(position: number) {
    seek(position);
  }

  function formatTime(ms: number) {
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  const categoryColor = currentTrack
    ? FrequencyColors[currentTrack.category.toLowerCase()] || Colors.dark.link
    : Colors.dark.link;

  function renderVisual() {
    if (!visualEnabled) return null;
    
    switch (visualType) {
      case "waves":
        return <WaveAnimation />;
      case "particles":
        return <ParticleAnimation />;
      case "water":
        return <WaterAnimation />;
      default:
        return null;
    }
  }

  if (!currentTrack) {
    return (
      <View style={styles.noTrack}>
        <ThemedText>No track selected</ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#0A0E1A", categoryColor + "40", "#0A0E1A"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      
      {renderVisual()}

      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <Pressable onPress={handleClose} style={styles.headerButton}>
          <Feather name="chevron-down" size={28} color={Colors.dark.text} />
        </Pressable>
        <Pressable onPress={() => setSettingsVisible(true)} style={styles.headerButton}>
          <Feather name="settings" size={24} color={Colors.dark.text} />
        </Pressable>
      </View>

      <View style={styles.content}>
        <View style={styles.trackInfo}>
          <View style={[styles.categoryBadge, { backgroundColor: categoryColor + "30" }]}>
            <View style={[styles.categoryDot, { backgroundColor: categoryColor }]} />
            <ThemedText style={[styles.categoryText, { color: categoryColor }]}>
              {currentTrack.category}
            </ThemedText>
          </View>
          <ThemedText type="h2" style={styles.trackTitle}>
            {currentTrack.title}
          </ThemedText>
          <ThemedText style={styles.frequency}>
            {currentTrack.frequency}
          </ThemedText>
        </View>
      </View>

      <View style={[styles.controls, { paddingBottom: insets.bottom + Spacing["2xl"] }]}>
        <View style={styles.progressContainer}>
          <Pressable
            style={styles.progressBar}
            onPress={(e) => {
              const x = e.nativeEvent.locationX;
              const ratio = x / (width - Spacing.lg * 2);
              handleSeek(ratio * duration);
            }}
          >
            <View style={styles.progressBackground}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: duration > 0 ? `${(progress / duration) * 100}%` : "0%",
                    backgroundColor: categoryColor,
                  },
                ]}
              />
            </View>
          </Pressable>
          <View style={styles.timeContainer}>
            <ThemedText style={styles.time}>{formatTime(progress)}</ThemedText>
            <ThemedText style={styles.time}>{formatTime(duration)}</ThemedText>
          </View>
        </View>

        <View style={styles.playControls}>
          <Pressable style={styles.secondaryControl}>
            <Feather name="skip-back" size={28} color={Colors.dark.text} />
          </Pressable>
          <Pressable
            style={[styles.playButton, { backgroundColor: categoryColor }]}
            onPress={handlePlayPause}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="large" color="#FFFFFF" />
            ) : (
              <Feather
                name={isPlaying ? "pause" : "play"}
                size={32}
                color="#FFFFFF"
                style={isPlaying ? {} : { marginLeft: 4 }}
              />
            )}
          </Pressable>
          <Pressable style={styles.secondaryControl}>
            <Feather name="skip-forward" size={28} color={Colors.dark.text} />
          </Pressable>
        </View>
        
        {isLoading ? (
          <View style={styles.loadingMessage}>
            <ThemedText style={styles.loadingText}>Loading audio...</ThemedText>
          </View>
        ) : null}
      </View>

      <Modal
        visible={settingsVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSettingsVisible(false)}
      >
        <View style={styles.settingsOverlay}>
          <View style={[styles.settingsContent, { paddingBottom: insets.bottom + Spacing.lg }]}>
            <View style={styles.settingsHeader}>
              <ThemedText type="h4">Visual Settings</ThemedText>
              <Pressable onPress={() => setSettingsVisible(false)}>
                <Feather name="x" size={24} color={Colors.dark.text} />
              </Pressable>
            </View>

            <View style={styles.settingRow}>
              <ThemedText>Enable Visuals</ThemedText>
              <Pressable
                style={[styles.toggle, visualEnabled && styles.toggleActive]}
                onPress={() => setVisualEnabled(!visualEnabled)}
              >
                <View style={[styles.toggleThumb, visualEnabled && styles.toggleThumbActive]} />
              </Pressable>
            </View>

            <ThemedText style={styles.settingLabel}>Visual Type</ThemedText>
            <View style={styles.visualOptions}>
              {(["waves", "particles", "water"] as const).map((type) => (
                <Pressable
                  key={type}
                  style={[
                    styles.visualOption,
                    visualType === type && styles.visualOptionActive,
                  ]}
                  onPress={() => setVisualType(type)}
                >
                  <Feather
                    name={type === "waves" ? "activity" : type === "particles" ? "star" : "droplet"}
                    size={24}
                    color={visualType === type ? Colors.dark.link : Colors.dark.textSecondary}
                  />
                  <ThemedText
                    style={[
                      styles.visualOptionText,
                      visualType === type && { color: Colors.dark.link },
                    ]}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.backgroundRoot,
  },
  noTrack: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.dark.backgroundRoot,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    zIndex: 10,
  },
  headerButton: {
    padding: Spacing.sm,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing["2xl"],
    zIndex: 10,
  },
  trackInfo: {
    alignItems: "center",
  },
  categoryBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.lg,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.sm,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: "600",
  },
  trackTitle: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  frequency: {
    color: Colors.dark.textSecondary,
    fontSize: 16,
  },
  controls: {
    paddingHorizontal: Spacing.lg,
  },
  progressContainer: {
    marginBottom: Spacing["2xl"],
  },
  progressBar: {
    height: 44,
    justifyContent: "center",
  },
  progressBackground: {
    height: 4,
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  timeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: Spacing.sm,
  },
  time: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
  },
  playControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing["3xl"],
  },
  secondaryControl: {
    padding: Spacing.md,
  },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  waveContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  wave: {
    position: "absolute",
    bottom: 0,
    left: -50,
    right: -50,
    height: 200,
    borderRadius: 1000,
  },
  wave1: {
    backgroundColor: "#4A90E2",
  },
  wave2: {
    backgroundColor: "#7B68EE",
    height: 180,
    bottom: 20,
  },
  wave3: {
    backgroundColor: "#4A90E2",
    height: 160,
    bottom: 40,
  },
  particleContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  particle: {
    position: "absolute",
    backgroundColor: "#7B68EE",
    borderRadius: 10,
  },
  waterContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  ripple: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: "#4A90E2",
  },
  settingsOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  settingsContent: {
    backgroundColor: Colors.dark.backgroundDefault,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing["2xl"],
  },
  settingsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing["2xl"],
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.dark.backgroundSecondary,
    justifyContent: "center",
    padding: 2,
  },
  toggleActive: {
    backgroundColor: Colors.dark.link,
  },
  toggleThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.dark.text,
  },
  toggleThumbActive: {
    alignSelf: "flex-end",
  },
  settingLabel: {
    color: Colors.dark.textSecondary,
    marginBottom: Spacing.md,
  },
  visualOptions: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  visualOption: {
    flex: 1,
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.dark.backgroundSecondary,
    gap: Spacing.sm,
  },
  visualOptionActive: {
    borderWidth: 2,
    borderColor: Colors.dark.link,
  },
  visualOptionText: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
  },
  loadingMessage: {
    alignItems: "center",
    marginTop: Spacing.lg,
  },
  loadingText: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
  },
});
