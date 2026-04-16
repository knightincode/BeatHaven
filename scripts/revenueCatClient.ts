import { createClient } from "@replit/revenuecat-sdk/client";

type ConnectorConnection = {
  settings?: {
    expires_at?: string;
    access_token?: string;
    oauth?: { credentials?: { access_token?: string } };
  };
};

let connectionSettings: ConnectorConnection | undefined;

function extractAccessToken(conn: ConnectorConnection | undefined): string | undefined {
  return (
    conn?.settings?.access_token ??
    conn?.settings?.oauth?.credentials?.access_token
  );
}

async function getApiKey(): Promise<string> {
  const cachedToken = extractAccessToken(connectionSettings);
  if (
    cachedToken &&
    connectionSettings?.settings?.expires_at &&
    new Date(connectionSettings.settings.expires_at).getTime() > Date.now()
  ) {
    return cachedToken;
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!xReplitToken || !hostname) {
    throw new Error(
      "RevenueCat connection unavailable: missing Replit connectors env."
    );
  }

  connectionSettings = await fetch(
    "https://" + hostname + "/api/v2/connection?include_secrets=true&connector_names=revenuecat",
    { headers: { Accept: "application/json", "X-Replit-Token": xReplitToken } }
  )
    .then((r) => r.json())
    .then((d) => d.items?.[0]);

  const accessToken =
    connectionSettings?.settings?.access_token ||
    connectionSettings?.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error("RevenueCat not connected");
  }
  return accessToken;
}

export async function getUncachableRevenueCatClient() {
  const apiKey = await getApiKey();
  return createClient({
    baseUrl: "https://api.revenuecat.com/v2",
    headers: { Authorization: "Bearer " + apiKey },
  });
}
