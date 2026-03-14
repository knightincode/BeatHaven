import React, { useEffect, useState } from "react";
import { View, StyleSheet, Modal, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { getBiometricType } from "@/services/biometricAuth";

interface BiometricPromptModalProps {
  visible: boolean;
  onEnable: () => void;
  onSkip: () => void;
}

export function BiometricPromptModal({ visible, onEnable, onSkip }: BiometricPromptModalProps) {
  const [biometricName, setBiometricName] = useState("Biometric");

  useEffect(() => {
    getBiometricType().then(setBiometricName);
  }, []);

  const iconName = biometricName === "Face ID" ? "smile" : "smartphone";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconContainer}>
            <Feather name={iconName} size={48} color={Colors.dark.accent} />
          </View>

          <ThemedText type="h2" style={styles.title}>
            Enable {biometricName}?
          </ThemedText>

          <ThemedText style={styles.description}>
            Sign in faster next time using {biometricName}. You can change this later in settings.
          </ThemedText>

          <Button
            onPress={() => {
              if (Platform.OS !== "web") {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              onEnable();
            }}
            style={styles.enableButton}
            testID="button-enable-biometric"
          >
            Enable {biometricName}
          </Button>

          <Pressable
            onPress={onSkip}
            style={styles.skipButton}
            testID="button-skip-biometric"
          >
            <ThemedText style={styles.skipText}>Not now</ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing["2xl"],
  },
  card: {
    width: "100%",
    backgroundColor: Colors.dark.backgroundElevated,
    borderRadius: BorderRadius.lg,
    padding: Spacing["2xl"],
    alignItems: "center",
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(108, 99, 255, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  description: {
    textAlign: "center",
    color: Colors.dark.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: Spacing["2xl"],
  },
  enableButton: {
    width: "100%",
    marginBottom: Spacing.md,
  },
  skipButton: {
    paddingVertical: Spacing.md,
  },
  skipText: {
    color: Colors.dark.textSecondary,
    fontSize: 15,
  },
});
