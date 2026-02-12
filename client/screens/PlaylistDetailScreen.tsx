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

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { usePlayer, Track } from "@/contexts/PlayerContext";
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
    playTrack(track);
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
});
