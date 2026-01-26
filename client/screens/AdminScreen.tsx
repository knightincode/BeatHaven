import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { useAuth } from "@/contexts/AuthContext";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";

const CATEGORIES = ["Delta", "Theta", "Alpha", "Beta", "Gamma"];

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation();
  const { token, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [baseFrequency, setBaseFrequency] = useState("");
  const [beatFrequency, setBeatFrequency] = useState("");
  const [duration, setDuration] = useState("");
  const [category, setCategory] = useState("Delta");
  const [selectedFile, setSelectedFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile || !title || !baseFrequency || !beatFrequency || !duration || !category) {
        throw new Error("Please fill all required fields");
      }

      const formData = new FormData();
      
      const fileUri = selectedFile.uri;
      const fileName = selectedFile.name || "audio.wav";
      
      if (Platform.OS === "web") {
        const response = await fetch(fileUri);
        const blob = await response.blob();
        formData.append("audio", blob, fileName);
      } else {
        formData.append("audio", {
          uri: fileUri,
          name: fileName,
          type: selectedFile.mimeType || "audio/wav",
        } as any);
      }

      const frequencyStr = `${baseFrequency}Hz base, ${beatFrequency}Hz beat`;
      formData.append("title", title);
      formData.append("description", description);
      formData.append("frequency", frequencyStr);
      formData.append("category", category);
      formData.append("duration", duration);

      const baseUrl = getApiUrl();
      const url = new URL("/api/admin/tracks", baseUrl);

      const res = await fetch(url.toString(), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to upload track");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tracks"] });
      setUploadSuccess(true);
      resetForm();
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    },
  });

  function resetForm() {
    setTitle("");
    setDescription("");
    setBaseFrequency("");
    setBeatFrequency("");
    setDuration("");
    setCategory("Delta");
    setSelectedFile(null);
  }

  async function handlePickFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "audio/*",
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets.length > 0) {
        setSelectedFile(result.assets[0]);
        setUploadSuccess(false);
      }
    } catch (error) {
      console.error("Error picking file:", error);
    }
  }

  function handleUpload() {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    uploadMutation.mutate();
  }

  if (!isAdmin) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.content, { paddingTop: headerHeight + Spacing.xl }]}>
          <Card style={styles.errorCard}>
            <Feather name="alert-circle" size={48} color={Colors.dark.error} />
            <ThemedText type="h4" style={styles.errorTitle}>
              Access Denied
            </ThemedText>
            <ThemedText style={styles.errorText}>
              You don't have permission to access this screen.
            </ThemedText>
          </Card>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingTop: headerHeight + Spacing.xl, paddingBottom: insets.bottom + Spacing.xl },
        ]}
      >
        <ThemedText type="h3" style={styles.headerTitle}>
          Upload New Track
        </ThemedText>
        <ThemedText style={styles.headerSubtitle}>
          Add a new binaural beat to the app
        </ThemedText>

        {uploadSuccess ? (
          <Card style={styles.successCard}>
            <Feather name="check-circle" size={32} color={Colors.dark.success} />
            <ThemedText style={styles.successText}>Track uploaded successfully!</ThemedText>
          </Card>
        ) : null}

        <Card style={styles.formCard}>
          <Pressable style={styles.filePickerButton} onPress={handlePickFile}>
            <View style={styles.filePickerContent}>
              <Feather
                name={selectedFile ? "file" : "upload"}
                size={24}
                color={Colors.dark.link}
              />
              <ThemedText style={styles.filePickerText}>
                {selectedFile ? selectedFile.name : "Select Audio File"}
              </ThemedText>
            </View>
            {selectedFile ? (
              <Pressable
                onPress={() => setSelectedFile(null)}
                hitSlop={10}
              >
                <Feather name="x" size={20} color={Colors.dark.textSecondary} />
              </Pressable>
            ) : null}
          </Pressable>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Title *</ThemedText>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g., Deep Sleep Delta"
              placeholderTextColor={Colors.dark.textSecondary}
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Description</ThemedText>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Purpose or description of the binaural beat"
              placeholderTextColor={Colors.dark.textSecondary}
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, styles.halfWidth]}>
              <ThemedText style={styles.label}>Base Frequency (Hz) *</ThemedText>
              <TextInput
                style={styles.input}
                value={baseFrequency}
                onChangeText={setBaseFrequency}
                placeholder="e.g., 120"
                placeholderTextColor={Colors.dark.textSecondary}
                keyboardType="numeric"
              />
            </View>
            <View style={[styles.inputGroup, styles.halfWidth]}>
              <ThemedText style={styles.label}>Beat Frequency (Hz) *</ThemedText>
              <TextInput
                style={styles.input}
                value={beatFrequency}
                onChangeText={setBeatFrequency}
                placeholder="e.g., 5"
                placeholderTextColor={Colors.dark.textSecondary}
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Duration (seconds) *</ThemedText>
            <TextInput
              style={styles.input}
              value={duration}
              onChangeText={setDuration}
              placeholder="e.g., 1800 for 30 minutes"
              placeholderTextColor={Colors.dark.textSecondary}
              keyboardType="numeric"
            />
          </View>

          <View style={styles.inputGroup}>
            <ThemedText style={styles.label}>Category *</ThemedText>
            <View style={styles.categoryContainer}>
              {CATEGORIES.map((cat) => (
                <Pressable
                  key={cat}
                  style={[
                    styles.categoryButton,
                    category === cat && styles.categoryButtonActive,
                  ]}
                  onPress={() => setCategory(cat)}
                >
                  <ThemedText
                    style={[
                      styles.categoryButtonText,
                      category === cat && styles.categoryButtonTextActive,
                    ]}
                  >
                    {cat}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>

          {uploadMutation.error ? (
            <View style={styles.errorMessage}>
              <Feather name="alert-circle" size={16} color={Colors.dark.error} />
              <ThemedText style={styles.errorMessageText}>
                {(uploadMutation.error as Error).message}
              </ThemedText>
            </View>
          ) : null}

          <Button
            onPress={handleUpload}
            disabled={uploadMutation.isPending || !selectedFile || !title || !baseFrequency || !beatFrequency || !duration}
            style={styles.uploadButton}
          >
            {uploadMutation.isPending ? (
              <ActivityIndicator color={Colors.dark.buttonText} />
            ) : (
              "Upload Track"
            )}
          </Button>
        </Card>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  headerTitle: {
    marginBottom: Spacing.xs,
  },
  headerSubtitle: {
    color: Colors.dark.textSecondary,
    marginBottom: Spacing.xl,
  },
  successCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: Colors.dark.success + "20",
    marginBottom: Spacing.lg,
  },
  successText: {
    color: Colors.dark.success,
    flex: 1,
  },
  formCard: {
    padding: Spacing.xl,
  },
  filePickerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: BorderRadius.sm,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderStyle: "dashed",
  },
  filePickerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  filePickerText: {
    color: Colors.dark.link,
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  label: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    marginBottom: Spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    color: Colors.dark.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  row: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  halfWidth: {
    flex: 1,
  },
  categoryContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  categoryButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.dark.backgroundSecondary,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  categoryButtonActive: {
    backgroundColor: Colors.dark.link,
    borderColor: Colors.dark.link,
  },
  categoryButtonText: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
  },
  categoryButtonTextActive: {
    color: Colors.dark.buttonText,
  },
  errorMessage: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  errorMessageText: {
    color: Colors.dark.error,
    flex: 1,
  },
  uploadButton: {
    marginTop: Spacing.md,
  },
  errorCard: {
    alignItems: "center",
    padding: Spacing["2xl"],
  },
  errorTitle: {
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  errorText: {
    color: Colors.dark.textSecondary,
    textAlign: "center",
  },
});
