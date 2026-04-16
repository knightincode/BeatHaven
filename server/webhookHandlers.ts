import { getStripeSync, getUncachableStripeClient } from "./stripeClient";
import { storage } from "./storage";

function inferPlanFromName(name?: string | null): string | null {
  if (!name) return null;
  const lower = name.toLowerCase();
  if (lower.includes("lifetime")) return "lifetime";
  if (lower.includes("yearly") || lower.includes("annual")) return "yearly";
  if (lower.includes("monthly")) return "monthly";
  return null;
}

async function persistPlanForStripeEvent(payload: Buffer, signature: string): Promise<void> {
  try {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) return;
    const stripe = await getUncachableStripeClient();
    const event = stripe.webhooks.constructEvent(payload, signature, secret);

    const type = event.type;
    const obj: any = event.data?.object ?? {};
    const customerId: string | undefined =
      obj.customer ?? obj.customer_id ?? obj?.subscription?.customer;
    if (!customerId) return;

    const user = await storage.getUserByStripeCustomerId(customerId);
    if (!user) return;

    let plan: string | null = null;
    let mode: "subscription" | "payment" | null = null;

    if (type === "checkout.session.completed") {
      mode = obj.mode === "payment" ? "payment" : "subscription";
      try {
        const items = await stripe.checkout.sessions.listLineItems(obj.id, { limit: 5 });
        for (const li of items.data) {
          const pname = (li as any)?.price?.product?.name ?? li?.description;
          const inferred = inferPlanFromName(pname);
          if (inferred) { plan = inferred; break; }
        }
      } catch {}
      if (!plan && obj?.metadata?.tier) plan = obj.metadata.tier;
    } else if (
      type === "customer.subscription.created" ||
      type === "customer.subscription.updated" ||
      type === "invoice.paid"
    ) {
      mode = "subscription";
      const item = obj?.items?.data?.[0] ?? obj?.lines?.data?.[0];
      const interval = item?.price?.recurring?.interval ?? item?.plan?.interval;
      if (interval === "month") plan = "monthly";
      else if (interval === "year") plan = "yearly";
    }

    const activating =
      type === "checkout.session.completed" ||
      type === "invoice.paid" ||
      (type.startsWith("customer.subscription.") &&
        ["active", "trialing"].includes(obj.status));

    const deactivating =
      type === "customer.subscription.deleted" ||
      (type === "customer.subscription.updated" &&
        ["canceled", "unpaid", "incomplete_expired"].includes(obj.status));

    if (activating && plan) {
      await storage.updateUserStripeInfo(user.id, {
        subscriptionStatus: "active",
        plan,
        subscriptionSource: "stripe",
      });
      console.log("[Stripe Webhook] Plan set:", user.id, plan, "mode:", mode);
    } else if (deactivating && user.subscriptionSource !== "revenuecat") {
      await storage.updateUserStripeInfo(user.id, {
        subscriptionStatus: "inactive",
        plan: "none",
      });
      console.log("[Stripe Webhook] Deactivated:", user.id);
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
