import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const BIOMETRIC_ENABLED_KEY = "biometric_login_enabled";
const BIOMETRIC_USER_TOKEN_KEY = "biometric_user_token";

export async function isBiometricAvailable(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return false;
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    return isEnrolled;
  } catch {
    return false;
  }
}

export async function getBiometricType(): Promise<string> {
  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return "Face ID";
    }
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return "Touch ID";
    }
    return "Biometric";
  } catch {
    return "Biometric";
  }
}

export async function authenticateWithBiometric(): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Authenticate to sign in",
      cancelLabel: "Cancel",
      disableDeviceFallback: false,
    });
    return result.success;
  } catch {
    return false;
  }
}

export async function isBiometricEnabled(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    const value = await SecureStore.getItemAsync(BIOMETRIC_ENABLED_KEY);
    return value === "true";
  } catch {
    return false;
  }
}

export async function enableBiometric(token: string): Promise<void> {
  await SecureStore.setItemAsync(BIOMETRIC_ENABLED_KEY, "true");
  await SecureStore.setItemAsync(BIOMETRIC_USER_TOKEN_KEY, token);
}

export async function disableBiometric(): Promise<void> {
  await SecureStore.deleteItemAsync(BIOMETRIC_ENABLED_KEY);
  await SecureStore.deleteItemAsync(BIOMETRIC_USER_TOKEN_KEY);
}

export async function getBiometricToken(): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try {
    return await SecureStore.getItemAsync(BIOMETRIC_USER_TOKEN_KEY);
  } catch {
    return null;
  }
}
