import type Stripe from "stripe";
import { getStripeSync, getUncachableStripeClient } from "./stripeClient";
import { storage } from "./storage";

type PlanTier = "monthly" | "yearly" | "lifetime";

function inferPlanFromName(name?: string | null): string | null {
  if (!name) return null;
  const lower = name.toLowerCase();
  if (lower.includes("lifetime")) return "lifetime";
  if (lower.includes("yearly") || lower.includes("annual")) return "yearly";
  if (lower.includes("monthly")) return "monthly";
  return null;
}

function extractCustomerId(obj: Stripe.Event.Data.Object): string | undefined {
  if ("customer" in obj) {
    const c = (obj as { customer: string | Stripe.Customer | null }).customer;
    if (typeof c === "string") return c;
    if (c && "id" in c) return c.id;
  }
  return undefined;
}

async function persistPlanForStripeEvent(payload: Buffer, signature: string): Promise<void> {
  try {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) return;
    const stripe = await getUncachableStripeClient();
    const event = stripe.webhooks.constructEvent(payload, signature, secret);

    const type = event.type;
    const obj = event.data.object;
    const customerId = extractCustomerId(obj);
    if (!customerId) return;

    const user = await storage.getUserByStripeCustomerId(customerId);
    if (!user) return;

    let plan: PlanTier | null = null;
    let mode: "subscription" | "payment" | null = null;
    let subStatus: string | null = null;

    if (type === "checkout.session.completed") {
      const session = obj as Stripe.Checkout.Session;
      mode = session.mode === "payment" ? "payment" : "subscription";
      try {
        const items = await stripe.checkout.sessions.listLineItems(session.id, { limit: 5 });
        for (const li of items.data) {
          const priceProduct = li.price?.product;
          const pname =
            typeof priceProduct === "object" && priceProduct && "name" in priceProduct
              ? priceProduct.name
              : li.description;
          const inferred = inferPlanFromName(pname);
          if (inferred) { plan = inferred as PlanTier; break; }
        }
      } catch {}
      const metaTier = session.metadata?.tier;
      if (!plan && (metaTier === "monthly" || metaTier === "yearly" || metaTier === "lifetime")) {
        plan = metaTier;
      }
    } else if (
      type === "customer.subscription.created" ||
      type === "customer.subscription.updated" ||
      type === "customer.subscription.deleted"
    ) {
      const sub = obj as Stripe.Subscription;
      mode = "subscription";
      subStatus = sub.status;
      const interval = sub.items?.data?.[0]?.price?.recurring?.interval;
      if (interval === "month") plan = "monthly";
      else if (interval === "year") plan = "yearly";
    } else if (type === "invoice.paid") {
      const invoice = obj as Stripe.Invoice;
      mode = "subscription";
      const interval = invoice.lines?.data?.[0]?.price?.recurring?.interval;
      if (interval === "month") plan = "monthly";
      else if (interval === "year") plan = "yearly";
    }

    const activating =
      type === "checkout.session.completed" ||
      type === "invoice.paid" ||
      (type.startsWith("customer.subscription.") &&
        subStatus !== null &&
        ["active", "trialing"].includes(subStatus));

    const deactivating =
      type === "customer.subscription.deleted" ||
      (type === "customer.subscription.updated" &&
        subStatus !== null &&
        ["canceled", "unpaid", "incomplete_expired"].includes(subStatus));

    if (activating && plan) {
      await storage.updateUserStripeInfo(user.id, {
        subscriptionStatus: "active",
        plan,
        subscriptionSource: "stripe",
      });
      console.log("[Stripe Webhook] Plan set:", user.id, plan, "mode:", mode);
    } else if (deactivating) {
      if (user.plan === "lifetime") {
        console.log("[Stripe Webhook] Skip deactivate — user holds lifetime:", user.id);
      } else if (user.subscriptionSource === "revenuecat") {
        console.log("[Stripe Webhook] Skip deactivate — active RevenueCat source:", user.id);
      } else {
        await storage.updateUserStripeInfo(user.id, {
          subscriptionStatus: "inactive",
          plan: "none",
        });
        console.log("[Stripe Webhook] Deactivated:", user.id);
      }
    }
  } catch (err: any) {
    console.error("[Stripe Webhook] Plan persistence skipped:", err?.message ?? err);
  }
}

export class WebhookHandlers {
  static async processWebhook(payload: Buffer, signature: string): Promise<void> {
    if (!Buffer.isBuffer(payload)) {
      throw new Error(
        "STRIPE WEBHOOK ERROR: Payload must be a Buffer. " +
          "Received type: " +
          typeof payload +
          ". " +
          "This usually means express.json() parsed the body before reaching this handler. " +
          "FIX: Ensure webhook route is registered BEFORE app.use(express.json())."
      );
    }

    const sync = await getStripeSync();
    await sync.processWebhook(payload, signature);
    await persistPlanForStripeEvent(payload, signature);
  }
}
