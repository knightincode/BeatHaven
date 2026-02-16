import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { useMutation } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

const PASSWORD_RULES = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "Maximum 15 characters", test: (p: string) => p.length > 0 && p.length <= 15 },
  { label: "At least one number", test: (p: string) => /\d/.test(p) },
  { label: "At least one special character (!, @, #, $, &, *)", test: (p: string) => /[!@#$&*]/.test(p) },
];

function validatePassword(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters";
  if (password.length > 15) return "Password must be 15 characters or fewer";
  if (!/\d/.test(password)) return "Password must include at least one number";
  if (!/[!@#$&*]/.test(password)) return "Password must include a special character (!, @, #, $, &, *)";
  return null;
}

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation();
  const { user, token, refreshUser } = useAuth();

  const [email, setEmail] = useState(user?.email || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const updateMutation = useMutation({
    mutationFn: async (data: { email?: string; currentPassword?: string; newPassword?: string }) => {
      const baseUrl = getApiUrl();
      const res = await fetch(`${baseUrl}api/user/update`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to update profile");
      }
      return res.json();
    },
    onSuccess: () => {
      setSuccess("Profile updated successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      refreshUser();
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    },
    onError: (err: Error) => {
      setError(err.message);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    },
  });

  function handleSave() {
    setError("");
    setSuccess("");

    if (newPassword) {
      const pwError = validatePassword(newPassword);
      if (pwError) {
        setError(pwError);
        return;
      }
    }

    if (newPassword && newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    if (newPassword && !currentPassword) {
      setError("Please enter your current password");
      return;
    }

    const data: { email?: string; currentPassword?: string; newPassword?: string } = {};
    
    if (email !== user?.email) {
      data.email = email;
    }

    if (newPassword) {
      data.currentPassword = currentPassword;
      data.newPassword = newPassword;
    }

    if (Object.keys(data).length === 0) {
      setError("No changes to save");
      return;
    }

    updateMutation.mutate(data);
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollViewCompat
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          { paddingTop: headerHeight + Spacing.xl, paddingBottom: insets.bottom + Spacing.xl },
        ]}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
      >
        <Card style={styles.card}>
          <ThemedText style={styles.sectionTitle}>Email</ThemedText>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={Colors.dark.textSecondary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            testID="input-email"
          />
        </Card>

        <Card style={styles.card}>
          <ThemedText style={styles.sectionTitle}>Change Password</ThemedText>
          <TextInput
            style={styles.input}
            placeholder="Current Password"
            placeholderTextColor={Colors.dark.textSecondary}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            testID="input-current-password"
          />
          <TextInput
            style={styles.input}
            placeholder="New Password"
            placeholderTextColor={Colors.dark.textSecondary}
            value={newPassword}
            onChangeText={(text) => setNewPassword(text.slice(0, 15))}
            secureTextEntry
            maxLength={15}
            testID="input-new-password"
          />
          {newPassword.length > 0 ? (
            <View style={styles.rulesContainer}>
              {PASSWORD_RULES.map((rule, index) => {
                const passed = rule.test(newPassword);
                return (
                  <View key={index} style={styles.ruleRow}>
                    <Feather
                      name={passed ? "check-circle" : "circle"}
                      size={14}
                      color={passed ? Colors.dark.success : Colors.dark.textSecondary}
                    />
                    <ThemedText style={[styles.ruleText, passed ? styles.ruleTextPassed : null]}>
                      {rule.label}
                    </ThemedText>
                  </View>
                );
              })}
            </View>
          ) : null}
          <TextInput
            style={styles.input}
            placeholder="Confirm New Password"
            placeholderTextColor={Colors.dark.textSecondary}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            maxLength={15}
            testID="input-confirm-password"
          />
        </Card>

        {error ? (
          <ThemedText style={styles.error}>{error}</ThemedText>
        ) : null}

        {success ? (
          <ThemedText style={styles.success}>{success}</ThemedText>
        ) : null}

        <Button
          onPress={handleSave}
          disabled={updateMutation.isPending}
          style={styles.saveButton}
        >
          {updateMutation.isPending ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            "Save Changes"
          )}
        </Button>
      </KeyboardAwareScrollViewCompat>
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
  card: {
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
  },
  sectionTitle: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: Spacing.md,
  },
  input: {
    height: Spacing.inputHeight,
    backgroundColor: Colors.dark.backgroundSecondary,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.lg,
    color: Colors.dark.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    marginBottom: Spacing.md,
  },
  error: {
    color: Colors.dark.error,
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  success: {
    color: Colors.dark.success,
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  saveButton: {
    marginTop: Spacing.md,
  },
  rulesContainer: {
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    gap: 6,
  },
  ruleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  ruleText: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
  },
  ruleTextPassed: {
    color: Colors.dark.success,
  },
});
