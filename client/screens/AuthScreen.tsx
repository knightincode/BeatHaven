import React, { useState, useEffect } from "react";
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

import * as AppleAuthentication from "expo-apple-authentication";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useAuth } from "@/contexts/AuthContext";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useGoogleAuth, getGoogleAuthSetupInfo, isRunningInExpoGo } from "@/services/googleAuth";

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
  const {
    login,
    register,
    loginAsDemo,
    loginWithApple,
    loginWithGoogle,
    appleAuthAvailable,
    pendingAuthMode,
    clearPendingAuthMode,
  } = useAuth();
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const { request: googleRequest, response: googleResponse, promptAsync: googlePromptAsync } = useGoogleAuth();
  const googleUnavailableInExpoGo = Platform.OS !== "web" && isRunningInExpoGo();
  const [isLogin, setIsLogin] = useState(pendingAuthMode !== "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (pendingAuthMode) {
      clearPendingAuthMode();
    }
  }, []);

  useEffect(() => {
    if (!googleResponse) return;

    if (googleResponse.type === "success") {
      const idToken = googleResponse.params?.id_token;
      if (idToken) {
        handleGoogleSignIn(idToken);
      } else {
        console.error("[GoogleAuth] Success response but no id_token in params:", JSON.stringify(googleResponse.params));
        setError("Google Sign-In failed: no token received.");
        setIsGoogleLoading(false);
      }
    } else if (googleResponse.type === "error") {
      console.error("[GoogleAuth] Error response:", googleResponse.error);
      setError("Google Sign-In failed. Please try again.");
      setIsGoogleLoading(false);
    } else {
      setIsGoogleLoading(false);
    }
  }, [googleResponse]);

  async function handleGoogleSignIn(idToken: string) {
    setError("");
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.history.replaceState(
        {},
        document.title,
        window.location.pathname + window.location.search
      );
    }
    try {
      await loginWithGoogle(idToken, isLogin ? "login" : "signup");
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err: any) {
      console.error("[GoogleAuth] Sign-in failed:", err);
      const message = err?.message || "Google Sign-In failed. Please try again.";
      setError(message);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } finally {
      setIsGoogleLoading(false);
    }
  }

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

  async function handleAppleSignIn() {
    setError("");
    try {
      await loginWithApple(isLogin ? "login" : "signup");
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err: any) {
      const code = err?.code;
      if (code !== "ERR_REQUEST_CANCELED") {
        const message = err?.message || "Apple Sign-In failed. Please try again.";
        setError(message);
      }
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
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
      {!isLogin ? (
        <Pressable
          onPress={toggleMode}
          style={[styles.backButton, { top: insets.top + 12 }]}
          testID="button-back-to-signin"
        >
          <Feather name="arrow-left" size={24} color={Colors.dark.text} />
        </Pressable>
      ) : null}

      <KeyboardAwareScrollViewCompat
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 40 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoContainer}>
          <View style={styles.logoWrapper}>
            <Image
              source={require("../../assets/images/Logo_Figma.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <ThemedText type="h1" style={styles.title}>
            Beat Haven
          </ThemedText>
          <ThemedText type= "h2"style={styles.subtitle}>
            Your personal meditation sanctuary :)
          </ThemedText>
        </View>

        <View style={styles.form}>
          <Pressable
            onPress={async () => {
              setError("");
              setIsGoogleLoading(true);
              try {
                await googlePromptAsync();
              } catch (err) {
                console.error("[GoogleAuth] promptAsync failed:", err);
                setError("Could not open Google Sign-In. Please try again.");
                setIsGoogleLoading(false);
              }
            }}
            disabled={!googleRequest || isGoogleLoading || googleUnavailableInExpoGo}
            style={[styles.googleButton, (!googleRequest || isGoogleLoading || googleUnavailableInExpoGo) ? styles.googleButtonDisabled : null]}
            testID="button-google-signin"
          >
            {isGoogleLoading ? (
              <ActivityIndicator color="#333" size="small" />
            ) : (
              <>
                <Image
                  source={{ uri: "https://developers.google.com/identity/images/g-logo.png" }}
                  style={styles.googleIcon}
                />
                <ThemedText style={styles.googleButtonText}>
                  {isLogin ? "Continue with Google" : "Create Account with Google"}
                </ThemedText>
              </>
            )}
          </Pressable>
          {googleUnavailableInExpoGo ? (
            <ThemedText style={styles.expoGoNote}>
              Google Sign-In is available in the full app. Use email or Apple Sign-In to continue here.
            </ThemedText>
          ) : null}

          {appleAuthAvailable ? (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={isLogin
                ? AppleAuthentication.AppleAuthenticationButtonType.CONTINUE
                : AppleAuthentication.AppleAuthenticationButtonType.CREATE_ACCOUNT}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
              cornerRadius={BorderRadius.sm}
              style={styles.appleButton}
              onPress={handleAppleSignIn}
              testID="button-apple-signin"
            />
          ) : null}

          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <ThemedText style={styles.dividerText}>or</ThemedText>
            <View style={styles.dividerLine} />
          </View>

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={Colors.dark.textSecondary}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="off"
            testID="input-email"
          />

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.inputWithIcon}
              placeholder="Password"
              placeholderTextColor={Colors.dark.textSecondary}
              value={password}
              onChangeText={(text) => setPassword(text.slice(0, 20))}
              secureTextEntry={!showPassword}
              maxLength={20}
              autoComplete="off"
              testID="input-password"
            />
            <Pressable
              onPress={() => setShowPassword((v) => !v)}
              style={styles.eyeButton}
              testID="button-toggle-password"
            >
              <Feather
                name={showPassword ? "eye-off" : "eye"}
                size={18}
                color={Colors.dark.textSecondary}
              />
            </Pressable>
          </View>

          {!isLogin ? (
            <>
              <PasswordRulesChecklist password={password} />
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.inputWithIcon}
                  placeholder="Confirm Password"
                  placeholderTextColor={Colors.dark.textSecondary}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  maxLength={20}
                  autoComplete="off"
                  testID="input-confirm-password"
                />
                <Pressable
                  onPress={() => setShowConfirmPassword((v) => !v)}
                  style={styles.eyeButton}
                  testID="button-toggle-confirm-password"
                >
                  <Feather
                    name={showConfirmPassword ? "eye-off" : "eye"}
                    size={18}
                    color={Colors.dark.textSecondary}
                  />
                </Pressable>
              </View>
            </>
          ) : null}

          {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

          <Button
            onPress={handleSubmit}
            disabled={isLoading}
            style={styles.button}
            testID="button-submit-auth"
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

        <View style={styles.demoSection}>
          <View style={styles.demoDividerRow}>
            <View style={styles.demoDividerLine} />
            <ThemedText style={styles.demoDividerLabel}>or</ThemedText>
            <View style={styles.demoDividerLine} />
          </View>
          <Pressable
            onPress={async () => {
              setIsDemoLoading(true);
              try {
                await loginAsDemo();
              } catch (err: any) {
                setError(err?.message || "Could not enter demo mode. Please try again.");
              } finally {
                setIsDemoLoading(false);
              }
            }}
            disabled={isDemoLoading}
            style={[styles.demoButton, isDemoLoading ? styles.demoButtonDisabled : null]}
            testID="button-try-demo"
          >
            {isDemoLoading ? (
              <ActivityIndicator color={Colors.dark.accent} size="small" />
            ) : (
              <>
                <Feather name="play-circle" size={18} color={Colors.dark.accent} />
                <ThemedText style={styles.demoButtonText}>Try the App — No sign-up needed</ThemedText>
              </>
            )}
          </Pressable>
          <ThemedText style={styles.demoNote}>
            Demo mode: browse all tracks, create one playlist. Sign up for the full experience.
          </ThemedText>
        </View>

        <ThemedText style={styles.priceInfo}>
          Start your 7-day free trial, then $4.99/month
        </ThemedText>
      </KeyboardAwareScrollViewCompat>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  backButton: {
    position: "absolute",
    left: Spacing.lg,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
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
  logoWrapper: {
    width: 100,
    height: 100,
    borderRadius: 22,
    overflow: "hidden",
    marginBottom: Spacing.lg,
  },
  logo: {
    width: 100,
    height: 100,
    borderRadius: 22,
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
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    height: Spacing.inputHeight,
    backgroundColor: Colors.dark.backgroundDefault,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  inputWithIcon: {
    flex: 1,
    height: "100%",
    paddingHorizontal: Spacing.lg,
    color: Colors.dark.text,
    fontSize: 16,
  },
  eyeButton: {
    paddingHorizontal: Spacing.md,
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
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
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.dark.border,
  },
  dividerText: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
  },
  googleButton: {
    height: Spacing.inputHeight,
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: BorderRadius.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
  },
  googleButtonDisabled: {
    opacity: 0.6,
  },
  googleIcon: {
    width: 20,
    height: 20,
  },
  googleButtonText: {
    color: "#333333",
    fontSize: 16,
    fontWeight: "600" as const,
  },
  expoGoNote: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    textAlign: "center",
    marginTop: -Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  appleButton: {
    height: Spacing.inputHeight,
    width: "100%",
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
  demoSection: {
    marginTop: Spacing["2xl"],
    gap: Spacing.md,
  },
  demoDividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  demoDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.dark.border,
  },
  demoDividerLabel: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
  },
  demoButton: {
    height: Spacing.inputHeight,
    width: "100%",
    borderRadius: BorderRadius.sm,
    borderWidth: 1.5,
    borderColor: Colors.dark.accent,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
    backgroundColor: "rgba(123, 104, 238, 0.08)",
  },
  demoButtonDisabled: {
    opacity: 0.5,
  },
  demoButtonText: {
    color: Colors.dark.accent,
    fontSize: 15,
    fontWeight: "600" as const,
  },
  demoNote: {
    textAlign: "center",
    color: Colors.dark.textSecondary,
    fontSize: 12,
    paddingHorizontal: Spacing.sm,
  },
});
