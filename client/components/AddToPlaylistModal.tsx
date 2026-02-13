import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest, queryClient } from "@/lib/query-client";
import { useAuth } from "@/contexts/AuthContext";

interface Playlist {
  id: string;
  name: string;
  trackCount?: number;
  tracks?: unknown[];
}

interface AddToPlaylistModalProps {
  visible: boolean;
  onClose: () => void;
  trackId: string;
  trackTitle: string;
}

export function AddToPlaylistModal({ visible, onClose, trackId, trackTitle }: AddToPlaylistModalProps) {
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();
  const [showCreateInput, setShowCreateInput] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [successPlaylistId, setSuccessPlaylistId] = useState<string | null>(null);

  const { data: playlists = [], isLoading: playlistsLoading } = useQuery<Playlist[]>({
    queryKey: ["/api/playlists"],
    enabled: isAuthenticated && visible,
  });

  const addToPlaylist = useMutation({
    mutationFn: async (playlistId: string) => {
      await apiRequest("POST", `/api/playlists/${playlistId}/tracks`, { trackId });
    },
    onSuccess: (_data, playlistId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/playlists"] });
      setSuccessPlaylistId(playlistId);
      setTimeout(() => {
        setSuccessPlaylistId(null);
        handleClose();
      }, 800);
    },
  });

  const createPlaylist = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/playlists", { name });
      return await res.json();
    },
    onSuccess: async (newPlaylist: Playlist) => {
      queryClient.invalidateQueries({ queryKey: ["/api/playlists"] });
      setNewPlaylistName("");
      setShowCreateInput(false);
      addToPlaylist.mutate(newPlaylist.id);
    },
  });

  function handleClose() {
    setShowCreateInput(false);
    setNewPlaylistName("");
    setSuccessPlaylistId(null);
    onClose();
  }

  function handleSelectPlaylist(playlistId: string) {
    addToPlaylist.mutate(playlistId);
  }

  function handleCreatePlaylist() {
    const trimmed = newPlaylistName.trim();
    if (trimmed.length > 0) {
      createPlaylist.mutate(trimmed);
    }
  }

  if (!isAuthenticated) {
    return null;
  }

  const isMutating = addToPlaylist.isPending || createPlaylist.isPending;
  const screenHeight = Dimensions.get("window").height;
  const modalMaxHeight = screenHeight - insets.top - insets.bottom - 80;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.overlay} onPress={handleClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.keyboardAvoid}
        >
          <Pressable
            style={[styles.content, { maxHeight: modalMaxHeight }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.handle} />

            <View style={styles.header}>
              <ThemedText type="h4">Add to Playlist</ThemedText>
              <Pressable onPress={handleClose} hitSlop={8} testID="button-close-playlist-modal">
                <Feather name="x" size={24} color={Colors.dark.text} />
              </Pressable>
            </View>

            <ThemedText style={styles.description} numberOfLines={1}>
              {trackTitle}
            </ThemedText>

            {showCreateInput ? (
              <View style={styles.createInputRow}>
                <TextInput
                  style={styles.textInput}
                  placeholder="Playlist name"
                  placeholderTextColor={Colors.dark.textSecondary}
                  value={newPlaylistName}
                  onChangeText={setNewPlaylistName}
                  autoFocus
                  testID="input-new-playlist-name"
                />
                <Pressable
                  style={[
                    styles.createButton,
                    newPlaylistName.trim().length === 0 ? { opacity: 0.5 } : {},
                  ]}
                  onPress={handleCreatePlaylist}
                  disabled={newPlaylistName.trim().length === 0 || createPlaylist.isPending}
                  testID="button-create-playlist"
                >
                  {createPlaylist.isPending ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <ThemedText style={styles.createButtonText}>Create</ThemedText>
                  )}
                </Pressable>
                <Pressable
                  onPress={() => {
                    setShowCreateInput(false);
                    setNewPlaylistName("");
                  }}
                  style={styles.cancelCreateButton}
                  testID="button-cancel-create-playlist"
                >
                  <Feather name="x" size={20} color={Colors.dark.textSecondary} />
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={styles.newPlaylistRow}
                onPress={() => setShowCreateInput(true)}
                testID="button-show-create-playlist"
              >
                <View style={styles.newPlaylistIcon}>
                  <Feather name="plus" size={20} color={Colors.dark.link} />
                </View>
                <ThemedText style={styles.newPlaylistText}>Create New Playlist</ThemedText>
              </Pressable>
            )}

            <View style={styles.divider} />

            <ThemedText style={styles.sectionLabel}>Your Playlists</ThemedText>

            <ScrollView
              style={styles.playlistList}
              contentContainerStyle={styles.playlistListContent}
              showsVerticalScrollIndicator={false}
            >
              {playlistsLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={Colors.dark.link} />
                </View>
              ) : playlists.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Feather name="music" size={32} color={Colors.dark.textSecondary} style={{ marginBottom: Spacing.md }} />
                  <ThemedText style={styles.emptyText}>No playlists yet</ThemedText>
                  <ThemedText style={styles.emptySubtext}>
                    Create one above to get started
                  </ThemedText>
                </View>
              ) : (
                playlists.map((playlist) => {
                  const isSuccess = successPlaylistId === playlist.id;
                  const trackCount = playlist.trackCount ?? playlist.tracks?.length ?? 0;
                  return (
                    <Pressable
                      key={playlist.id}
                      style={[
                        styles.playlistRow,
                        isSuccess ? { backgroundColor: Colors.dark.success + "20", borderColor: Colors.dark.success } : {},
                      ]}
                      onPress={() => handleSelectPlaylist(playlist.id)}
                      disabled={isMutating}
                      testID={`button-playlist-${playlist.id}`}
                    >
                      <View style={styles.playlistIcon}>
                        {isSuccess ? (
                          <Feather name="check" size={20} color={Colors.dark.success} />
                        ) : (
                          <Feather name="music" size={20} color={Colors.dark.textSecondary} />
                        )}
                      </View>
                      <View style={styles.playlistInfo}>
                        <ThemedText style={styles.playlistName} numberOfLines={1}>
                          {playlist.name}
                        </ThemedText>
                        <ThemedText style={styles.playlistCount}>
                          {trackCount} {trackCount === 1 ? "track" : "tracks"}
                        </ThemedText>
                      </View>
                      {addToPlaylist.isPending && addToPlaylist.variables === playlist.id ? (
                        <ActivityIndicator size="small" color={Colors.dark.link} />
                      ) : null}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  keyboardAvoid: {
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    width: "100%",
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.xl,
    padding: Spacing["2xl"],
    paddingTop: Spacing.md,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.dark.textSecondary + "40",
    alignSelf: "center",
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  description: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    marginBottom: Spacing.lg,
  },
  createInputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  textInput: {
    flex: 1,
    height: 44,
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    color: Colors.dark.text,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  createButton: {
    height: 44,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.dark.link,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  createButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  cancelCreateButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  newPlaylistRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.xs,
    gap: Spacing.md,
  },
  newPlaylistIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.backgroundSecondary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.dark.link + "40",
  },
  newPlaylistText: {
    color: Colors.dark.link,
    fontSize: 15,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    backgroundColor: Colors.dark.border,
    marginVertical: Spacing.sm,
  },
  sectionLabel: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  playlistList: {
    minHeight: 120,
    maxHeight: 300,
  },
  playlistListContent: {
    paddingBottom: Spacing.sm,
  },
  loadingContainer: {
    paddingVertical: Spacing["2xl"],
    alignItems: "center",
  },
  emptyContainer: {
    paddingVertical: Spacing["2xl"],
    alignItems: "center",
  },
  emptyText: {
    color: Colors.dark.textSecondary,
    fontSize: 15,
    fontWeight: "500",
  },
  emptySubtext: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    marginTop: Spacing.xs,
    opacity: 0.7,
  },
  playlistRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: "transparent",
    marginBottom: Spacing.xs,
    gap: Spacing.md,
    backgroundColor: Colors.dark.backgroundSecondary + "60",
  },
  playlistIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.dark.backgroundSecondary,
    alignItems: "center",
    justifyContent: "center",
  },
  playlistInfo: {
    flex: 1,
  },
  playlistName: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: "500",
  },
  playlistCount: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
});
