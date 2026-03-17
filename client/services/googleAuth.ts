import { useAuthRequest, makeRedirectUri } from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || "793408192278-rbno8ju44gflq2o7s6v9efjfpodf8tmi.apps.googleusercontent.com";

const discovery = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  revocationEndpoint: "https://oauth2.googleapis.com/revoke",
};

function getRedirectUri(): string {
  if (Platform.OS === "web") {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return origin;
  }
  return makeRedirectUri({
    scheme: "beathaven",
    path: "auth",
  });
}

export function useGoogleAuth() {
  const redirectUri = getRedirectUri();

  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: GOOGLE_CLIENT_ID,
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
    console.log("[GoogleAuth] Redirect URI:", redirectUri);
    console.log("[GoogleAuth] Platform:", Platform.OS);
  }

  return { request, response, promptAsync };
}
