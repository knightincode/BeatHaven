import * as AppleAuthentication from "expo-apple-authentication";
import { Platform } from "react-native";

export interface AppleAuthResult {
  identityToken: string;
  email: string | null;
  fullName: string | null;
}

export async function isAppleAuthAvailable(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  if (Platform.OS === "android") return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function signInWithApple(): Promise<AppleAuthResult> {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  if (!credential.identityToken) {
    throw new Error("Apple Sign-In did not return an identity token");
  }

  const fullName =
    credential.fullName?.givenName && credential.fullName?.familyName
      ? `${credential.fullName.givenName} ${credential.fullName.familyName}`
      : null;

  return {
    identityToken: credential.identityToken,
    email: credential.email,
    fullName,
  };
}

export { AppleAuthentication };
