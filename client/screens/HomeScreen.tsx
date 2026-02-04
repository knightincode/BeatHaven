import React from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { TrackCard } from "@/components/TrackCard";
import { usePlayer, Track } from "@/contexts/PlayerContext";
import { Colors, Spacing, FrequencyColors, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

const CATEGORIES = [
  { id: "delta", name: "Delta", description: "0.5-4.0 Hz - Deep Sleep", color: FrequencyColors.delta },
  { id: "theta", name: "Theta", description: "4.5-8.0 Hz - Meditation", color: FrequencyColors.theta },
  { id: "alpha", name: "Alpha", description: "8.5-12.0 Hz - Relaxation", color: FrequencyColors.alpha },
  { id: "beta", name: "Beta", description: "13.0-30.0 Hz - Focus", color: FrequencyColors.beta },
  { id: "gamma", name: "Gamma", description: "32.0-50.0 Hz - Cognition", color: FrequencyColors.gamma },
];

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<NavigationProp>();
  const { playTrack } = usePlayer();

  const { data: tracks, isLoading, refetch, isRefetching } = useQuery<Track[]>({
    queryKey: ["/api/tracks"],
  });

  function getTracksByCategory(category: string) {
    return tracks?.filter((t) => t.category.toLowerCase() === category) || [];
  }

  function handlePlayTrack(track: Track) {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    playTrack(track);
    navigation.navigate("Player");
  }

  if (isLoading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.dark.link} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingTop: headerHeight + Spacing.xl, paddingBottom: tabBarHeight + Spacing.xl },
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={Colors.dark.link}
          />
        }
      >
        <ThemedText type="h3" style={styles.welcomeTitle}>
          Find Your Frequency
        </ThemedText>
        <ThemedText style={styles.welcomeSubtitle}>
          Explore binaural beats designed to enhance your mental state
        </ThemedText>

        {CATEGORIES.map((category) => {
          const categoryTracks = getTracksByCategory(category.id);
          return (
            <View key={category.id} style={styles.categorySection}>
              <View style={styles.categoryHeader}>
                <View style={[styles.categoryDot, { backgroundColor: category.color }]} />
                <View>
                  <ThemedText type="h4">{category.name}</ThemedText>
                  <ThemedText style={styles.categoryDescription}>
                    {category.description}
                  </ThemedText>
                </View>
              </View>

              {categoryTracks.length > 0 ? (
                <FlatList
                  horizontal
                  data={categoryTracks}
                  keyExtractor={(item) => item.id}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.trackList}
                  renderItem={({ item }) => (
                    <TrackCard
                      track={item}
                      onPress={() => handlePlayTrack(item)}
                      color={category.color}
                    />
                  )}
                />
              ) : (
                <View style={styles.emptyCategory}>
                  <Feather name="music" size={24} color={Colors.dark.textSecondary} />
                  <ThemedText style={styles.emptyCategoryText}>
                    No tracks available yet
                  </ThemedText>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  welcomeTitle: {
    marginBottom: Spacing.xs,
  },
  welcomeSubtitle: {
    color: Colors.dark.textSecondary,
    marginBottom: Spacing["2xl"],
  },
  categorySection: {
    marginBottom: Spacing["2xl"],
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  categoryDescription: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
  },
  trackList: {
    gap: Spacing.md,
  },
  emptyCategory: {
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.md,
    padding: Spacing["2xl"],
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  emptyCategoryText: {
    color: Colors.dark.textSecondary,
  },
});
