import { createRemoteJWKSet, jwtVerify } from "jose";

const APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys";
const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID || "com.beathaven.ios";
const EXPO_GO_CLIENT_ID = "host.exp.Exponent";
const VALID_AUDIENCES = [APPLE_CLIENT_ID, EXPO_GO_CLIENT_ID];

const appleJWKS = createRemoteJWKSet(new URL(APPLE_JWKS_URL));

export interface AppleTokenPayload {
  sub: string;
  email?: string;
}

export async function verifyAppleIdentityToken(
  identityToken: string
): Promise<AppleTokenPayload> {
  const { payload } = await jwtVerify(identityToken, appleJWKS, {
    issuer: APPLE_ISSUER,
    audience: VALID_AUDIENCES,
  });

  if (!payload.sub) {
    throw new Error("Apple identity token missing subject");
  }

  return {
    sub: payload.sub as string,
    email: payload.email as string | undefined,
  };
}
