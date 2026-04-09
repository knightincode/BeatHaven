import React, { useEffect, useState, useCallback } from "react";
import { View, StyleSheet, Pressable, Platform, Dimensions } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  withDelay,
  interpolateColor,
  interpolate,
  Easing,
  runOnJS,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { usePlayer } from "@/contexts/PlayerContext";
import { useAuth } from "@/contexts/AuthContext";
import { useFavorites } from "@/hooks/useFavorites";
import { AddToPlaylistModal } from "@/components/AddToPlaylistModal";
import { Colors, Spacing, BorderRadius, FrequencyColors } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

const MINI_PLAYER_HEIGHT = 64;
const SCREEN_WIDTH = Dimensions.get("window").width;
const DISMISS_THRESHOLD = -SCREEN_WIDTH * 0.4;

const MINI_BAR_DELAYS = [0, 70, 140, 210];
const MINI_BAR_DURATION = 400;

function MiniWaveformBar({ delay }: { delay: number }) {
  const scaleY = useSharedValue(0.2);

  useEffect(() => {
    scaleY.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: MINI_BAR_DURATION, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.2, { duration: MINI_BAR_DURATION, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      ),
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: scaleY.value }],
  }));

  return (
    <Animated.View
      style={[
        { width: 3, height: 14, borderRadius: 2, backgroundColor: "#FFFFFF", marginHorizontal: 1.5 },
        animatedStyle,
      ]}
    />
  );
}

function MiniWaveformLoading() {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
      {MINI_BAR_DELAYS.map((delay, i) => (
        <MiniWaveformBar key={i} delay={delay} />
      ))}
    </View>
  );
}

export function MiniPlayer() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const {
    currentTrack,
    isPlaying,
    isLoading,
    progress,
    duration,
    hasActiveSubscription,
    previewEnded,
    pause,
    resume,
    isPlayerVisible,
    showPlayer,
    stop,
  } = usePlayer();

  const { isAuthenticated } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [playlistModalVisible, setPlaylistModalVisible] = useState(false);

  const borderAnimation = useSharedValue(0);
  const translateX = useSharedValue(0);
  const dismissOpacity = useSharedValue(1);

  useEffect(() => {
    if (isLoading) {
      borderAnimation.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 1000, easing: Easing.inOut(Easing.ease) })
        ),
        -1
      );
    } else {
      borderAnimation.value = withTiming(0, { duration: 300 });
    }
  }, [isLoading]);

  useEffect(() => {
    if (currentTrack) {
      translateX.value = 0;
      dismissOpacity.value = 1;
    }
  }, [currentTrack?.id]);

  const handleDismiss = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    dismissOpacity.value = withTiming(0, { duration: 200 }, () => {
      runOnJS(stop)();
    });
  }, [stop]);

  const panGesture = Gesture.Pan()
    .activeOffsetX(-10)
    .failOffsetY([-15, 15])
    .onUpdate((event) => {
      const clampedX = Math.min(0, event.translationX);
      translateX.value = clampedX;
    })
    .onEnd((event) => {
      if (translateX.value < DISMISS_THRESHOLD) {
        translateX.value = withTiming(-SCREEN_WIDTH, { duration: 200 });
        runOnJS(handleDismiss)();
      } else {
        translateX.value = withSpring(0, { damping: 15, stiffness: 150 });
      }
    });

  const animatedBorderStyle = useAnimatedStyle(() => {
    const borderColor = interpolateColor(
      borderAnimation.value,
      [0, 0.25, 0.5, 0.75, 1],
      ["#6366F1", "#8B5CF6", "#4A90E2", "#10B981", "#F59E0B"]
    );
    return {
      borderColor,
      borderWidth: isLoading ? 2 : 0,
    };
  });

  const animatedSlideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: dismissOpacity.value,
  }));

  const animatedRedBgStyle = useAnimatedStyle(() => {
    const revealOpacity = interpolate(
      translateX.value,
      [0, DISMISS_THRESHOLD * 0.3, DISMISS_THRESHOLD],
      [0, 0.6, 1],
      "clamp"
    );
    return {
      opacity: revealOpacity,
    };
  });

  if (!currentTrack || isPlayerVisible) {
    return null;
  }

  const FREE_PREVIEW_MS = 5 * 60 * 1000;
  const categoryColor = FrequencyColors[currentTrack.category.toLowerCase()] || Colors.dark.link;
  const progressPercent = hasActiveSubscription
    ? (duration > 0 ? ((progress % duration) / duration) * 100 : 0)
    : Math.min(100, (progress / FREE_PREVIEW_MS) * 100);
  const trackIsFavorite = isAuthenticated ? isFavorite(currentTrack.id) : false;

  function handlePress() {
    showPlayer();
    navigation.navigate("Player");
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

  function handleToggleFavorite() {
    if (!isAuthenticated || !currentTrack) return;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    toggleFavorite(currentTrack.id);
  }

  function handleOpenPlaylistModal() {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setPlaylistModalVisible(true);
  }

  return (
    <View
      style={[
        styles.outerWrapper,
        { marginBottom: 49 + insets.bottom },
      ]}
    >
      <Animated.View style={[styles.dismissBackground, animatedRedBgStyle]}>
        <View style={styles.dismissIconContainer}>
          <Feather name="x" size={22} color="#FFFFFF" />
        </View>
      </Animated.View>

      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            styles.container,
            animatedBorderStyle,
            animatedSlideStyle,
          ]}
        >
          <LinearGradient
            colors={[categoryColor + "E6", categoryColor + "CC"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${progressPercent}%` },
              ]}
            />
          </View>

          <View style={styles.content}>
            <Pressable style={styles.trackPressable} onPress={handlePress} testID="button-mini-player-navigate">
              <View style={styles.iconContainer}>
                <Feather name="headphones" size={20} color="#FFFFFF" />
              </View>
              
              <View style={styles.trackInfo}>
                <ThemedText style={styles.title} numberOfLines={1}>
                  {currentTrack.title}
                </ThemedText>
                <ThemedText style={styles.category} numberOfLines={1}>
                  {currentTrack.category} • {currentTrack.frequency}
                </ThemedText>
              </View>
            </Pressable>

            {isAuthenticated ? (
              <Pressable
                style={styles.miniButton}
                onPress={handleToggleFavorite}
                hitSlop={8}
                testID="button-mini-heart"
              >
                <Feather
                  name="heart"
                  size={18}
                  color={trackIsFavorite ? "#FF6B8A" : "rgba(255,255,255,0.7)"}
                />
              </Pressable>
            ) : null}

            {isAuthenticated ? (
              <Pressable
                style={styles.miniButton}
                onPress={handleOpenPlaylistModal}
                hitSlop={8}
                testID="button-mini-add-playlist"
              >
                <Feather name="plus" size={18} color="rgba(255,255,255,0.7)" />
              </Pressable>
            ) : null}

            <Pressable
              style={styles.playButton}
              onPress={handlePlayPause}
              hitSlop={12}
              testID="button-mini-play-pause"
            >
              {isLoading ? (
                <MiniWaveformLoading />
              ) : (
                <Feather
                  name={isPlaying ? "pause" : "play"}
                  size={22}
                  color="#FFFFFF"
                  style={isPlaying ? {} : { marginLeft: 2 }}
                />
              )}
            </Pressable>
          </View>

          <AddToPlaylistModal
            visible={playlistModalVisible}
            onClose={() => setPlaylistModalVisible(false)}
            trackId={currentTrack.id}
            trackTitle={currentTrack.title}
          />
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  outerWrapper: {
    position: "absolute",
    left: Spacing.md,
    right: Spacing.md,
    bottom: 0,
    height: MINI_PLAYER_HEIGHT,
  },
  dismissBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.dark.error,
    borderRadius: BorderRadius.lg,
    alignItems: "flex-end",
    justifyContent: "center",
    paddingRight: Spacing.xl,
  },
  dismissIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    width: "100%",
    height: MINI_PLAYER_HEIGHT,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  progressBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.8)",
  },
  content: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingTop: 3,
  },
  trackPressable: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  trackInfo: {
    flex: 1,
    justifyContent: "center",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  category: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 12,
    marginTop: 2,
  },
  miniButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: Spacing.sm,
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
  },
});
