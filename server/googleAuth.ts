import { createRemoteJWKSet, jwtVerify } from "jose";

const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "793408192278-rbno8ju44gflq2o7s6v9efjfpodf8tmi.apps.googleusercontent.com";

const googleJWKS = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));

export interface GoogleTokenPayload {
  sub: string;
  email?: string;
  name?: string;
}

export async function verifyGoogleIdToken(
  idToken: string
): Promise<GoogleTokenPayload> {
  const { payload } = await jwtVerify(idToken, googleJWKS, {
    audience: GOOGLE_CLIENT_ID,
  });

  const issuer = payload.iss as string;
  if (!GOOGLE_ISSUERS.includes(issuer)) {
    throw new Error(`Invalid Google token issuer: ${issuer}`);
  }

  if (!payload.sub) {
    throw new Error("Google ID token missing subject");
  }

  return {
    sub: payload.sub as string,
    email: payload.email as string | undefined,
    name: payload.name as string | undefined,
  };
}
