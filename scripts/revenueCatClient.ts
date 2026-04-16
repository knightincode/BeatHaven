import { createClient } from "@replit/revenuecat-sdk";

let connectionSettings: any;

async function fetchConnection(hostname: string, token: string): Promise<any> {
  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set("include_secrets", "true");
  url.searchParams.set("connector_names", "revenuecat");
  const resp = await fetch(url.toString(), {
    headers: { Accept: "application/json", X_REPLIT_TOKEN: token },
  });
  const data = await resp.json();
  return data.items?.[0];
}

export async function getUncachableRevenueCatClient() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!xReplitToken || !hostname) {
    throw new Error(
      "RevenueCat connection unavailable: missing Replit connectors env. Connect the RevenueCat integration from the Integrations panel."
    );
  }

  connectionSettings = await fetchConnection(hostname, xReplitToken);
  if (!connectionSettings) {
    throw new Error("No RevenueCat connection found. Connect the RevenueCat integration from the Integrations panel.");
  }

  const apiKey =
    connectionSettings.settings?.secret_api_key ??
    connectionSettings.settings?.api_key ??
    connectionSettings.settings?.access_token;
  if (!apiKey) {
    throw new Error("RevenueCat connection returned no API key.");
  }

  return createClient({ auth: apiKey as string });
}
