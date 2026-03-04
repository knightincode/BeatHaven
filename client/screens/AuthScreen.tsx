import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  Image,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useAuth } from "@/contexts/AuthContext";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";

const PASSWORD_RULES = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  {
    label: "Maximum 20 characters",
    test: (p: string) => p.length > 0 && p.length <= 20,
  },
  { label: "At least one number", test: (p: string) => /\d/.test(p) },
  {
    label: "At least one special character (!, @, #, $, &, *)",
    test: (p: string) => /[!@#$&*]/.test(p),
  },
];

function validatePassword(password: string): string | null {
  if (password.length < 8) return "Password must be at least 8 characters";
  if (password.length > 20) return "Password must be 20 characters or fewer";
  if (!/\d/.test(password)) return "Password must include at least one number";
  if (!/[!@#$&*]/.test(password))
    return "Password must include a special character (!, @, #, $, &, *)";
  return null;
}

function PasswordRulesChecklist({ password }: { password: string }) {
  return (
    <View style={styles.rulesContainer}>
      {PASSWORD_RULES.map((rule, index) => {
        const passed = password.length > 0 && rule.test(password);
        return (
          <View key={index} style={styles.ruleRow}>
            <Feather
              name={passed ? "check-circle" : "circle"}
              size={14}
              color={passed ? Colors.dark.success : Colors.dark.textSecondary}
            />
            <ThemedText
              style={[styles.ruleText, passed ? styles.ruleTextPassed : null]}
            >
              {rule.label}
            </ThemedText>
          </View>
        );
      })}
    </View>
  );
}

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    setError("");

    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }

    if (!isLogin) {
      const pwError = validatePassword(password);
      if (pwError) {
        setError(pwError);
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match");
        return;
      }
    }

    setIsLoading(true);
    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register(email, password);
      }
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err: any) {
      if (isLogin) {
        setError("Invalid email or password");
      } else {
        const message = err.message || "An error occurred";
        setError(message);
      }
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setIsLoading(false);
    }
  }

  function toggleMode() {
    setIsLogin(!isLogin);
    setError("");
    setConfirmPassword("");
  }

  return (
    <LinearGradient
      colors={["#0A0E1A", "#1A1F2E", "#252B3D"]}
      style={styles.gradient}
    >
      <KeyboardAwareScrollViewCompat
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoContainer}>
          <Image
            source={require("../../assets/images/icon.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <ThemedText type="h1" style={styles.title}>
            BinauralBeats
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            Your personal meditation sanctuary
          </ThemedText>
        </View>

        <View style={styles.form}>
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

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={Colors.dark.textSecondary}
            value={password}
            onChangeText={(text) => setPassword(text.slice(0, 20))}
            secureTextEntry
            maxLength={20}
            testID="input-password"
          />

          {!isLogin ? (
            <>
              <PasswordRulesChecklist password={password} />
              <TextInput
                style={styles.input}
                placeholder="Confirm Password"
                placeholderTextColor={Colors.dark.textSecondary}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                maxLength={20}
                testID="input-confirm-password"
              />
            </>
          ) : null}

          {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

          <Button
            onPress={handleSubmit}
            disabled={isLoading}
            style={styles.button}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : isLogin ? (
              "Sign In"
            ) : (
              "Create Account"
            )}
          </Button>

          <Pressable onPress={toggleMode} style={styles.toggleContainer}>
            <ThemedText style={styles.toggleText}>
              {isLogin
                ? "Don't have an account? "
                : "Already have an account? "}
              <ThemedText type="link" style={styles.toggleLink}>
                {isLogin ? "Sign Up" : "Sign In"}
              </ThemedText>
            </ThemedText>
          </Pressable>
        </View>

        <ThemedText style={styles.priceInfo}>
          Start your 7-day free trial, then $0.99/month
        </ThemedText>
      </KeyboardAwareScrollViewCompat>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing["2xl"],
    justifyContent: "center",
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: Spacing["4xl"],
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: Spacing.lg,
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  subtitle: {
    textAlign: "center",
    color: Colors.dark.textSecondary,
    fontSize: 16,
  },
  form: {
    gap: Spacing.lg,
  },
  input: {
    height: Spacing.inputHeight,
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.lg,
    color: Colors.dark.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  rulesContainer: {
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
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
  error: {
    color: Colors.dark.error,
    textAlign: "center",
  },
  button: {
    marginTop: Spacing.sm,
  },
  toggleContainer: {
    alignItems: "center",
    marginTop: Spacing.lg,
  },
  toggleText: {
    color: Colors.dark.textSecondary,
  },
  toggleLink: {
    color: Colors.dark.link,
  },
  priceInfo: {
    textAlign: "center",
    color: Colors.dark.textSecondary,
    marginTop: Spacing["4xl"],
    fontSize: 14,
  },
});
