import React from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

import { LinearGradient } from "expo-linear-gradient";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { usePlayer, Track } from "@/contexts/PlayerContext";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/query-client";
import { Colors, Spacing, BorderRadius, FrequencyColors } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type RouteProps = RouteProp<RootStackParamList, "PlaylistDetail">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface PlaylistTrack extends Track {
  position: number;
}

const FAVORITES_ID = "__favorites__";

export default function PlaylistDetailScreen() {
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { playTrack } = usePlayer();
  const { hasActiveSubscription } = useAuth();
  const queryClient = useQueryClient();
  const { playlistId, playlistName } = route.params;

  const isFavorites = playlistId === FAVORITES_ID;

  const { data: tracks, isLoading, refetch, isRefetching } = useQuery<PlaylistTrack[]>({
    queryKey: isFavorites ? ["/api/favorites"] : ["/api/playlists", playlistId, "tracks"],
    select: isFavorites
      ? (data: any) => data.map((t: any, i: number) => ({ ...t, position: i }))
      : undefined,
  });

  const removeTrackMutation = useMutation({
    mutationFn: async (trackId: string) => {
      if (isFavorites) {
        await apiRequest("DELETE", `/api/favorites/${trackId}`);
      } else {
        await apiRequest("DELETE", `/api/playlists/${playlistId}/tracks/${trackId}`);
      }
    },
    onSuccess: () => {
      if (isFavorites) {
        queryClient.invalidateQueries({ queryKey: ["/api/favorites"] });
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/playlists", playlistId, "tracks"] });
        queryClient.invalidateQueries({ queryKey: ["/api/playlists"] });
      }
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    },
  });

  function handlePlayTrack(track: Track) {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    playTrack(track, tracks || [track]);
    navigation.navigate("Player");
  }

  function handleRemoveTrack(trackId: string) {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    removeTrackMutation.mutate(trackId);
  }

  function formatDuration(seconds: number) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  function renderTrack({ item }: { item: PlaylistTrack }) {
    const color = FrequencyColors[item.category.toLowerCase()] || Colors.dark.link;
    return (
      <Card style={styles.trackCard} onPress={() => handlePlayTrack(item)}>
        <View style={[styles.categoryDot, { backgroundColor: color }]} />
        <View style={styles.trackInfo}>
          <ThemedText style={styles.trackTitle}>{item.title}</ThemedText>
          <ThemedText style={styles.trackMeta}>
            {item.category} - {formatDuration(item.duration)}
          </ThemedText>
        </View>
        <Pressable
          style={styles.removeButton}
          onPress={() => handleRemoveTrack(item.id)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          testID={`button-remove-track-${item.id}`}
        >
          <Feather
            name={isFavorites ? "heart" : "x"}
            size={20}
            color={isFavorites ? "#FF6B8A" : Colors.dark.textSecondary}
          />
        </Pressable>
      </Card>
    );
  }

  function renderEmpty() {
    return (
      <View style={styles.emptyContainer}>
        <Image
          source={require("../../assets/images/empty-playlist-detail.png")}
          style={styles.emptyImage}
          resizeMode="contain"
        />
        <ThemedText type="h4" style={styles.emptyTitle}>
          {isFavorites ? "No Favorites Yet" : "No Tracks Added"}
        </ThemedText>
        <ThemedText style={styles.emptyText}>
          {isFavorites
            ? "Tap the heart icon on any track to add it here"
            : "Browse the Discover tab and add your favorite tracks"}
        </ThemedText>
      </View>
    );
  }

  if (!isFavorites && !hasActiveSubscription) {
    return (
      <ThemedView style={styles.container}>
        <View
          style={[
            styles.gateContainer,
            { paddingTop: headerHeight + Spacing["3xl"], paddingBottom: insets.bottom + Spacing.xl },
          ]}
        >
          <View style={styles.gateIconWrap}>
            <Feather name="lock" size={32} color={Colors.dark.link} />
          </View>
          <ThemedText style={styles.gateTitle}>Resubscribe to Access Playlists</ThemedText>
          <ThemedText style={styles.gateSubtext}>
            Your playlists are still saved. Subscribe to access them again.
          </ThemedText>
          <Pressable
            style={styles.gateUpgradeBtn}
            onPress={() => navigation.navigate("Subscription")}
            testID="button-resubscribe-playlist-detail"
          >
            <LinearGradient
              colors={[Colors.dark.link, "#5BA3E2"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gateUpgradeGradient}
            >
              <Feather name="zap" size={18} color="#FFFFFF" style={{ marginRight: Spacing.sm }} />
              <ThemedText style={styles.gateUpgradeText}>Resubscribe</ThemedText>
            </LinearGradient>
          </Pressable>
        </View>
      </ThemedView>
    );
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
      <FlatList
        data={tracks}
        keyExtractor={(item) => `${item.id}-${item.position}`}
        renderItem={renderTrack}
        contentContainerStyle={[
          styles.content,
          { paddingTop: headerHeight + Spacing.xl, paddingBottom: insets.bottom + Spacing.xl },
          (tracks?.length || 0) === 0 && styles.emptyContentContainer,
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={Colors.dark.link}
          />
        }
        ListEmptyComponent={renderEmpty}
      />
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
  content: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  emptyContentContainer: {
    flex: 1,
    justifyContent: "center",
  },
  trackCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.md,
  },
  trackInfo: {
    flex: 1,
  },
  trackTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  trackMeta: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
  },
  removeButton: {
    padding: Spacing.sm,
  },
  emptyContainer: {
    alignItems: "center",
    paddingHorizontal: Spacing["2xl"],
  },
  emptyImage: {
    width: 150,
    height: 150,
    marginBottom: Spacing["2xl"],
  },
  emptyTitle: {
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  emptyText: {
    color: Colors.dark.textSecondary,
    textAlign: "center",
  },

  gateContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing["2xl"],
  },
  gateIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.dark.link + "15",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  gateTitle: {
    color: Colors.dark.text,
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  gateSubtext: {
    color: Colors.dark.textSecondary,
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: Spacing["2xl"],
    paddingHorizontal: Spacing.lg,
  },
  gateUpgradeBtn: {
    borderRadius: BorderRadius.full,
    overflow: "hidden",
  },
  gateUpgradeGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing["3xl"],
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.full,
  },
  gateUpgradeText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
