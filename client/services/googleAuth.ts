import { useAuthRequest, makeRedirectUri } from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || "793408192278-rbno8ju44gflq2o7s6v9efjfpodf8tmi.apps.googleusercontent.com";

const discovery = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  revocationEndpoint: "https://oauth2.googleapis.com/revoke",
};

export function useGoogleAuth() {
  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: GOOGLE_CLIENT_ID,
      redirectUri: makeRedirectUri({ preferLocalhost: false }),
      scopes: ["openid", "profile", "email"],
      responseType: "id_token",
      usePKCE: false,
      extraParams: {
        nonce: Math.random().toString(36).substring(2),
      },
    },
    discovery
  );

  return { request, response, promptAsync };
}
