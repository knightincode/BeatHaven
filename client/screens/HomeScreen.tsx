import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { TrackCard } from "@/components/TrackCard";
import { AddToPlaylistModal } from "@/components/AddToPlaylistModal";
import { usePlayer, Track } from "@/contexts/PlayerContext";
import { useAuth } from "@/contexts/AuthContext";
import { useFavorites } from "@/hooks/useFavorites";
import { Colors, Spacing, FrequencyColors, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

const CATEGORIES = [
  { id: "delta", name: "Delta", description: "0.5-4.0 Hz - Deep Sleep", color: FrequencyColors.delta },
  { id: "theta", name: "Theta", description: "4.5-8.0 Hz - Meditation", color: FrequencyColors.theta },
  { id: "alpha", name: "Alpha", description: "8.5-12.0 Hz - Relaxation", color: FrequencyColors.alpha },
  { id: "beta", name: "Beta", description: "13.0-30.0 Hz - Focus", color: FrequencyColors.beta },
  { id: "gamma", name: "Gamma", description: "32.0-50.0 Hz - Cognition", color: FrequencyColors.gamma },
];

const MOOD_FILTERS = [
  { id: "all", label: "All", categories: ["delta", "theta", "alpha", "beta", "gamma"], icon: "grid" as const },
  { id: "sleep", label: "Deep Sleep", categories: ["delta"], icon: "moon" as const },
  { id: "relax", label: "Anxiety Relief", categories: ["theta", "alpha"], icon: "feather" as const },
  { id: "focus", label: "Focus", categories: ["beta"], icon: "target" as const },
  { id: "creativity", label: "Creativity", categories: ["alpha", "theta"], icon: "zap" as const },
  { id: "lucid", label: "Lucid Dreaming", categories: ["theta", "gamma"], icon: "eye" as const },
];

const CATEGORY_INFO: Record<string, { title: string; range: string; description: string; benefits: string[] }> = {
  delta: {
    title: "Delta Waves",
    range: "0.5 - 4.0 Hz",
    description: "The slowest brainwaves, dominant during deep dreamless sleep and transcendental meditation.",
    benefits: ["Deep restorative sleep", "Healing and regeneration", "Pain relief", "Anti-aging hormone release", "Immune system boost"],
  },
  theta: {
    title: "Theta Waves",
    range: "4.5 - 8.0 Hz",
    description: "Present during light sleep, deep meditation, and the threshold between waking and sleeping.",
    benefits: ["Deep meditation", "Creativity and intuition", "Emotional processing", "Memory consolidation", "Vivid visualization"],
  },
  alpha: {
    title: "Alpha Waves",
    range: "8.5 - 12.0 Hz",
    description: "The bridge between conscious thinking and the subconscious mind. Present during calm, relaxed alertness.",
    benefits: ["Stress reduction", "Calm alertness", "Mind-body integration", "Learning readiness", "Positive thinking"],
  },
  beta: {
    title: "Beta Waves",
    range: "13.0 - 30.0 Hz",
    description: "Associated with normal waking consciousness and active thinking. Essential for focused mental activity.",
    benefits: ["Enhanced concentration", "Problem solving", "Active thinking", "Cognitive performance", "Increased energy"],
  },
  gamma: {
    title: "Gamma Waves",
    range: "32.0 - 50.0 Hz",
    description: "The fastest brainwaves, associated with peak mental performance, higher consciousness, and insight.",
    benefits: ["Peak awareness", "Information processing", "Cognitive enhancement", "Expanded consciousness", "Memory recall"],
  },
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<NavigationProp>();
  const { playTrack, isTrackPlayed } = usePlayer();
  const { isAuthenticated, hasActiveSubscription, isDemo, showSubscriptionOffer, setShowSubscriptionOffer, logoutToSignup } = useAuth();
  const { isFavorite, toggleFavorite } = useFavorites();
  const [activeFilter, setActiveFilter] = useState("all");
  const [infoModalCategory, setInfoModalCategory] = useState<string | null>(null);
  const [playlistModalTrack, setPlaylistModalTrack] = useState<Track | null>(null);

  useEffect(() => {
    if (showSubscriptionOffer) {
      setShowSubscriptionOffer(false);
      navigation.navigate("Subscription");
    }
  }, [showSubscriptionOffer]);

  const { data: tracks, isLoading, refetch, isRefetching } = useQuery<Track[]>({
    queryKey: ["/api/tracks"],
  });

  const activeFilterObj = MOOD_FILTERS.find((f) => f.id === activeFilter);
  const allVisibleCategories = activeFilterObj ? activeFilterObj.categories : CATEGORIES.map((c) => c.id);
  const visibleCategories = allVisibleCategories;

  const availableMoodFilters = MOOD_FILTERS;

  function getTracksByCategory(category: string) {
    const categoryTracks = tracks?.filter((t) => t.category.toLowerCase() === category) || [];
    if (hasActiveSubscription) {
      return categoryTracks;
    }
    if (categoryTracks.length <= 2) {
      return categoryTracks;
    }
    return [categoryTracks[0], categoryTracks[categoryTracks.length - 1]];
  }

  function handlePlayTrack(track: Track, trackQueue?: Track[]) {
    if (!hasActiveSubscription && isTrackPlayed(track.id)) return;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    playTrack(track, trackQueue);
    navigation.navigate("Player");
  }

  function handleFilterPress(filterId: string) {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setActiveFilter(filterId);
  }

  if (isLoading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.dark.link} />
      </ThemedView>
    );
  }

  const infoData = infoModalCategory ? CATEGORY_INFO[infoModalCategory] : null;
  const infoCategoryObj = infoModalCategory ? CATEGORIES.find((c) => c.id === infoModalCategory) : null;

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

        {isDemo ? (
          <View style={styles.demoBanner} testID="banner-demo-mode">
            <Feather name="info" size={16} color="#F59E0B" />
            <ThemedText style={styles.demoBannerText}>
              You're in demo mode —{" "}
              <ThemedText
                style={styles.demoBannerLink}
                onPress={logoutToSignup}
                testID="button-demo-sign-up"
              >
                Sign up
              </ThemedText>
              {" "}for the full experience
            </ThemedText>
          </View>
        ) : null}

        {!hasActiveSubscription && !isDemo ? (
          <Pressable
            style={styles.upgradeBanner}
            onPress={() => navigation.navigate("Subscription")}
            testID="button-upgrade-banner"
          >
            <View style={styles.upgradeBannerContent}>
              <View style={styles.upgradeBannerLeft}>
                <Feather name="unlock" size={20} color="#F59E0B" />
                <View style={styles.upgradeBannerTextContainer}>
                  <ThemedText style={styles.upgradeBannerTitle}>
                    Unlock All Frequencies
                  </ThemedText>
                  <ThemedText style={styles.upgradeBannerSubtitle}>
                    Start your 7-day free trial to access all categories
                  </ThemedText>
                </View>
              </View>
              <Feather name="chevron-right" size={20} color={Colors.dark.textSecondary} />
            </View>
          </Pressable>
        ) : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContainer}
        >
          {availableMoodFilters.map((filter) => {
            const isActive = activeFilter === filter.id;
            return (
              <Pressable
                key={filter.id}
                style={[
                  styles.filterChip,
                  isActive ? styles.filterChipActive : {},
                ]}
                onPress={() => handleFilterPress(filter.id)}
                testID={`chip-${filter.id}`}
              >
                <Feather
                  name={filter.icon}
                  size={14}
                  color={isActive ? "#FFFFFF" : Colors.dark.textSecondary}
                />
                <ThemedText
                  style={[
                    styles.filterChipText,
                    isActive ? styles.filterChipTextActive : {},
                  ]}
                >
                  {filter.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>

        {CATEGORIES.filter((c) => visibleCategories.includes(c.id)).map((category) => {
          const categoryTracks = getTracksByCategory(category.id);
          return (
            <View key={category.id} style={styles.categorySection}>
              <View style={styles.categoryHeader}>
                <View style={[styles.categoryDot, { backgroundColor: category.color }]} />
                <View style={styles.categoryTitleRow}>
                  <View>
                    <ThemedText type="h4">{category.name}</ThemedText>
                    <ThemedText style={styles.categoryDescription}>
                      {category.description}
                    </ThemedText>
                  </View>
                  <Pressable
                    style={styles.infoButton}
                    onPress={() => setInfoModalCategory(category.id)}
                    testID={`info-${category.id}`}
                  >
                    <Feather name="info" size={18} color={Colors.dark.textSecondary} />
                  </Pressable>
                </View>
              </View>

              {categoryTracks.length > 0 ? (
                <FlatList
                  horizontal
                  data={categoryTracks}
                  keyExtractor={(item) => item.id}
                  showsHorizontalScrollIndicator={false}
                  style={styles.trackListOuter}
                  contentContainerStyle={styles.trackList}
                  renderItem={({ item }) => (
                    <TrackCard
                      track={item}
                      onPress={() => handlePlayTrack(item, categoryTracks)}
                      color={category.color}
                      isLocked={!hasActiveSubscription && isTrackPlayed(item.id)}
                      isFavorite={isAuthenticated ? isFavorite(item.id) : undefined}
                      onToggleFavorite={isAuthenticated ? () => toggleFavorite(item.id) : undefined}
                      onAddToPlaylist={isAuthenticated && hasActiveSubscription ? () => setPlaylistModalTrack(item) : undefined}
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

      <Modal
        visible={infoModalCategory !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setInfoModalCategory(null)}
      >
        <Pressable style={styles.infoModalOverlay} onPress={() => setInfoModalCategory(null)}>
          <Pressable onPress={(e) => e.stopPropagation()} style={styles.infoModalContent}>
            {infoData && infoCategoryObj ? (
              <>
                <View style={styles.infoModalHeader}>
                  <View style={[styles.infoModalDot, { backgroundColor: infoCategoryObj.color }]} />
                  <ThemedText type="h4" style={styles.infoModalTitle}>{infoData.title}</ThemedText>
                  <Pressable onPress={() => setInfoModalCategory(null)} testID="button-close-info">
                    <Feather name="x" size={24} color={Colors.dark.text} />
                  </Pressable>
                </View>
                <View style={[styles.infoRangeBadge, { backgroundColor: infoCategoryObj.color + "20" }]}>
                  <ThemedText style={[styles.infoRangeText, { color: infoCategoryObj.color }]}>
                    {infoData.range}
                  </ThemedText>
                </View>
                <ThemedText style={styles.infoDescription}>{infoData.description}</ThemedText>
                <ThemedText style={styles.infoBenefitsTitle}>Benefits</ThemedText>
                {infoData.benefits.map((benefit, index) => (
                  <View key={index} style={styles.infoBenefitRow}>
                    <Feather name="check-circle" size={16} color={infoCategoryObj.color} />
                    <ThemedText style={styles.infoBenefitText}>{benefit}</ThemedText>
                  </View>
                ))}
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      {playlistModalTrack ? (
        <AddToPlaylistModal
          visible={playlistModalTrack !== null}
          onClose={() => setPlaylistModalTrack(null)}
          trackId={playlistModalTrack.id}
          trackTitle={playlistModalTrack.title}
        />
      ) : null}
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
    textShadowColor: "rgba(74, 144, 226, 0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  welcomeSubtitle: {
    color: Colors.dark.textSecondary,
    marginBottom: Spacing.lg,
  },
  filterScroll: {
    marginBottom: Spacing["2xl"],
    marginHorizontal: -Spacing.lg,
  },
  filterContainer: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.dark.backgroundSecondary,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    gap: Spacing.xs,
  },
  filterChipActive: {
    backgroundColor: Colors.dark.link,
    borderColor: Colors.dark.link,
  },
  filterChipText: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    fontWeight: "500",
  },
  filterChipTextActive: {
    color: "#FFFFFF",
  },
  categorySection: {
    marginBottom: Spacing["2xl"],
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  categoryTitleRow: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
  },
  categoryDescription: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
  },
  infoButton: {
    padding: Spacing.xs,
  },
  trackListOuter: {
    marginHorizontal: -Spacing.lg,
  },
  trackList: {
    gap: Spacing.md,
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
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
  infoModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing["2xl"],
  },
  infoModalContent: {
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.xl,
    padding: Spacing["2xl"],
    width: "100%",
    maxWidth: 400,
  },
  infoModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  infoModalDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  infoModalTitle: {
    flex: 1,
  },
  infoRangeBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.lg,
  },
  infoRangeText: {
    fontSize: 14,
    fontWeight: "600",
  },
  infoDescription: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  infoBenefitsTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: Colors.dark.text,
    marginBottom: Spacing.md,
  },
  infoBenefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  infoBenefitText: {
    color: Colors.dark.text,
    fontSize: 14,
  },
  upgradeBanner: {
    backgroundColor: "rgba(245, 158, 11, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.4)",
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  upgradeBannerContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  upgradeBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    flex: 1,
  },
  upgradeBannerTextContainer: {
    flex: 1,
  },
  upgradeBannerTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#F59E0B",
    marginBottom: 2,
  },
  upgradeBannerSubtitle: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  demoBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: "rgba(245, 158, 11, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.4)",
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  demoBannerText: {
    flex: 1,
    fontSize: 13,
    color: Colors.dark.text,
  },
  demoBannerLink: {
    color: "#F59E0B",
    fontWeight: "600" as const,
  },
});
