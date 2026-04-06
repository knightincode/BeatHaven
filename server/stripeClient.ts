import Stripe from "stripe";

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!xReplitToken) {
    throw new Error("X_REPLIT_TOKEN not found for repl/depl");
  }

  const connectorName = "stripe";
  const isProduction = process.env.REPLIT_DEPLOYMENT === "1";
  const targetEnvironment = isProduction ? "production" : "development";

  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set("include_secrets", "true");
  url.searchParams.set("connector_names", connectorName);
  url.searchParams.set("environment", targetEnvironment);

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      X_REPLIT_TOKEN: xReplitToken,
    },
  });

  const data = await response.json();

  connectionSettings = data.items?.[0];

  if (
    !connectionSettings ||
    !connectionSettings.settings.publishable ||
    !connectionSettings.settings.secret
  ) {
    if (isProduction) {
      console.warn(
        "[Stripe] WARNING: No production Stripe connection found. Falling back to development connection. " +
        "Configure a production Stripe connection to use live keys.",
      );
      const devUrl = new URL(`https://${hostname}/api/v2/connection`);
      devUrl.searchParams.set("include_secrets", "true");
      devUrl.searchParams.set("connector_names", connectorName);
      devUrl.searchParams.set("environment", "development");

      const devResponse = await fetch(devUrl.toString(), {
        headers: {
          Accept: "application/json",
          X_REPLIT_TOKEN: xReplitToken,
        },
      });

      const devData = await devResponse.json();
      connectionSettings = devData.items?.[0];

      if (
        !connectionSettings ||
        !connectionSettings.settings.publishable ||
        !connectionSettings.settings.secret
      ) {
        throw new Error(
          "Stripe connection not found in either production or development",
        );
      }
    } else {
      throw new Error(`Stripe ${targetEnvironment} connection not found`);
    }
  }

  const publishableKey = connectionSettings.settings.publishable as string;
  const secretKey = connectionSettings.settings.secret as string;

  const isLiveKey = publishableKey.startsWith("pk_live_");
  const isDeployed = process.env.REPLIT_DEPLOYMENT === "1";

  if (isLiveKey) {
    console.log("[Stripe] Mode: LIVE — real charges will be processed");
  } else {
    console.log("[Stripe] Mode: TEST — no real charges");
    if (isDeployed) {
      console.warn(
        "[Stripe] WARNING: Running in LIVE deployment with TEST keys. " +
        "Configure a production Stripe connection with live keys to accept real payments."
      );
    }
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
