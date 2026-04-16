import { getUncachableRevenueCatClient } from "./revenueCatClient";

import {
  listProjects,
  createProject,
  listApps,
  createApp,
  listAppPublicApiKeys,
  listProducts,
  createProduct,
  listEntitlements,
  createEntitlement,
  attachProductsToEntitlement,
  listOfferings,
  createOffering,
  updateOffering,
  listPackages,
  createPackages,
  attachProductsToPackage,
  type App,
  type Product,
  type Project,
  type Entitlement,
  type Offering,
  type CreateProductData,
} from "@replit/revenuecat-sdk";

const PROJECT_NAME = "Beat Haven";

const APP_STORE_APP_NAME = "Beat Haven iOS";
const APP_STORE_BUNDLE_ID = "com.beathaven.app";
const PLAY_STORE_APP_NAME = "Beat Haven Android";
const PLAY_STORE_PACKAGE_NAME = "com.beathaven.app";

const ENTITLEMENT_IDENTIFIER = "premium";
const ENTITLEMENT_DISPLAY_NAME = "Premium Access";

const OFFERING_IDENTIFIER = "default";
const OFFERING_DISPLAY_NAME = "Beat Haven Plans";

type TierConfig = {
  label: string;
  productIdentifier: string;
  playStoreIdentifier: string;
  displayName: string;
  userFacingTitle: string;
  productType: "subscription" | "non_subscription";
  duration?: "P1W" | "P1M" | "P2M" | "P3M" | "P6M" | "P1Y";
  priceMicros: number;
  packageIdentifier: string;
  packageDisplayName: string;
};

const TIERS: TierConfig[] = [
  {
    label: "Monthly",
    productIdentifier: "premium_monthly",
    playStoreIdentifier: "premium_monthly:monthly",
    displayName: "Premium Monthly",
    userFacingTitle: "Premium Monthly",
    productType: "subscription",
    duration: "P1M",
    priceMicros: 4_990_000,
    packageIdentifier: "$rc_monthly",
    packageDisplayName: "Monthly Subscription",
  },
  {
    label: "Yearly",
    productIdentifier: "premium_yearly",
    playStoreIdentifier: "premium_yearly:yearly",
    displayName: "Premium Yearly",
    userFacingTitle: "Premium Yearly",
    productType: "subscription",
    duration: "P1Y",
    priceMicros: 39_990_000,
    packageIdentifier: "$rc_annual",
    packageDisplayName: "Yearly Subscription",
  },
  {
    label: "Lifetime",
    productIdentifier: "premium_lifetime",
    playStoreIdentifier: "premium_lifetime",
    displayName: "Premium Lifetime",
    userFacingTitle: "Premium Lifetime",
    productType: "non_subscription",
    priceMicros: 99_990_000,
    packageIdentifier: "$rc_lifetime",
    packageDisplayName: "Lifetime Access",
  },
];

type TestStorePricesResponse = {
  object: string;
  prices: { amount_micros: number; currency: string }[];
};

async function seedRevenueCat() {
  const client = await getUncachableRevenueCatClient();

  let project: Project;
  const { data: existingProjects, error: listProjectsError } = await listProjects({
    client,
    query: { limit: 20 },
  });
  if (listProjectsError) throw new Error("Failed to list projects");

  const existingProject = existingProjects.items?.find((p) => p.name === PROJECT_NAME);
  if (existingProject) {
    console.log("Project already exists:", existingProject.id);
    project = existingProject;
  } else {
    const { data: newProject, error } = await createProject({
      client,
      body: { name: PROJECT_NAME },
    });
    if (error) throw new Error("Failed to create project");
    console.log("Created project:", newProject.id);
    project = newProject;
  }

  const { data: apps, error: listAppsError } = await listApps({
    client,
    path: { project_id: project.id },
    query: { limit: 20 },
  });
  if (listAppsError || !apps || apps.items.length === 0) {
    throw new Error("No apps found");
  }

  let testApp: App | undefined = apps.items.find((a) => a.type === "test_store");
  let appStoreApp: App | undefined = apps.items.find((a) => a.type === "app_store");
  let playStoreApp: App | undefined = apps.items.find((a) => a.type === "play_store");

  if (!testApp) throw new Error("No test store app found");
  console.log("Test Store app found:", testApp.id);

  if (!appStoreApp) {
    const { data, error } = await createApp({
      client,
      path: { project_id: project.id },
      body: {
        name: APP_STORE_APP_NAME,
        type: "app_store",
        app_store: { bundle_id: APP_STORE_BUNDLE_ID },
      },
    });
    if (error) throw new Error("Failed to create App Store app");
    appStoreApp = data;
    console.log("Created App Store app:", appStoreApp.id);
  } else {
    console.log("App Store app found:", appStoreApp.id);
  }

  if (!playStoreApp) {
    const { data, error } = await createApp({
      client,
      path: { project_id: project.id },
      body: {
        name: PLAY_STORE_APP_NAME,
        type: "play_store",
        play_store: { package_name: PLAY_STORE_PACKAGE_NAME },
      },
    });
    if (error) throw new Error("Failed to create Play Store app");
    playStoreApp = data;
    console.log("Created Play Store app:", playStoreApp.id);
  } else {
    console.log("Play Store app found:", playStoreApp.id);
  }

  const { data: existingProducts, error: listProductsError } = await listProducts({
    client,
    path: { project_id: project.id },
    query: { limit: 100 },
  });
  if (listProductsError) throw new Error("Failed to list products");

  const ensureProduct = async (
    targetApp: App,
    label: string,
    productIdentifier: string,
    isTestStore: boolean,
    tier: TierConfig
  ): Promise<Product> => {
    const existing = existingProducts.items?.find(
      (p) => p.store_identifier === productIdentifier && p.app_id === targetApp.id
    );
    if (existing) {
      console.log(`[${tier.label}] ${label} product already exists:`, existing.id);
      return existing;
    }

    const body: CreateProductData["body"] = {
      store_identifier: productIdentifier,
      app_id: targetApp.id,
      type: tier.productType,
      display_name: tier.displayName,
    };
    if (isTestStore) {
      body.title = tier.userFacingTitle;
      if (tier.productType === "subscription" && tier.duration) {
        body.subscription = { duration: tier.duration };
      }
    }

    const { data, error } = await createProduct({
      client,
      path: { project_id: project.id },
      body,
    });
    if (error) throw new Error(`Failed to create ${label} product for ${tier.label}: ${JSON.stringify(error)}`);
    console.log(`[${tier.label}] Created ${label} product:`, data.id);
    return data;
  };

  const tierProducts: Record<string, { test: Product; ios: Product; android: Product }> = {};

  for (const tier of TIERS) {
    const testProd = await ensureProduct(testApp, "Test Store", tier.productIdentifier, true, tier);
    const iosProd = await ensureProduct(appStoreApp, "App Store", tier.productIdentifier, false, tier);
    const androidProd = await ensureProduct(playStoreApp, "Play Store", tier.playStoreIdentifier, false, tier);
    tierProducts[tier.label] = { test: testProd, ios: iosProd, android: androidProd };

    console.log(`[${tier.label}] Adding test store price $${tier.priceMicros / 1_000_000}`);
    const { error: priceError } = await client.post<TestStorePricesResponse>({
      url: "/projects/{project_id}/products/{product_id}/test_store_prices",
      path: { project_id: project.id, product_id: testProd.id },
      body: { prices: [{ amount_micros: tier.priceMicros, currency: "USD" }] },
    });
    if (priceError) {
      if (typeof priceError === "object" && "type" in priceError && priceError.type === "resource_already_exists") {
        console.log(`[${tier.label}] Test store price already set`);
      } else {
        throw new Error(`Failed to set test price for ${tier.label}: ${JSON.stringify(priceError)}`);
      }
    } else {
      console.log(`[${tier.label}] Test store price set`);
    }
  }

  let entitlement: Entitlement;
  const { data: existingEntitlements, error: listEntError } = await listEntitlements({
    client,
    path: { project_id: project.id },
    query: { limit: 20 },
  });
  if (listEntError) throw new Error("Failed to list entitlements");

  const foundEnt = existingEntitlements.items?.find((e) => e.lookup_key === ENTITLEMENT_IDENTIFIER);
  if (foundEnt) {
    console.log("Entitlement already exists:", foundEnt.id);
    entitlement = foundEnt;
  } else {
    const { data, error } = await createEntitlement({
      client,
      path: { project_id: project.id },
      body: { lookup_key: ENTITLEMENT_IDENTIFIER, display_name: ENTITLEMENT_DISPLAY_NAME },
    });
    if (error) throw new Error("Failed to create entitlement");
    console.log("Created entitlement:", data.id);
    entitlement = data;
  }

  const allProductIds = Object.values(tierProducts).flatMap((p) => [p.test.id, p.ios.id, p.android.id]);
  const { error: attachEntErr } = await attachProductsToEntitlement({
    client,
    path: { project_id: project.id, entitlement_id: entitlement.id },
    body: { product_ids: allProductIds },
  });
  if (attachEntErr) {
    if (attachEntErr.type === "unprocessable_entity_error") {
      console.log("Products already attached to entitlement");
    } else {
      throw new Error(`Failed to attach products to entitlement: ${JSON.stringify(attachEntErr)}`);
    }
  } else {
    console.log("Attached all products to entitlement");
  }

  let offering: Offering;
  const { data: existingOfferings, error: listOffErr } = await listOfferings({
    client,
    path: { project_id: project.id },
    query: { limit: 20 },
  });
  if (listOffErr) throw new Error("Failed to list offerings");

  const foundOff = existingOfferings.items?.find((o) => o.lookup_key === OFFERING_IDENTIFIER);
  if (foundOff) {
    console.log("Offering already exists:", foundOff.id);
    offering = foundOff;
  } else {
    const { data, error } = await createOffering({
      client,
      path: { project_id: project.id },
      body: { lookup_key: OFFERING_IDENTIFIER, display_name: OFFERING_DISPLAY_NAME },
    });
    if (error) throw new Error("Failed to create offering");
    console.log("Created offering:", data.id);
    offering = data;
  }

  if (!offering.is_current) {
    const { error } = await updateOffering({
      client,
      path: { project_id: project.id, offering_id: offering.id },
      body: { is_current: true },
    });
    if (error) throw new Error("Failed to set offering current");
    console.log("Set offering as current");
  }

  const { data: existingPackages, error: listPkgErr } = await listPackages({
    client,
    path: { project_id: project.id, offering_id: offering.id },
    query: { limit: 20 },
  });
  if (listPkgErr) throw new Error("Failed to list packages");

  for (const tier of TIERS) {
    const products = tierProducts[tier.label];
    const existingPkg = existingPackages.items?.find((p) => p.lookup_key === tier.packageIdentifier);
    let pkgId: string;
    if (existingPkg) {
      console.log(`[${tier.label}] Package already exists:`, existingPkg.id);
      pkgId = existingPkg.id;
    } else {
      const { data, error } = await createPackages({
        client,
        path: { project_id: project.id, offering_id: offering.id },
        body: { lookup_key: tier.packageIdentifier, display_name: tier.packageDisplayName },
      });
      if (error) throw new Error(`Failed to create package ${tier.label}`);
      console.log(`[${tier.label}] Created package:`, data.id);
      pkgId = data.id;
    }

    const { error: attachErr } = await attachProductsToPackage({
      client,
      path: { project_id: project.id, package_id: pkgId },
      body: {
        products: [
          { product_id: products.test.id, eligibility_criteria: "all" },
          { product_id: products.ios.id, eligibility_criteria: "all" },
          { product_id: products.android.id, eligibility_criteria: "all" },
        ],
      },
    });
    if (attachErr) {
      if (
        attachErr.type === "unprocessable_entity_error" &&
        attachErr.message?.includes("Cannot attach product")
      ) {
        console.log(`[${tier.label}] Package already has products attached`);
      } else {
        throw new Error(`Failed to attach products to ${tier.label} package: ${JSON.stringify(attachErr)}`);
      }
    } else {
      console.log(`[${tier.label}] Attached products to package`);
    }
  }

  const { data: testKeys } = await listAppPublicApiKeys({
    client,
    path: { project_id: project.id, app_id: testApp.id },
  });
  const { data: iosKeys } = await listAppPublicApiKeys({
    client,
    path: { project_id: project.id, app_id: appStoreApp.id },
  });
  const { data: androidKeys } = await listAppPublicApiKeys({
    client,
    path: { project_id: project.id, app_id: playStoreApp.id },
  });

  console.log("\n==============================");
  console.log("RevenueCat setup complete!");
  console.log("==============================");
  console.log("Set these environment variables:\n");
  console.log("REVENUECAT_PROJECT_ID=" + project.id);
  console.log("REVENUECAT_TEST_STORE_APP_ID=" + testApp.id);
  console.log("REVENUECAT_APPLE_APP_STORE_APP_ID=" + appStoreApp.id);
  console.log("REVENUECAT_GOOGLE_PLAY_STORE_APP_ID=" + playStoreApp.id);
  console.log("EXPO_PUBLIC_REVENUECAT_TEST_API_KEY=" + (testKeys?.items[0]?.key ?? "N/A"));
  console.log("EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=" + (iosKeys?.items[0]?.key ?? "N/A"));
  console.log("EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=" + (androidKeys?.items[0]?.key ?? "N/A"));
  console.log("==============================\n");
}

seedRevenueCat().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
