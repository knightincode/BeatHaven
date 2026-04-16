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
import { useGoogleAuth, isRunningInExpoGo } from "@/services/googleAuth";
import { getApiUrl } from "@/lib/query-client";

type AuthView = "main" | "forgotPassword" | "resetPassword";

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

  const [authState, setAuthState] = useState<{ view: AuthView; serverToken: string }>({
    view: "main",
    serverToken: "",
  });
  const authView = authState.view;
  const serverToken = authState.serverToken;
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showResetConfirmPassword, setShowResetConfirmPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState("");
  const [resetSuccess, setResetSuccess] = useState(false);

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

  function openForgotPassword() {
    setForgotEmail(email);
    setForgotError("");
    setResetCode("");
    setResetPassword("");
    setResetConfirmPassword("");
    setResetSuccess(false);
    setAuthState({ view: "forgotPassword", serverToken: "" });
  }

  async function handleForgotPassword() {
    setForgotError("");
    if (!forgotEmail) {
      setForgotError("Please enter your email address");
      return;
    }
    setForgotLoading(true);
    try {
      const url = new URL("/api/auth/forgot-password", getApiUrl());
      const response = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await response.json();
      if (!response.ok) {
        setForgotError(data.message || "Something went wrong");
        return;
      }
      const token = data.resetToken || "";
      setResetCode(token);
      setAuthState({ view: "resetPassword", serverToken: token });
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      setForgotError("Could not connect to server. Please try again.");
    } finally {
      setForgotLoading(false);
    }
  }

  async function handleResetPassword() {
    setResetError("");
    const code = resetCode.trim().toUpperCase();
    if (!code) {
      setResetError("Please enter the reset code");
      return;
    }
    const pwError = validatePassword(resetPassword);
    if (pwError) {
      setResetError(pwError);
      return;
    }
    if (resetPassword !== resetConfirmPassword) {
      setResetError("Passwords do not match");
      return;
    }
    setResetLoading(true);
    try {
      const url = new URL("/api/auth/reset-password", getApiUrl());
      const response = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: code, newPassword: resetPassword }),
      });
      const data = await response.json();
      if (!response.ok) {
        setResetError(data.message || "Reset failed. Please try again.");
        return;
      }
      setResetSuccess(true);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      setResetError("Could not connect to server. Please try again.");
    } finally {
      setResetLoading(false);
    }
  }

  if (authView === "forgotPassword") {
    return (
      <LinearGradient
        colors={["#0A0E1A", "#1A1F2E", "#252B3D"]}
        style={styles.gradient}
      >
        <Pressable
          onPress={() => setAuthState({ view: "main", serverToken: "" })}
          style={[styles.backButton, { top: insets.top + 12 }]}
          testID="button-back-from-forgot"
        >
          <Feather name="arrow-left" size={24} color={Colors.dark.text} />
        </Pressable>
        <KeyboardAwareScrollViewCompat
          style={styles.container}
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 12 },
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
              Forgot Password
            </ThemedText>
            <ThemedText style={styles.subtitle}>
              Enter your email and we will send you a reset code
            </ThemedText>
          </View>
          <View style={styles.form}>
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor={Colors.dark.textSecondary}
              value={forgotEmail}
              onChangeText={setForgotEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="off"
              testID="input-forgot-email"
            />
            {forgotError.length > 0 ? (
              <ThemedText style={styles.error}>{forgotError}</ThemedText>
            ) : null}
            <Button
              onPress={handleForgotPassword}
              disabled={forgotLoading}
              style={styles.button}
              testID="button-send-reset-code"
            >
              {forgotLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                "Send Reset Code"
              )}
            </Button>
            <Pressable
              onPress={() => setAuthState({ view: "main", serverToken: "" })}
              style={styles.toggleContainer}
              testID="button-back-to-login"
            >
              <ThemedText style={styles.toggleText}>
                {"Remember your password? "}
                <ThemedText type="link" style={styles.toggleLink}>
                  Sign In
                </ThemedText>
              </ThemedText>
            </Pressable>
          </View>
        </KeyboardAwareScrollViewCompat>
      </LinearGradient>
    );
  }

  if (authView === "resetPassword") {
    return (
      <LinearGradient
        colors={["#0A0E1A", "#1A1F2E", "#252B3D"]}
        style={styles.gradient}
      >
        <Pressable
          onPress={() => setAuthState({ view: "forgotPassword", serverToken: "" })}
          style={[styles.backButton, { top: insets.top + 12 }]}
          testID="button-back-from-reset"
        >
          <Feather name="arrow-left" size={24} color={Colors.dark.text} />
        </Pressable>
        <KeyboardAwareScrollViewCompat
          style={styles.container}
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 12 },
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
              Reset Password
            </ThemedText>
            {resetSuccess ? (
              <ThemedText style={styles.subtitle}>
                Your password has been reset successfully
              </ThemedText>
            ) : (
              <ThemedText style={styles.subtitle}>
                Enter the code sent to your email and choose a new password
              </ThemedText>
            )}
          </View>

          {resetSuccess ? (
            <View style={styles.form}>
              <View style={styles.successBox}>
                <Feather name="check-circle" size={32} color={Colors.dark.success} />
                <ThemedText style={styles.successText}>
                  Password updated! You can now sign in with your new password.
                </ThemedText>
              </View>
              <Button
                onPress={() => {
                  setAuthState({ view: "main", serverToken: "" });
                  setIsLogin(true);
                }}
                style={styles.button}
                testID="button-go-to-signin"
              >
                Sign In
              </Button>
            </View>
          ) : (
            <View style={styles.form}>
              {serverToken.length > 0 ? (
                <View style={styles.tokenBox}>
                  <Feather name="lock" size={16} color={Colors.dark.accent} />
                  <ThemedText style={styles.infoBoxText}>
                    Your reset code:{"\n"}
                    <ThemedText style={styles.tokenCode} testID="text-reset-token">{serverToken}</ThemedText>
                  </ThemedText>
                </View>
              ) : (
                <View style={styles.infoBox}>
                  <Feather name="mail" size={16} color={Colors.dark.accent} />
                  <ThemedText style={styles.infoBoxText}>
                    Check your email for the reset code and enter it below.
                  </ThemedText>
                </View>
              )}

              <TextInput
                style={styles.input}
                placeholder="Reset Code"
                placeholderTextColor={Colors.dark.textSecondary}
                value={resetCode}
                onChangeText={(t) => setResetCode(t.toUpperCase())}
                autoCapitalize="characters"
                autoComplete="off"
                testID="input-reset-code"
              />

              <PasswordRulesChecklist password={resetPassword} />

              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.inputWithIcon}
                  placeholder="New Password"
                  placeholderTextColor={Colors.dark.textSecondary}
                  value={resetPassword}
                  onChangeText={(t) => setResetPassword(t.slice(0, 20))}
                  secureTextEntry={!showResetPassword}
                  maxLength={20}
                  autoComplete="off"
                  testID="input-new-password"
                />
                <Pressable
                  onPress={() => setShowResetPassword((v) => !v)}
                  style={styles.eyeButton}
                  testID="button-toggle-new-password"
                >
                  <Feather
                    name={showResetPassword ? "eye-off" : "eye"}
                    size={18}
                    color={Colors.dark.textSecondary}
                  />
                </Pressable>
              </View>

              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.inputWithIcon}
                  placeholder="Confirm New Password"
                  placeholderTextColor={Colors.dark.textSecondary}
                  value={resetConfirmPassword}
                  onChangeText={setResetConfirmPassword}
                  secureTextEntry={!showResetConfirmPassword}
                  maxLength={20}
                  autoComplete="off"
                  testID="input-confirm-new-password"
                />
                <Pressable
                  onPress={() => setShowResetConfirmPassword((v) => !v)}
                  style={styles.eyeButton}
                  testID="button-toggle-confirm-new-password"
                >
                  <Feather
                    name={showResetConfirmPassword ? "eye-off" : "eye"}
                    size={18}
                    color={Colors.dark.textSecondary}
                  />
                </Pressable>
              </View>

              {resetError.length > 0 ? (
                <ThemedText style={styles.error}>{resetError}</ThemedText>
              ) : null}

              <Button
                onPress={handleResetPassword}
                disabled={resetLoading}
                style={styles.button}
                testID="button-confirm-reset-password"
              >
                {resetLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  "Reset Password"
                )}
              </Button>
            </View>
          )}
        </KeyboardAwareScrollViewCompat>
      </LinearGradient>
    );
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
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 12 },
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
          <ThemedText style={styles.subtitle}>
            Your personal meditation sanctuary
          </ThemedText>
        </View>

        {isLogin ? (
          <View style={styles.demoSection}>
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
              Browse all tracks and create a playlist in demo mode
            </ThemedText>
          </View>
        ) : null}

        {isLogin ? (
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <ThemedText style={styles.dividerText}>or sign in</ThemedText>
            <View style={styles.dividerLine} />
          </View>
        ) : null}

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

          <View style={styles.emailDividerContainer}>
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

          {isLogin ? (
            <Pressable
              onPress={openForgotPassword}
              style={styles.toggleContainer}
              testID="button-forgot-password"
            >
              <ThemedText type="link" style={styles.forgotPasswordLink}>
                Forgot password?
              </ThemedText>
            </Pressable>
          ) : null}

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
    marginBottom: Spacing.lg,
  },
  logoWrapper: {
    width: 68,
    height: 68,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: Spacing.sm,
  },
  logo: {
    width: 68,
    height: 68,
    borderRadius: 16,
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.xs,
  },
  subtitle: {
    textAlign: "center",
    color: Colors.dark.textSecondary,
    fontSize: 14,
  },
  demoSection: {
    gap: Spacing.sm,
    marginBottom: Spacing.md,
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
    backgroundColor: "rgba(123, 104, 238, 0.12)",
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
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  emailDividerContainer: {
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
    fontSize: 13,
  },
  form: {
    gap: Spacing.md,
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
    marginTop: Spacing.xs,
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
  },
  toggleText: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
  },
  toggleLink: {
    color: Colors.dark.link,
    fontSize: 14,
  },
  priceInfo: {
    textAlign: "center",
    color: Colors.dark.textSecondary,
    marginTop: Spacing.lg,
    fontSize: 12,
  },
  forgotPasswordLink: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    textDecorationLine: "underline" as const,
  },
  successBox: {
    alignItems: "center" as const,
    gap: Spacing.md,
    padding: Spacing.xl,
    backgroundColor: "rgba(52, 199, 89, 0.1)",
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.dark.success,
  },
  successText: {
    color: Colors.dark.success,
    textAlign: "center" as const,
    fontSize: 15,
  },
  infoBox: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: Spacing.sm,
    backgroundColor: "rgba(123, 104, 238, 0.12)",
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.dark.accent,
    padding: Spacing.md,
  },
  infoBoxText: {
    flex: 1,
    fontSize: 13,
    color: Colors.dark.textSecondary,
    lineHeight: 18,
  },
  tokenBox: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: Spacing.sm,
    backgroundColor: "rgba(123, 104, 238, 0.18)",
    borderRadius: BorderRadius.sm,
    borderWidth: 1.5,
    borderColor: Colors.dark.accent,
    padding: Spacing.md,
  },
  tokenCode: {
    color: Colors.dark.accent,
    fontWeight: "700" as const,
    fontSize: 18,
    letterSpacing: 3,
  },
});
