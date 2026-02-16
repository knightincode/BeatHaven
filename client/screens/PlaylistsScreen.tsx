import React, { useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { HeaderButton } from "@react-navigation/elements";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  FadeIn,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useAuth } from "@/contexts/AuthContext";
import { useFavorites } from "@/hooks/useFavorites";
import { apiRequest } from "@/lib/query-client";
import { Colors, Spacing, BorderRadius, FrequencyColors } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const PLAYLIST_ACCENT_COLORS = [
  "#6366F1",
  "#8B5CF6",
  "#4A90E2",
  "#10B981",
  "#F59E0B",
  "#EC4899",
  "#06B6D4",
  "#F97316",
];

interface Playlist {
  id: string;
  name: string;
  trackCount: number;
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

function WaveIllustration() {
  return (
    <View style={waveStyles.container}>
      <View style={waveStyles.wavesContainer}>
        {[0, 1, 2, 3, 4].map((i) => (
          <LinearGradient
            key={i}
            colors={[
              `rgba(99, 102, 241, ${0.12 - i * 0.015})`,
              `rgba(139, 92, 246, ${0.18 - i * 0.02})`,
              `rgba(74, 144, 226, ${0.12 - i * 0.015})`,
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[
              waveStyles.waveLine,
              {
                top: 20 + i * 22,
                width: SCREEN_WIDTH * (0.55 - i * 0.04),
                height: 3,
                borderRadius: 2,
                opacity: 1 - i * 0.15,
              },
            ]}
          />
        ))}
      </View>

      <View style={waveStyles.iconCircle}>
        <LinearGradient
          colors={["#4A5568", "#2D3748"]}
          style={waveStyles.iconCircleBg}
        >
          <Feather name="plus" size={28} color="rgba(255,255,255,0.6)" />
        </LinearGradient>
      </View>
    </View>
  );
}

const waveStyles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH * 0.6,
    height: 160,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  wavesContainer: {
    position: "absolute",
    width: "100%",
    height: "100%",
    alignItems: "center",
  },
  waveLine: {
    position: "absolute",
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
  },
  iconCircleBg: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default function PlaylistsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<NavigationProp>();
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const { favorites } = useFavorites();

  const [modalVisible, setModalVisible] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Playlist | null>(null);

  const { data: rawPlaylists, isLoading, refetch, isRefetching } = useQuery<Playlist[]>({
    queryKey: ["/api/playlists"],
  });

  const playlists = rawPlaylists?.filter(
    (p) => p.name.toLowerCase() !== "favorites"
  );

  const createPlaylistMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/playlists", { name });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/playlists"] });
      setModalVisible(false);
      setNewPlaylistName("");
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    },
  });

  const deletePlaylistMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/playlists/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/playlists"] });
      setDeleteTarget(null);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    },
  });

  function handleCreatePlaylist() {
    if (newPlaylistName.trim()) {
      createPlaylistMutation.mutate(newPlaylistName.trim());
    }
  }

  function handleDeletePlaylist() {
    if (deleteTarget) {
      deletePlaylistMutation.mutate(deleteTarget.id);
    }
  }

  function handleOpenPlaylist(playlist: Playlist) {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    navigation.navigate("PlaylistDetail", {
      playlistId: playlist.id,
      playlistName: playlist.name,
    });
  }

  React.useLayoutEffect(() => {
    navigation.getParent()?.setOptions({});
  }, [navigation]);

  function getAccentColor(index: number) {
    return PLAYLIST_ACCENT_COLORS[index % PLAYLIST_ACCENT_COLORS.length];
  }

  function renderPlaylist({ item, index }: { item: Playlist; index: number }) {
    const accentColor = getAccentColor(index);
    return (
      <Pressable
        style={styles.playlistRow}
        onPress={() => handleOpenPlaylist(item)}
        testID={`playlist-item-${item.id}`}
      >
        <View style={[styles.playlistAccentDot, { backgroundColor: accentColor }]} />
        <View style={styles.playlistRowContent}>
          <View style={styles.playlistRowInfo}>
            <ThemedText style={styles.playlistName}>{item.name}</ThemedText>
            <ThemedText style={styles.playlistTrackCount}>
              {item.trackCount} {item.trackCount === 1 ? "track" : "tracks"}
            </ThemedText>
          </View>
          <View style={styles.playlistRowActions}>
            <Pressable
              style={styles.deleteButton}
              onPress={() => setDeleteTarget(item)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              testID={`button-delete-playlist-${item.id}`}
            >
              <Feather name="trash-2" size={16} color={Colors.dark.textSecondary} />
            </Pressable>
            <Feather name="chevron-right" size={20} color={Colors.dark.textSecondary} />
          </View>
        </View>
      </Pressable>
    );
  }

  function renderEmpty() {
    return (
      <Pressable
        style={styles.emptyContainer}
        onPress={() => setModalVisible(true)}
        testID="button-create-first-playlist"
      >
        <WaveIllustration />
        <ThemedText style={styles.emptyTitle}>Create Your First Collection</ThemedText>
        <ThemedText style={styles.emptySubtext}>
          Organize your favorite binaural beats{"\n"}into personalized playlists
        </ThemedText>
        <View style={styles.emptyTapHint}>
          <Feather name="plus-circle" size={16} color={Colors.dark.link} />
          <ThemedText style={styles.emptyTapHintText}>Tap to get started</ThemedText>
        </View>
      </Pressable>
    );
  }

  function renderSectionHeader() {
    const hasPlaylists = playlists && playlists.length > 0;
    return (
      <View>
        <Pressable
          style={styles.favoritesCard}
          onPress={() => {
            if (Platform.OS !== "web") {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
            navigation.navigate("PlaylistDetail", {
              playlistId: "__favorites__",
              playlistName: "Favorites",
            });
          }}
          testID="button-favorites"
        >
          <LinearGradient
            colors={["#FF6B8A", "#FF8E9E"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.favoritesAccent}
          />
          <View style={styles.favoritesIconContainer}>
            <Feather name="heart" size={22} color="#FF6B8A" />
          </View>
          <View style={styles.favoritesInfo}>
            <ThemedText style={styles.favoritesTitle}>Favorites</ThemedText>
            <ThemedText style={styles.favoritesCount}>
              {favorites.length} {favorites.length === 1 ? "track" : "tracks"}
            </ThemedText>
          </View>
          <Feather name="chevron-right" size={20} color={Colors.dark.textSecondary} />
        </Pressable>

        <View style={styles.sectionHeader}>
          <ThemedText style={styles.sectionTitle}>Your Collections</ThemedText>
          {hasPlaylists ? (
            <Pressable
              style={styles.newButton}
              onPress={() => setModalVisible(true)}
              testID="button-new-playlist"
            >
              <Feather name="plus" size={16} color={Colors.dark.link} />
              <ThemedText style={styles.newButtonText}>New</ThemedText>
            </Pressable>
          ) : null}
        </View>
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
        data={playlists}
        keyExtractor={(item) => item.id}
        renderItem={renderPlaylist}
        contentContainerStyle={[
          styles.content,
          { paddingTop: headerHeight + Spacing.xl, paddingBottom: tabBarHeight + Spacing.xl },
          (playlists?.length || 0) === 0 && styles.emptyContentContainer,
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
        ListHeaderComponent={renderSectionHeader}
      />

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <Pressable onPress={(e) => e.stopPropagation()} style={styles.modalContent}>
            <ThemedText type="h4" style={styles.modalTitle}>
              New Playlist
            </ThemedText>
            <TextInput
              style={styles.modalInput}
              placeholder="Playlist name"
              placeholderTextColor={Colors.dark.textSecondary}
              value={newPlaylistName}
              onChangeText={setNewPlaylistName}
              autoFocus
              testID="input-playlist-name"
            />
            <View style={styles.modalButtons}>
              <Pressable
                style={styles.modalCancelButton}
                onPress={() => setModalVisible(false)}
              >
                <ThemedText style={styles.modalCancelText}>Cancel</ThemedText>
              </Pressable>
              <Button
                onPress={handleCreatePlaylist}
                disabled={!newPlaylistName.trim() || createPlaylistMutation.isPending}
                style={styles.modalCreateButton}
              >
                {createPlaylistMutation.isPending ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  "Create"
                )}
              </Button>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={deleteTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteTarget(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setDeleteTarget(null)}>
          <Pressable onPress={(e) => e.stopPropagation()} style={styles.modalContent}>
            <ThemedText type="h4" style={styles.modalTitle}>
              Delete Playlist
            </ThemedText>
            <ThemedText style={styles.deleteDescription}>
              Are you sure you want to delete "{deleteTarget?.name}"? This won't remove any tracks from your Favorites.
            </ThemedText>
            <View style={styles.modalButtons}>
              <Pressable
                style={styles.modalCancelButton}
                onPress={() => setDeleteTarget(null)}
                testID="button-cancel-delete"
              >
                <ThemedText style={styles.modalCancelText}>Cancel</ThemedText>
              </Pressable>
              <Pressable
                style={styles.deleteConfirmButton}
                onPress={handleDeletePlaylist}
                disabled={deletePlaylistMutation.isPending}
                testID="button-confirm-delete"
              >
                {deletePlaylistMutation.isPending ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <ThemedText style={styles.deleteConfirmText}>Delete</ThemedText>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  },
  emptyContentContainer: {
    flexGrow: 1,
  },

  favoritesCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    overflow: "hidden",
    marginBottom: Spacing.md,
  },
  favoritesAccent: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: BorderRadius.lg,
    borderBottomLeftRadius: BorderRadius.lg,
  },
  favoritesIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 107, 138, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: Spacing.xs,
  },
  favoritesInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  favoritesTitle: {
    color: Colors.dark.text,
    fontSize: 17,
    fontWeight: "600",
  },
  favoritesCount: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
  sectionTitle: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  newButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  newButtonText: {
    color: Colors.dark.link,
    fontSize: 14,
    fontWeight: "600",
  },

  playlistRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
  playlistAccentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.md,
  },
  playlistRowContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.dark.border,
    paddingBottom: Spacing.md,
  },
  playlistRowInfo: {
    flex: 1,
  },
  playlistName: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: "500",
  },
  playlistTrackCount: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  playlistRowActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  deleteButton: {
    padding: Spacing.xs,
  },

  emptyContainer: {
    alignItems: "center",
    paddingHorizontal: Spacing["2xl"],
    paddingTop: Spacing["3xl"],
  },
  emptyTitle: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  emptySubtext: {
    color: Colors.dark.textSecondary,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 21,
    marginBottom: Spacing.xl,
  },
  emptyTapHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    backgroundColor: "rgba(74, 144, 226, 0.08)",
  },
  emptyTapHintText: {
    color: Colors.dark.link,
    fontSize: 13,
    fontWeight: "500",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing["2xl"],
  },
  modalContent: {
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.lg,
    padding: Spacing["2xl"],
    width: "100%",
    maxWidth: 400,
  },
  modalTitle: {
    marginBottom: Spacing.lg,
  },
  modalInput: {
    height: Spacing.inputHeight,
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.lg,
    color: Colors.dark.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: Spacing.lg,
  },
  modalButtons: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  modalCancelButton: {
    flex: 1,
    height: Spacing.buttonHeight,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  modalCancelText: {
    color: Colors.dark.textSecondary,
  },
  modalCreateButton: {
    flex: 1,
  },
  deleteDescription: {
    color: Colors.dark.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  deleteConfirmButton: {
    flex: 1,
    height: Spacing.buttonHeight,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BorderRadius.full,
    backgroundColor: "#E53E3E",
  },
  deleteConfirmText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
});
