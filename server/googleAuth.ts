import { createRemoteJWKSet, jwtVerify } from "jose";

const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

const WEB_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "793408192278-rbno8ju44gflq2o7s6v9efjfpodf8tmi.apps.googleusercontent.com";
const IOS_CLIENT_ID = process.env.GOOGLE_IOS_CLIENT_ID || "";
const ANDROID_CLIENT_ID = process.env.GOOGLE_ANDROID_CLIENT_ID || "";

function getValidAudiences(): string[] {
  const audiences = [WEB_CLIENT_ID];
  if (IOS_CLIENT_ID) audiences.push(IOS_CLIENT_ID);
  if (ANDROID_CLIENT_ID) audiences.push(ANDROID_CLIENT_ID);
  return audiences;
}

const googleJWKS = createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));

export interface GoogleTokenPayload {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
}

export async function verifyGoogleIdToken(
  idToken: string
): Promise<GoogleTokenPayload> {
  const validAudiences = getValidAudiences();

  let lastError: Error | null = null;
  for (const audience of validAudiences) {
    try {
      const { payload } = await jwtVerify(idToken, googleJWKS, {
        audience,
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
        email_verified: payload.email_verified as boolean | undefined,
        name: payload.name as string | undefined,
      };
    } catch (err) {
      lastError = err as Error;
    }
  }

  throw lastError || new Error("Google ID token verification failed");
}
