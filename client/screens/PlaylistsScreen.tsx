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
  Image,
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

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useAuth } from "@/contexts/AuthContext";
import { useFavorites } from "@/hooks/useFavorites";
import { apiRequest } from "@/lib/query-client";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

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

  function renderPlaylist({ item }: { item: Playlist }) {
    return (
      <Card style={styles.playlistCard} onPress={() => handleOpenPlaylist(item)}>
        <View style={styles.playlistIcon}>
          <Feather name="list" size={24} color={Colors.dark.link} />
        </View>
        <View style={styles.playlistInfo}>
          <ThemedText type="h4">{item.name}</ThemedText>
          <ThemedText style={styles.trackCount}>
            {item.trackCount} {item.trackCount === 1 ? "track" : "tracks"}
          </ThemedText>
        </View>
        <Pressable
          style={styles.deleteButton}
          onPress={() => setDeleteTarget(item)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          testID={`button-delete-playlist-${item.id}`}
        >
          <Feather name="trash-2" size={18} color={Colors.dark.textSecondary} />
        </Pressable>
        <Feather name="chevron-right" size={24} color={Colors.dark.textSecondary} />
      </Card>
    );
  }

  function renderEmpty() {
    return (
      <View style={styles.emptyContainer}>
        <Image
          source={require("../../assets/images/empty-playlists.png")}
          style={styles.emptyImage}
          resizeMode="contain"
        />
        <ThemedText type="h4" style={styles.emptyTitle}>
          No Playlists Yet
        </ThemedText>
        <ThemedText style={styles.emptyText}>
          Create your first playlist to organize your favorite beats
        </ThemedText>
        <Button onPress={() => setModalVisible(true)} style={styles.createButton}>
          Create Playlist
        </Button>
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
        ListHeaderComponent={
          <View>
            <Card
              style={styles.playlistCard}
              onPress={() => {
                if (Platform.OS !== "web") {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
                navigation.navigate("PlaylistDetail", {
                  playlistId: "__favorites__",
                  playlistName: "Favorites",
                });
              }}
            >
              <View style={[styles.playlistIcon, styles.favoritesIcon]}>
                <Feather name="heart" size={24} color="#FF6B8A" />
              </View>
              <View style={styles.playlistInfo}>
                <ThemedText type="h4">Favorites</ThemedText>
                <ThemedText style={styles.trackCount}>
                  {favorites.length} {favorites.length === 1 ? "track" : "tracks"}
                </ThemedText>
              </View>
              <Feather name="chevron-right" size={24} color={Colors.dark.textSecondary} />
            </Card>
            {playlists && playlists.length > 0 ? (
              <Pressable
                style={styles.addButton}
                onPress={() => setModalVisible(true)}
              >
                <Feather name="plus" size={20} color={Colors.dark.link} />
                <ThemedText type="link">Create New Playlist</ThemedText>
              </Pressable>
            ) : null}
          </View>
        }
      />

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
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
          </View>
        </View>
      </Modal>

      <Modal
        visible={deleteTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteTarget(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
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
          </View>
        </View>
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
    gap: Spacing.md,
  },
  emptyContentContainer: {
    flex: 1,
    justifyContent: "center",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  playlistCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
  },
  playlistIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.dark.backgroundSecondary,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  favoritesIcon: {
    backgroundColor: "rgba(255, 107, 138, 0.15)",
  },
  playlistInfo: {
    flex: 1,
  },
  trackCount: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
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
    marginBottom: Spacing["2xl"],
  },
  createButton: {
    paddingHorizontal: Spacing["3xl"],
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
  deleteButton: {
    padding: Spacing.sm,
    marginLeft: Spacing.sm,
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
