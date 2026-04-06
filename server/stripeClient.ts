import Stripe from "stripe";

let connectionSettings: any;

async function fetchConnectorConnection(hostname: string, token: string, environment: string): Promise<any | null> {
  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set("include_secrets", "true");
  url.searchParams.set("connector_names", "stripe");
  url.searchParams.set("environment", environment);

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      X_REPLIT_TOKEN: token,
    },
  });

  const data = await response.json();
  const conn = data.items?.[0];

  if (
    conn &&
    conn.settings?.publishable &&
    conn.settings?.secret
  ) {
    return conn;
  }
  return null;
}

async function getCredentials() {
  const publishableEnv = process.env.STRIPE_PUBLISHABLE_KEY;
  const secretEnv = process.env.STRIPE_SECRET_KEY;

  if (publishableEnv && secretEnv) {
    const isLive = publishableEnv.startsWith("pk_live_");
    if (isLive) {
      console.log("[Stripe] Mode: LIVE — real charges will be processed");
    } else {
      console.log("[Stripe] Mode: TEST — no real charges");
      console.warn(
        "[Stripe] WARNING: Using test keys. Update STRIPE_PUBLISHABLE_KEY and STRIPE_SECRET_KEY to live keys to accept real payments."
      );
    }
    return { publishableKey: publishableEnv, secretKey: secretEnv };
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!xReplitToken || !hostname) {
    throw new Error("No Stripe credentials found. Set STRIPE_PUBLISHABLE_KEY and STRIPE_SECRET_KEY secrets.");
  }

  connectionSettings =
    (await fetchConnectorConnection(hostname, xReplitToken, "production")) ??
    (await fetchConnectorConnection(hostname, xReplitToken, "development"));

  if (!connectionSettings) {
    throw new Error("No Stripe connection found. Set STRIPE_PUBLISHABLE_KEY and STRIPE_SECRET_KEY secrets or configure a Stripe connector.");
  }

  const publishableKey = connectionSettings.settings.publishable as string;
  const secretKey = connectionSettings.settings.secret as string;

  const isLiveKey = publishableKey.startsWith("pk_live_");

  if (isLiveKey) {
    console.log("[Stripe] Mode: LIVE — real charges will be processed");
  } else {
    console.log("[Stripe] Mode: TEST — no real charges");
    console.warn(
      "[Stripe] WARNING: Using test keys. Switch to live keys to accept real payments."
    );
  }

  return { publishableKey, secretKey };
}

export async function getUncachableStripeClient() {
  const { secretKey } = await getCredentials();

  return new Stripe(secretKey, {
    apiVersion: "2025-08-27.basil",
  });
}

export async function getStripePublishableKey() {
  const { publishableKey } = await getCredentials();
  return publishableKey;
}

export async function getStripeSecretKey() {
  const { secretKey } = await getCredentials();
  return secretKey;
}

let stripeSync: any = null;

export async function getStripeSync() {
  if (!stripeSync) {
    const { StripeSync } = await import("stripe-replit-sync");
    const secretKey = await getStripeSecretKey();

    stripeSync = new StripeSync({
      poolConfig: {
        connectionString: process.env.DATABASE_URL!,
        max: 2,
      },
      stripeSecretKey: secretKey,
    });
  }
  return stripeSync;
}
