import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { signInWithApple, isAppleAuthAvailable } from "@/services/appleAuth";
import {
  isBiometricAvailable,
  isBiometricEnabled,
  authenticateWithBiometric,
  enableBiometric,
  disableBiometric,
  getBiometricToken,
} from "@/services/biometricAuth";

interface User {
  id: string;
  email: string;
  isAdmin: boolean;
  subscriptionStatus: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  hasActiveSubscription: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  loginWithApple: () => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  showBiometricPrompt: boolean;
  setShowBiometricPrompt: (show: boolean) => void;
  handleEnableBiometric: () => Promise<void>;
  handleSkipBiometric: () => void;
  appleAuthAvailable: boolean;
  showSubscriptionOffer: boolean;
  setShowSubscriptionOffer: (show: boolean) => void;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
  const [showSubscriptionOffer, setShowSubscriptionOffer] = useState(false);
  const [appleAuthAvailable, setAppleAuthAvailable] = useState(false);

  useEffect(() => {
    loadStoredAuth();
    checkAppleAuth();
  }, []);

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
          return;
        }
      }

      const storedToken = await getStoredToken();
      if (storedToken) {
        setToken(storedToken);
        await fetchUser(storedToken);
      }
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

    const biometricAvail = await isBiometricAvailable();
    const biometricAlreadyEnabled = await isBiometricEnabled();
    if (biometricAlreadyEnabled && biometricAvail) {
      await enableBiometric(authToken);
    } else if (biometricAvail && !biometricAlreadyEnabled) {
      setShowBiometricPrompt(true);
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

  async function loginWithApple() {
    const appleResult = await signInWithApple();
    const res = await apiRequest("POST", "/api/auth/apple", {
      identityToken: appleResult.identityToken,
      email: appleResult.email,
      fullName: appleResult.fullName,
    });
    const data = await res.json();
    await handleAuthSuccess(data.token, data.user);
    if (data.isNewUser && data.user.subscriptionStatus !== "active") {
      setShowSubscriptionOffer(true);
    }
  }

  async function logout() {
    await removeStoredToken();
    await disableBiometric();
    setToken(null);
    setUser(null);
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

  function handleSkipBiometric() {
    setShowBiometricPrompt(false);
  }

  const isAuthenticated = !!user;
  const isAdmin = user?.isAdmin === true;
  const hasActiveSubscription = user?.subscriptionStatus === "active";

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated,
        isAdmin,
        hasActiveSubscription,
        login,
        register,
        loginWithApple,
        logout,
        refreshUser,
        showBiometricPrompt,
        setShowBiometricPrompt,
        handleEnableBiometric,
        handleSkipBiometric,
        appleAuthAvailable,
        showSubscriptionOffer,
        setShowSubscriptionOffer,
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
