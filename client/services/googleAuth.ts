import { useAuthRequest, makeRedirectUri } from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";

WebBrowser.maybeCompleteAuthSession();

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || "793408192278-rbno8ju44gflq2o7s6v9efjfpodf8tmi.apps.googleusercontent.com";
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || "";
const ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || "";

const discovery = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  revocationEndpoint: "https://oauth2.googleapis.com/revoke",
};

export function isRunningInExpoGo(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

function getClientId(): string {
  if (Platform.OS === "web") {
    return WEB_CLIENT_ID;
  }

  if (isRunningInExpoGo()) {
    return WEB_CLIENT_ID;
  }

  if (Platform.OS === "ios" && IOS_CLIENT_ID) {
    return IOS_CLIENT_ID;
  }
  if (Platform.OS === "android" && ANDROID_CLIENT_ID) {
    return ANDROID_CLIENT_ID;
  }
  return WEB_CLIENT_ID;
}

function getRedirectUri(): string {
  if (Platform.OS === "web") {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return origin;
  }

  if (isRunningInExpoGo()) {
    const proxyUri = makeRedirectUri({ useProxy: true });
    if (__DEV__) {
      console.log("[GoogleAuth] Expo Go detected — using proxy redirect URI:", proxyUri);
      console.log("[GoogleAuth] Register this URI in Google Cloud Console under Web client authorized redirect URIs.");
    }
    return proxyUri;
  }

  if (Platform.OS === "ios" && IOS_CLIENT_ID) {
    const reversedId = IOS_CLIENT_ID.split(".").reverse().join(".");
    return `${reversedId}:/oauthredirect`;
  }

  return makeRedirectUri({
    scheme: "beathaven",
    path: "auth/google",
  });
}

export function useGoogleAuth() {
  const clientId = getClientId();
  const redirectUri = getRedirectUri();

  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId,
      redirectUri,
      scopes: ["openid", "profile", "email"],
      responseType: "id_token",
      usePKCE: false,
      extraParams: {
        nonce: Date.now().toString(36) + Math.random().toString(36).substring(2),
        prompt: "select_account",
      },
    },
    discovery
  );

  if (__DEV__) {
    console.log("[GoogleAuth] Platform:", Platform.OS);
    console.log("[GoogleAuth] Expo Go:", isRunningInExpoGo());
    console.log("[GoogleAuth] Client ID:", clientId.substring(0, 20) + "...");
    console.log("[GoogleAuth] Redirect URI:", redirectUri);
  }

  return { request, response, promptAsync };
}

export function getGoogleAuthSetupInfo(): { redirectUri: string; clientId: string; platform: string } {
  return {
    redirectUri: getRedirectUri(),
    clientId: getClientId(),
    platform: Platform.OS,
  };
}
