import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { useSubscription, identifyRevenueCatUser, resetRevenueCatUser } from "@/lib/revenuecat";
import { signInWithApple, isAppleAuthAvailable } from "@/services/appleAuth";
import {
  isBiometricAvailable,
  isBiometricEnabled,
  isBiometricDeclined,
  declineBiometric,
  authenticateWithBiometric,
  enableBiometric,
  disableBiometric,
  getBiometricToken,
} from "@/services/biometricAuth";

interface User {
  id: string;
  email: string;
  isAdmin: boolean;
  isDemo: boolean;
  subscriptionStatus: string;
  plan?: string | null;
  subscriptionSource?: string | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isDemo: boolean;
  demoSessionId: string | null;
  hasActiveSubscription: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  loginAsDemo: () => Promise<void>;
  logoutToSignup: () => Promise<void>;
  loginWithApple: (mode?: "login" | "signup") => Promise<void>;
  loginWithGoogle: (idToken: string, mode?: "login" | "signup") => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  showBiometricPrompt: boolean;
  setShowBiometricPrompt: (show: boolean) => void;
  handleEnableBiometric: () => Promise<void>;
  handleSkipBiometric: () => void;
  appleAuthAvailable: boolean;
  showSubscriptionOffer: boolean;
  setShowSubscriptionOffer: (show: boolean) => void;
  pendingAuthMode: "signin" | "signup" | null;
  clearPendingAuthMode: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = "auth_token";

async function getStoredToken(): Promise<string | null> {
  if (Platform.OS === "web") {
    return localStorage.getItem(TOKEN_KEY);
  }
  return await SecureStore.getItemAsync(TOKEN_KEY);
}

async function setStoredToken(token: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  }
}

async function removeStoredToken(): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.removeItem(TOKEN_KEY);
  } else {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
}

const DEMO_SESSION_KEY = "demo_session_id";

async function getStoredDemoSessionId(): Promise<string | null> {
  if (Platform.OS === "web") {
    return localStorage.getItem(DEMO_SESSION_KEY);
  }
  return await SecureStore.getItemAsync(DEMO_SESSION_KEY);
}

async function setStoredDemoSessionId(id: string): Promise<void> {
  if (Platform.OS === "web") {
    localStorage.setItem(DEMO_SESSION_KEY, id);
  } else {
    await SecureStore.setItemAsync(DEMO_SESSION_KEY, id);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [demoSessionId, setDemoSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
  const [showSubscriptionOffer, setShowSubscriptionOffer] = useState(false);
  const [appleAuthAvailable, setAppleAuthAvailable] = useState(false);
  const [pendingAuthMode, setPendingAuthMode] = useState<"signin" | "signup" | null>(null);

  useEffect(() => {
    loadStoredAuth();
    checkAppleAuth();
  }, []);

  useEffect(() => {
    if (Platform.OS === "web" && token) {
      const params = new URLSearchParams(window.location.search);
      if (params.get("checkout") === "success") {
        const url = new URL(window.location.href);
        url.searchParams.delete("checkout");
        window.history.replaceState({}, "", url.toString());

        const baseUrl = getApiUrl();
        const syncAndRefresh = async (attempt: number) => {
          try {
            const res = await fetch(`${baseUrl}api/sync-subscription`, {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            await fetchUser(token);
            if (data.subscriptionStatus !== "active" && attempt < 3) {
              setTimeout(() => syncAndRefresh(attempt + 1), 2000);
            }
          } catch (e) {
            console.warn("Subscription sync attempt failed:", e);
            await fetchUser(token);
            if (attempt < 3) {
              setTimeout(() => syncAndRefresh(attempt + 1), 2000);
            }
          }
        };
        syncAndRefresh(1);
      }
    }
  }, [token]);

  async function checkAppleAuth() {
    const available = await isAppleAuthAvailable();
    setAppleAuthAvailable(available);
  }

  async function loadStoredAuth() {
    try {
      const biometricEnabled = await isBiometricEnabled();
      const biometricAvail = await isBiometricAvailable();

      if (biometricEnabled && biometricAvail) {
        const storedBioToken = await getBiometricToken();
        if (storedBioToken) {
          const success = await authenticateWithBiometric();
          if (success) {
            setToken(storedBioToken);
            await setStoredToken(storedBioToken);
            const userFetched = await fetchUser(storedBioToken);
            if (!userFetched) {
              await disableBiometric();
              await removeStoredToken();
              setToken(null);
            }
          }
          const existingSessionId = await getStoredDemoSessionId();
          if (existingSessionId) setDemoSessionId(existingSessionId);
          return;
        }
      }

      const storedToken = await getStoredToken();
      if (storedToken) {
        setToken(storedToken);
        await fetchUser(storedToken);
      }

      const existingSessionId = await getStoredDemoSessionId();
      if (existingSessionId) setDemoSessionId(existingSessionId);
    } catch (error) {
      console.error("Failed to load stored auth:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchUser(authToken: string): Promise<boolean> {
    try {
      const baseUrl = getApiUrl();
      const url = new URL("/api/user", baseUrl);
      const res = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
        if (!userData.isDemo) {
          identifyRevenueCatUser(userData.id).catch(() => {});
        }
        return true;
      } else {
        await removeStoredToken();
        setToken(null);
        setUser(null);
        return false;
      }
    } catch (error) {
      console.error("Failed to fetch user:", error);
      return false;
    }
  }

  async function handleAuthSuccess(authToken: string, userData: User) {
    await setStoredToken(authToken);
    setToken(authToken);
    setUser(userData);

    if (!userData.isDemo) {
      identifyRevenueCatUser(userData.id).catch(() => {});
    }

    if (userData.isDemo) return;

    const biometricAvail = await isBiometricAvailable();
    const biometricAlreadyEnabled = await isBiometricEnabled();
    if (biometricAlreadyEnabled && biometricAvail) {
      await enableBiometric(authToken);
    } else if (biometricAvail && !biometricAlreadyEnabled) {
      const declined = await isBiometricDeclined();
      if (!declined) {
        setShowBiometricPrompt(true);
      }
    }
  }

  async function login(email: string, password: string) {
    const res = await apiRequest("POST", "/api/auth/login", { email, password });
    const data = await res.json();
    await handleAuthSuccess(data.token, data.user);
  }

  async function register(email: string, password: string) {
    const res = await apiRequest("POST", "/api/auth/register", { email, password });
    const data = await res.json();
    await handleAuthSuccess(data.token, data.user);
  }

  async function loginWithApple(mode?: "login" | "signup") {
    const appleResult = await signInWithApple();
    const res = await apiRequest("POST", "/api/auth/apple", {
      identityToken: appleResult.identityToken,
      email: appleResult.email,
      fullName: appleResult.fullName,
      mode: mode ?? "login",
    });
    const data = await res.json();
    await handleAuthSuccess(data.token, data.user);
    if (data.isNewUser && data.user.subscriptionStatus !== "active") {
      setShowSubscriptionOffer(true);
    }
  }

  async function loginWithGoogle(idToken: string, mode?: "login" | "signup") {
    const res = await apiRequest("POST", "/api/auth/google", { idToken, mode: mode ?? "login" });
    const data = await res.json();
    await handleAuthSuccess(data.token, data.user);
    if (data.isNewUser && data.user.subscriptionStatus !== "active") {
      setShowSubscriptionOffer(true);
    }
  }

  async function loginAsDemo() {
    const res = await apiRequest("POST", "/api/auth/demo", {});
    const data = await res.json();

    let sessionId = await getStoredDemoSessionId();
    if (!sessionId) {
      sessionId = Crypto.randomUUID();
      await setStoredDemoSessionId(sessionId);
    }
    setDemoSessionId(sessionId);

    await handleAuthSuccess(data.token, data.user);
  }

  async function logout() {
    await removeStoredToken();
    try {
      await disableBiometric();
    } catch (err) {
      console.warn("Failed to clear biometric data on logout:", err);
    }
    resetRevenueCatUser().catch(() => {});
    setToken(null);
    setUser(null);
  }

  async function logoutToSignup() {
    setPendingAuthMode("signup");
    await logout();
  }

  function clearPendingAuthMode() {
    setPendingAuthMode(null);
  }

  async function refreshUser() {
    if (token) {
      await fetchUser(token);
    }
  }

  async function handleEnableBiometric() {
    if (token) {
      const success = await authenticateWithBiometric();
      if (success) {
        await enableBiometric(token);
      }
    }
    setShowBiometricPrompt(false);
  }

  async function handleSkipBiometric() {
    setShowBiometricPrompt(false);
    await declineBiometric();
  }

  const subscription = useSubscription();
  const isAuthenticated = !!user;
  const isAdmin = user?.isAdmin === true;
  const isDemo = user?.isDemo === true;
  const hasActiveSubscription =
    user?.subscriptionStatus === "active" || subscription.isSubscribed === true;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated,
        isAdmin,
        isDemo,
        demoSessionId,
        hasActiveSubscription,
        login,
        register,
        loginAsDemo,
        logoutToSignup,
        loginWithApple,
        loginWithGoogle,
        logout,
        refreshUser,
        showBiometricPrompt,
        setShowBiometricPrompt,
        handleEnableBiometric,
        handleSkipBiometric,
        appleAuthAvailable,
        showSubscriptionOffer,
        setShowSubscriptionOffer,
        pendingAuthMode,
        clearPendingAuthMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
