import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Dimensions,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Keyboard,
  ScrollView,
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
import Svg, { Circle } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { usePlayer } from "@/contexts/PlayerContext";
import { useAuth } from "@/contexts/AuthContext";
import { useFavorites } from "@/hooks/useFavorites";
import { AmbientMixer } from "@/components/AmbientMixer";
import { AddToPlaylistModal } from "@/components/AddToPlaylistModal";
import { Colors, Spacing, BorderRadius, FrequencyColors } from "@/constants/theme";
import type { LoopMode, SleepTimerOption } from "@/contexts/PlayerContext";

const { width } = Dimensions.get("window");
const ORB_SIZE = 220;

const AnimatedSvg = Animated.createAnimatedComponent(Svg);

function ResonantOrb({ color }: { color: string }) {
  const breathe = useSharedValue(0);
  const pulse = useSharedValue(0);
  const rotation = useSharedValue(0);

  useEffect(() => {
    breathe.value = withRepeat(
      withSequence(
        withTiming(0.33, { duration: 4000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.33, { duration: 7000 }),
        withTiming(0, { duration: 8000, easing: Easing.inOut(Easing.sin) })
      ),
      -1
    );

    pulse.value = withRepeat(
      withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );

    rotation.value = withRepeat(
      withTiming(360, { duration: 60000, easing: Easing.linear }),
      -1
    );
  }, []);

  const outerGlowStyle = useAnimatedStyle(() => {
    const scale = 1 + interpolate(breathe.value, [0, 0.33], [0, 0.12]);
    const pulseScale = interpolate(pulse.value, [0, 1], [0.98, 1.02]);
    return {
      transform: [{ scale: scale * pulseScale }],
      opacity: interpolate(pulse.value, [0, 1], [0.3, 0.5]),
    };
  });

  const midGlowStyle = useAnimatedStyle(() => {
    const scale = 1 + interpolate(breathe.value, [0, 0.33], [0, 0.08]);
    const pulseScale = interpolate(pulse.value, [0, 1], [0.99, 1.01]);
    return {
      transform: [{ scale: scale * pulseScale }],
      opacity: interpolate(pulse.value, [0, 1], [0.4, 0.6]),
    };
  });

  const coreStyle = useAnimatedStyle(() => {
    const scale = 1 + interpolate(breathe.value, [0, 0.33], [0, 0.05]);
    return {
      transform: [{ scale }],
    };
  });

  const innerGlowStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(pulse.value, [0, 1], [0.6, 0.9]),
    };
  });

  const ringsStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${rotation.value}deg` }],
    };
  });

  const ringsStyle2 = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${-rotation.value * 0.7}deg` }],
    };
  });

  return (
    <View style={orbStyles.container}>
      <Animated.View
        style={[
          orbStyles.outerGlow,
          { backgroundColor: color + "15" },
          outerGlowStyle,
        ]}
      />

      <Animated.View
        style={[
          orbStyles.midGlow,
          { backgroundColor: color + "25" },
          midGlowStyle,
        ]}
      />

      <Animated.View
        style={[
          orbStyles.core,
          coreStyle,
        ]}
      >
        <LinearGradient
          colors={[color + "60", color + "30", color + "15"]}
          style={orbStyles.coreGradient}
          start={{ x: 0.3, y: 0 }}
          end={{ x: 0.7, y: 1 }}
        />

        <Animated.View style={[orbStyles.innerHighlight, innerGlowStyle]}>
          <LinearGradient
            colors={["rgba(255,255,255,0.25)", "rgba(255,255,255,0.05)", "transparent"]}
            style={orbStyles.highlightGradient}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 0.6 }}
          />
        </Animated.View>

        <AnimatedSvg
          width={ORB_SIZE}
          height={ORB_SIZE}
          viewBox={`0 0 ${ORB_SIZE} ${ORB_SIZE}`}
          style={[orbStyles.rings, ringsStyle]}
        >
          <Circle
            cx={ORB_SIZE / 2}
            cy={ORB_SIZE / 2}
            r={85}
            stroke={color}
            strokeWidth={0.8}
            fill="none"
            opacity={0.3}
          />
          <Circle
            cx={ORB_SIZE / 2}
            cy={ORB_SIZE / 2}
            r={65}
            stroke={color}
            strokeWidth={0.6}
            fill="none"
            opacity={0.2}
          />
          <Circle
            cx={ORB_SIZE / 2}
            cy={ORB_SIZE / 2}
            r={45}
            stroke={color}
            strokeWidth={0.5}
            fill="none"
            opacity={0.15}
          />
        </AnimatedSvg>

        <AnimatedSvg
          width={ORB_SIZE}
          height={ORB_SIZE}
          viewBox={`0 0 ${ORB_SIZE} ${ORB_SIZE}`}
          style={[orbStyles.rings, ringsStyle2]}
        >
          <Circle
            cx={ORB_SIZE / 2}
            cy={ORB_SIZE / 2}
            r={95}
            stroke={color}
            strokeWidth={0.5}
            fill="none"
            opacity={0.15}
            strokeDasharray="4 8"
          />
          <Circle
            cx={ORB_SIZE / 2}
            cy={ORB_SIZE / 2}
            r={75}
            stroke={color}
            strokeWidth={0.4}
            fill="none"
            opacity={0.12}
            strokeDasharray="3 6"
          />
          <Circle
            cx={ORB_SIZE / 2}
            cy={ORB_SIZE / 2}
            r={55}
            stroke={color}
            strokeWidth={0.4}
            fill="none"
            opacity={0.1}
            strokeDasharray="2 5"
          />
        </AnimatedSvg>

        <View
          style={[
            orbStyles.coreBorder,
            { borderColor: color + "40" },
          ]}
        />
      </Animated.View>
    </View>
  );
}

const orbStyles = StyleSheet.create({
  container: {
    width: ORB_SIZE + 60,
    height: ORB_SIZE + 60,
    alignItems: "center",
    justifyContent: "center",
  },
  outerGlow: {
    position: "absolute",
    width: ORB_SIZE + 60,
    height: ORB_SIZE + 60,
    borderRadius: (ORB_SIZE + 60) / 2,
  },
  midGlow: {
    position: "absolute",
    width: ORB_SIZE + 30,
    height: ORB_SIZE + 30,
    borderRadius: (ORB_SIZE + 30) / 2,
  },
  core: {
    width: ORB_SIZE,
    height: ORB_SIZE,
    borderRadius: ORB_SIZE / 2,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  coreGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: ORB_SIZE / 2,
  },
  innerHighlight: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: ORB_SIZE / 2,
    overflow: "hidden",
  },
  highlightGradient: {
    width: "100%",
    height: "60%",
  },
  rings: {
    position: "absolute",
  },
  coreBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: ORB_SIZE / 2,
    borderWidth: 1,
  },
});

const SLEEP_TIMER_OPTIONS: { label: string; value: SleepTimerOption }[] = [
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "45 min", value: 45 },
  { label: "60 min", value: 60 },
];

export default function PlayerScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const {
    currentTrack,
    isPlaying,
    isLoading,
    progress,
    duration,
    loopMode,
    sleepTimer,
    sleepTimerRemaining,
    isFadingOut,
    pause,
    resume,
    stop,
    seek,
    setLoopMode,
    setSleepTimer,
    hidePlayer,
  } = usePlayer();

  const { isAuthenticated } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [timerModalVisible, setTimerModalVisible] = useState(false);
  const [mixerVisible, setMixerVisible] = useState(false);
  const [playlistModalVisible, setPlaylistModalVisible] = useState(false);
  const [showCustomTimer, setShowCustomTimer] = useState(false);
  const [customMinutes, setCustomMinutes] = useState("");

  const trackIsFavorite = currentTrack ? isFavorite(currentTrack.id) : false;

  function handleToggleFavorite() {
    if (!currentTrack || !isAuthenticated) return;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    toggleFavorite(currentTrack.id);
  }

  function handleClose() {
    hidePlayer();
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

  function formatTimerRemaining(ms: number) {
    const totalSecs = Math.ceil(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  function cycleLoopMode() {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    const modes: LoopMode[] = ["none", "one", "all"];
    const currentIndex = modes.indexOf(loopMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setLoopMode(modes[nextIndex]);
  }

  function handleTimerSelect(value: SleepTimerOption) {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setSleepTimer(value);
    setTimerModalVisible(false);
    setShowCustomTimer(false);
    setCustomMinutes("");
  }

  function handleCustomTimerSubmit() {
    const mins = parseInt(customMinutes, 10);
    if (mins > 0 && mins <= 480) {
      handleTimerSelect(mins);
    }
  }

  const categoryColor = currentTrack
    ? FrequencyColors[currentTrack.category.toLowerCase()] || Colors.dark.link
    : Colors.dark.link;

  const loopIconColor =
    loopMode === "none" ? "rgba(255,255,255,0.4)" : categoryColor;

  const timerIconColor =
    sleepTimer !== null ? categoryColor : "rgba(255,255,255,0.6)";

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
        colors={["#0A0E1A", categoryColor + "30", "#0A0E1A", categoryColor + "15", "#0A0E1A"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        locations={[0, 0.3, 0.5, 0.7, 1]}
      />

      <View style={[styles.topBar, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable onPress={handleClose} style={styles.topBarButton} testID="button-close">
          <Feather name="chevron-down" size={28} color={Colors.dark.text} />
        </Pressable>
        <View style={styles.topBarTitle}>
          <ThemedText style={styles.topBarTitleText} numberOfLines={1}>
            {currentTrack.title}
          </ThemedText>
        </View>
        <Pressable style={styles.topBarButton} testID="button-settings">
          <Feather name="more-vertical" size={24} color={Colors.dark.text} />
        </Pressable>
      </View>

      <View style={styles.orbSection}>
        <ResonantOrb color={categoryColor} />
      </View>

      <View style={styles.midSection}>
        <ThemedText style={styles.categorySubtitle}>
          {currentTrack.category} - {currentTrack.frequency}
        </ThemedText>

        <View style={styles.actionRow}>
          <Pressable style={styles.actionButton} testID="button-heart" onPress={handleToggleFavorite}>
            <Feather name="heart" size={22} color={trackIsFavorite ? "#FF6B8A" : "rgba(255,255,255,0.6)"} />
          </Pressable>
          <Pressable style={styles.actionButton} testID="button-add-playlist" onPress={() => {
            if (Platform.OS !== "web") {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
            setPlaylistModalVisible(true);
          }}>
            <Feather name="plus" size={22} color="rgba(255,255,255,0.6)" />
          </Pressable>
          <Pressable style={styles.actionButton} testID="button-mixer" onPress={() => setMixerVisible(true)}>
            <Feather name="sliders" size={22} color="rgba(255,255,255,0.6)" />
          </Pressable>
          <Pressable style={styles.actionButton} testID="button-timer" onPress={() => setTimerModalVisible(true)}>
            <Feather name="clock" size={22} color={timerIconColor} />
            {sleepTimer !== null ? (
              <View style={[styles.timerDot, { backgroundColor: categoryColor }]} />
            ) : null}
          </Pressable>
        </View>

        {sleepTimer !== null ? (
          <View style={styles.timerIndicator}>
            <Feather name="moon" size={14} color={categoryColor} />
            <ThemedText style={[styles.timerText, { color: categoryColor }]}>
              {isFadingOut ? "Fading out..." : formatTimerRemaining(sleepTimerRemaining)}
            </ThemedText>
          </View>
        ) : null}
      </View>

      <View
        style={[
          styles.controlPanel,
          { paddingBottom: insets.bottom + Spacing.lg },
        ]}
      >
        <View style={styles.progressContainer}>
          <Pressable
            style={styles.progressBar}
            onPress={(e) => {
              const x = e.nativeEvent.locationX;
              const barWidth = width - Spacing["2xl"] * 2 - Spacing.lg * 2;
              const ratio = Math.max(0, Math.min(1, x / barWidth));
              handleSeek(ratio * duration);
            }}
            testID="button-seek"
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
              {duration > 0 ? (
                <View
                  style={[
                    styles.progressThumb,
                    {
                      left: `${(progress / duration) * 100}%`,
                      backgroundColor: categoryColor,
                    },
                  ]}
                />
              ) : null}
            </View>
          </Pressable>
          <View style={styles.timeContainer}>
            <ThemedText style={styles.timeText}>{formatTime(progress)}</ThemedText>
            <ThemedText style={styles.timeText}>{formatTime(duration)}</ThemedText>
          </View>
        </View>

        <View style={styles.controlsRow}>
          <Pressable onPress={cycleLoopMode} style={styles.sideControl} testID="button-loop">
            <Feather
              name="repeat"
              size={20}
              color={loopIconColor}
            />
            {loopMode === "one" ? (
              <View style={[styles.loopBadge, { backgroundColor: categoryColor }]}>
                <ThemedText style={styles.loopBadgeText}>1</ThemedText>
              </View>
            ) : null}
          </Pressable>

          <Pressable style={styles.transportControl} testID="button-skip-back">
            <Feather name="skip-back" size={26} color={Colors.dark.text} />
          </Pressable>

          <Pressable
            style={[styles.playButton, { backgroundColor: categoryColor }]}
            onPress={handlePlayPause}
            disabled={isLoading}
            testID="button-play-pause"
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

          <Pressable style={styles.transportControl} testID="button-skip-forward">
            <Feather name="skip-forward" size={26} color={Colors.dark.text} />
          </Pressable>

          <Pressable style={styles.sideControl} testID="button-shuffle">
            <Feather name="shuffle" size={20} color="rgba(255,255,255,0.4)" />
          </Pressable>
        </View>

        {isLoading ? (
          <View style={styles.loadingMessage}>
            <ThemedText style={styles.loadingText}>Loading audio...</ThemedText>
          </View>
        ) : null}
      </View>

      <Modal
        visible={timerModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          Keyboard.dismiss();
          setTimerModalVisible(false);
        }}
      >
        <KeyboardAvoidingView
          style={styles.keyboardAvoidingContainer}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => {
              Keyboard.dismiss();
              setTimerModalVisible(false);
            }}
          >
            <Pressable
              onPress={() => Keyboard.dismiss()}
              style={[styles.modalContent, { paddingBottom: insets.bottom + Spacing.lg }]}
            >
              <View style={styles.modalHeader}>
                <ThemedText type="h4">Sleep Timer</ThemedText>
                <Pressable
                  onPress={() => {
                    Keyboard.dismiss();
                    setTimerModalVisible(false);
                  }}
                  testID="button-close-timer"
                >
                  <Feather name="x" size={24} color={Colors.dark.text} />
                </Pressable>
              </View>
              <ThemedText style={styles.modalDescription}>
                Audio will gently fade out over 30 seconds before pausing
              </ThemedText>
              <ScrollView
                bounces={false}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {SLEEP_TIMER_OPTIONS.map((option) => (
                  <Pressable
                    key={option.value}
                    style={[
                      styles.timerOption,
                      sleepTimer === option.value ? { backgroundColor: categoryColor + "20", borderColor: categoryColor } : {},
                    ]}
                    onPress={() => handleTimerSelect(option.value)}
                    testID={`button-timer-${option.value}`}
                  >
                    <Feather
                      name="clock"
                      size={20}
                      color={sleepTimer === option.value ? categoryColor : Colors.dark.textSecondary}
                    />
                    <ThemedText
                      style={[
                        styles.timerOptionText,
                        sleepTimer === option.value ? { color: categoryColor, fontWeight: "600" } : {},
                      ]}
                    >
                      {option.label}
                    </ThemedText>
                    {sleepTimer === option.value ? (
                      <Feather name="check" size={20} color={categoryColor} />
                    ) : null}
                  </Pressable>
                ))}

                {showCustomTimer ? (
                  <View style={styles.customTimerContainer}>
                    <View style={styles.customTimerInputRow}>
                      <TextInput
                        style={styles.customTimerInput}
                        placeholder="Minutes"
                        placeholderTextColor={Colors.dark.textSecondary}
                        value={customMinutes}
                        onChangeText={(text) => setCustomMinutes(text.replace(/[^0-9]/g, ""))}
                        keyboardType="number-pad"
                        autoFocus
                        maxLength={3}
                        returnKeyType="done"
                        onSubmitEditing={handleCustomTimerSubmit}
                        testID="input-custom-timer"
                      />
                      <ThemedText style={styles.customTimerUnit}>min</ThemedText>
                    </View>
                    <View style={styles.customTimerActions}>
                      <Pressable
                        style={[
                          styles.customTimerSetButton,
                          { backgroundColor: categoryColor },
                          parseInt(customMinutes, 10) > 0 ? {} : { opacity: 0.4 },
                        ]}
                        onPress={handleCustomTimerSubmit}
                        disabled={!(parseInt(customMinutes, 10) > 0)}
                        testID="button-set-custom-timer"
                      >
                        <ThemedText style={styles.customTimerSetText}>Set Timer</ThemedText>
                      </Pressable>
                      <Pressable
                        style={styles.customTimerCancelButton}
                        onPress={() => {
                          Keyboard.dismiss();
                          setShowCustomTimer(false);
                          setCustomMinutes("");
                        }}
                        testID="button-cancel-custom-timer"
                      >
                        <ThemedText style={styles.customTimerCancelText}>Cancel</ThemedText>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <Pressable
                    style={[
                      styles.timerOption,
                      sleepTimer !== null && !SLEEP_TIMER_OPTIONS.some(o => o.value === sleepTimer)
                        ? { backgroundColor: categoryColor + "20", borderColor: categoryColor }
                        : {},
                    ]}
                    onPress={() => setShowCustomTimer(true)}
                    testID="button-custom-timer"
                  >
                    <Feather
                      name="plus"
                      size={20}
                      color={sleepTimer !== null && !SLEEP_TIMER_OPTIONS.some(o => o.value === sleepTimer) ? categoryColor : Colors.dark.textSecondary}
                    />
                    <ThemedText
                      style={[
                        styles.timerOptionText,
                        sleepTimer !== null && !SLEEP_TIMER_OPTIONS.some(o => o.value === sleepTimer)
                          ? { color: categoryColor, fontWeight: "600" }
                          : {},
                      ]}
                    >
                      {sleepTimer !== null && !SLEEP_TIMER_OPTIONS.some(o => o.value === sleepTimer)
                        ? `Custom (${sleepTimer} min)`
                        : "+ Custom"}
                    </ThemedText>
                    {sleepTimer !== null && !SLEEP_TIMER_OPTIONS.some(o => o.value === sleepTimer) ? (
                      <Feather name="check" size={20} color={categoryColor} />
                    ) : null}
                  </Pressable>
                )}

                {sleepTimer !== null ? (
                  <Pressable
                    style={styles.timerCancelButton}
                    onPress={() => handleTimerSelect(null)}
                    testID="button-cancel-timer"
                  >
                    <ThemedText style={styles.timerCancelText}>Cancel Timer</ThemedText>
                  </Pressable>
                ) : null}
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <AmbientMixer
        visible={mixerVisible}
        onClose={() => setMixerVisible(false)}
        accentColor={categoryColor}
      />

      {currentTrack ? (
        <AddToPlaylistModal
          visible={playlistModalVisible}
          onClose={() => setPlaylistModalVisible(false)}
          trackId={currentTrack.id}
          trackTitle={currentTrack.title}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0E1A",
  },
  noTrack: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.dark.backgroundRoot,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    zIndex: 10,
  },
  topBarButton: {
    padding: Spacing.sm,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  topBarTitle: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
  },
  topBarTitleText: {
    fontSize: 16,
    fontWeight: "600",
    color: Colors.dark.text,
    textAlign: "center",
  },
  orbSection: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  midSection: {
    alignItems: "center",
    paddingHorizontal: Spacing["2xl"],
    paddingBottom: Spacing["2xl"],
  },
  categorySubtitle: {
    fontSize: 15,
    color: "rgba(255,255,255,0.6)",
    marginBottom: Spacing.xl,
    letterSpacing: 0.5,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing["4xl"],
  },
  actionButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  controlPanel: {
    backgroundColor: "rgba(26, 31, 46, 0.85)",
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: Spacing["2xl"],
    paddingTop: Spacing["2xl"],
  },
  progressContainer: {
    marginBottom: Spacing.xl,
  },
  progressBar: {
    height: 44,
    justifyContent: "center",
  },
  progressBackground: {
    height: 4,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 2,
    overflow: "visible",
    position: "relative",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  progressThumb: {
    position: "absolute",
    top: -4,
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: -6,
  },
  timeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: Spacing.xs,
  },
  timeText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xl,
  },
  sideControl: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  transportControl: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  loopBadge: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  loopBadgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontWeight: "700",
  },
  loadingMessage: {
    alignItems: "center",
    marginTop: Spacing.md,
  },
  loadingText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 13,
  },
  timerDot: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  timerIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
  timerText: {
    fontSize: 13,
    fontWeight: "500",
  },
  keyboardAvoidingContainer: {
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: Colors.dark.backgroundDefault,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing["2xl"],
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  modalDescription: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    marginBottom: Spacing.xl,
  },
  timerOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.dark.backgroundSecondary,
    borderWidth: 1,
    borderColor: "transparent",
    gap: Spacing.md,
  },
  timerOptionText: {
    flex: 1,
    fontSize: 16,
    color: Colors.dark.text,
  },
  timerCancelButton: {
    alignItems: "center",
    padding: Spacing.lg,
    marginTop: Spacing.sm,
  },
  timerCancelText: {
    color: Colors.dark.error,
    fontSize: 15,
    fontWeight: "500",
  },
  customTimerContainer: {
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  customTimerInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  customTimerInput: {
    flex: 1,
    height: 48,
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.lg,
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: "600",
    borderWidth: 1,
    borderColor: Colors.dark.border,
    textAlign: "center",
  },
  customTimerUnit: {
    color: Colors.dark.textSecondary,
    fontSize: 16,
    fontWeight: "500",
  },
  customTimerActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  customTimerSetButton: {
    flex: 1,
    height: 44,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  customTimerSetText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  customTimerCancelButton: {
    height: 44,
    paddingHorizontal: Spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  customTimerCancelText: {
    color: Colors.dark.textSecondary,
    fontSize: 15,
  },
});
