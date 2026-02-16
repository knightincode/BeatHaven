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

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/Button";
import { useAuth } from "@/contexts/AuthContext";
import { useFavorites } from "@/hooks/useFavorites";
import { apiRequest } from "@/lib/query-client";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

const THUMB_COLORS: [string, string][] = [
  ["#6366F1", "#4F46E5"],
  ["#8B5CF6", "#7C3AED"],
  ["#3B82F6", "#2563EB"],
  ["#10B981", "#059669"],
  ["#F59E0B", "#D97706"],
  ["#EC4899", "#DB2777"],
  ["#06B6D4", "#0891B2"],
  ["#F97316", "#EA580C"],
];

interface Playlist {
  id: string;
  name: string;
  trackCount: number;
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

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

  function getThumbColors(index: number): [string, string] {
    return THUMB_COLORS[index % THUMB_COLORS.length];
  }

  function renderPlaylist({ item, index }: { item: Playlist; index: number }) {
    const [c1, c2] = getThumbColors(index);
    return (
      <Pressable
        style={styles.playlistRow}
        onPress={() => handleOpenPlaylist(item)}
        testID={`playlist-item-${item.id}`}
      >
        <LinearGradient
          colors={[c1, c2]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.playlistThumb}
        >
          <Feather name="music" size={18} color="rgba(255,255,255,0.85)" />
        </LinearGradient>
        <View style={styles.playlistInfo}>
          <ThemedText style={styles.playlistName} numberOfLines={1}>{item.name}</ThemedText>
          <ThemedText style={styles.playlistMeta}>
            Playlist  {item.trackCount} {item.trackCount === 1 ? "track" : "tracks"}
          </ThemedText>
        </View>
        <Pressable
          style={styles.deleteBtn}
          onPress={() => setDeleteTarget(item)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          testID={`button-delete-playlist-${item.id}`}
        >
          <Feather name="more-vertical" size={20} color={Colors.dark.textSecondary} />
        </Pressable>
      </Pressable>
    );
  }

  function renderEmpty() {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconWrap}>
          <Feather name="headphones" size={40} color={Colors.dark.textSecondary} />
        </View>
        <ThemedText style={styles.emptyTitle}>Create your first playlist</ThemedText>
        <ThemedText style={styles.emptySubtext}>
          It's easy — we'll help you
        </ThemedText>
        <Pressable
          style={styles.createBtn}
          onPress={() => setModalVisible(true)}
          testID="button-create-first-playlist"
        >
          <ThemedText style={styles.createBtnText}>Create playlist</ThemedText>
        </Pressable>
      </View>
    );
  }

  function renderHeader() {
    return (
      <View>
        <Pressable
          style={styles.likedCard}
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
            colors={["#4338CA", "#6D28D9", "#7C3AED"]}
            start={{ x: 0, y: 1 }}
            end={{ x: 1, y: 0 }}
            style={styles.likedThumb}
          >
            <Feather name="heart" size={22} color="#FFFFFF" />
          </LinearGradient>
          <View style={styles.likedInfo}>
            <ThemedText style={styles.likedTitle}>Liked Tracks</ThemedText>
            <ThemedText style={styles.likedMeta}>
              {favorites.length} {favorites.length === 1 ? "track" : "tracks"}
            </ThemedText>
          </View>
        </Pressable>

        {playlists && playlists.length > 0 ? (
          <View style={styles.sectionRow}>
            <ThemedText style={styles.sectionLabel}>Playlists</ThemedText>
          </View>
        ) : null}
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

  const hasPlaylists = playlists && playlists.length > 0;

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={playlists}
        keyExtractor={(item) => item.id}
        renderItem={renderPlaylist}
        contentContainerStyle={[
          styles.content,
          { paddingTop: headerHeight + Spacing.lg, paddingBottom: tabBarHeight + 80 },
          !hasPlaylists && styles.emptyContentContainer,
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
        ListHeaderComponent={renderHeader}
      />

      {hasPlaylists ? (
        <Pressable
          style={[styles.fab, { bottom: tabBarHeight + Spacing.lg }]}
          onPress={() => setModalVisible(true)}
          testID="button-new-playlist"
        >
          <LinearGradient
            colors={["#1DB954", "#1ED760"]}
            style={styles.fabGradient}
          >
            <Feather name="plus" size={28} color="#000000" />
          </LinearGradient>
        </Pressable>
      ) : null}

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <Pressable onPress={(e) => e.stopPropagation()} style={styles.modalContent}>
            <ThemedText style={styles.modalTitle}>Give your playlist a name</ThemedText>
            <TextInput
              style={styles.modalInput}
              placeholder="My playlist"
              placeholderTextColor={Colors.dark.textSecondary}
              value={newPlaylistName}
              onChangeText={setNewPlaylistName}
              autoFocus
              testID="input-playlist-name"
            />
            <View style={styles.modalButtons}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => {
                  setModalVisible(false);
                  setNewPlaylistName("");
                }}
              >
                <ThemedText style={styles.modalCancelText}>Cancel</ThemedText>
              </Pressable>
              <Pressable
                style={[
                  styles.modalCreateBtn,
                  (!newPlaylistName.trim() || createPlaylistMutation.isPending) && styles.modalCreateBtnDisabled,
                ]}
                onPress={handleCreatePlaylist}
                disabled={!newPlaylistName.trim() || createPlaylistMutation.isPending}
              >
                {createPlaylistMutation.isPending ? (
                  <ActivityIndicator color="#000000" size="small" />
                ) : (
                  <ThemedText style={styles.modalCreateText}>Create</ThemedText>
                )}
              </Pressable>
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
            <ThemedText style={styles.modalTitle}>Delete playlist</ThemedText>
            <ThemedText style={styles.deleteDesc}>
              Delete "{deleteTarget?.name}" from your library?
            </ThemedText>
            <View style={styles.modalButtons}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setDeleteTarget(null)}
                testID="button-cancel-delete"
              >
                <ThemedText style={styles.modalCancelText}>Cancel</ThemedText>
              </Pressable>
              <Pressable
                style={styles.deleteConfirmBtn}
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

  likedCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: BorderRadius.xs,
    padding: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  likedThumb: {
    width: 56,
    height: 56,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  likedInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  likedTitle: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: "700",
  },
  likedMeta: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },

  sectionRow: {
    marginBottom: Spacing.sm,
  },
  sectionLabel: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: "700",
  },

  playlistRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  playlistThumb: {
    width: 48,
    height: 48,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  playlistInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  playlistName: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: "600",
  },
  playlistMeta: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  deleteBtn: {
    padding: Spacing.sm,
  },

  emptyContainer: {
    alignItems: "center",
    paddingTop: Spacing["4xl"],
    paddingHorizontal: Spacing["2xl"],
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.dark.backgroundSecondary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  emptyTitle: {
    color: Colors.dark.text,
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  emptySubtext: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    textAlign: "center",
    marginBottom: Spacing["2xl"],
  },
  createBtn: {
    backgroundColor: "#1DB954",
    paddingHorizontal: Spacing["3xl"],
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  createBtnText: {
    color: "#000000",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  fab: {
    position: "absolute",
    right: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: "hidden",
  },
  fabGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing["2xl"],
  },
  modalContent: {
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: BorderRadius.xs,
    padding: Spacing["2xl"],
    width: "100%",
    maxWidth: 360,
  },
  modalTitle: {
    color: Colors.dark.text,
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  modalInput: {
    height: 48,
    backgroundColor: Colors.dark.backgroundTertiary,
    borderRadius: 6,
    paddingHorizontal: Spacing.lg,
    color: Colors.dark.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: Spacing.xl,
    textAlign: "center",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.lg,
  },
  modalCancelBtn: {
    paddingHorizontal: Spacing["2xl"],
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  modalCancelText: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: "700",
  },
  modalCreateBtn: {
    backgroundColor: "#1DB954",
    paddingHorizontal: Spacing["2xl"],
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  modalCreateBtnDisabled: {
    opacity: 0.4,
  },
  modalCreateText: {
    color: "#000000",
    fontSize: 15,
    fontWeight: "700",
  },
  deleteDesc: {
    color: Colors.dark.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  deleteConfirmBtn: {
    backgroundColor: "#E53E3E",
    paddingHorizontal: Spacing["2xl"],
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  deleteConfirmText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});
