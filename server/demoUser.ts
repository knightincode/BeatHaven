import { db } from "./db";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";
import { generateToken } from "./auth";

const DEMO_EMAIL = "demo@beathaven.app";

let demoUserId: string | null = null;

export async function seedDemoUser(): Promise<void> {
  try {
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, DEMO_EMAIL));

    if (existing.length > 0) {
      const row = existing[0];
      if (!row.isDemo || row.subscriptionStatus !== "active") {
        await db
          .update(users)
          .set({ isDemo: true, subscriptionStatus: "active" })
          .where(eq(users.email, DEMO_EMAIL));
        demoUserId = row.id;
      } else {
        demoUserId = row.id;
      }
      console.log(`[Demo] Demo user ready: ${demoUserId}`);
      return;
    }

    const [created] = await db
      .insert(users)
      .values({
        email: DEMO_EMAIL,
        password: null,
        authProvider: "demo",
        isDemo: true,
        subscriptionStatus: "active",
      })
      .returning();

    demoUserId = created.id;
    console.log(`[Demo] Demo user created: ${demoUserId}`);
  } catch (err) {
    console.error("[Demo] Failed to seed demo user:", err);
  }
}

export function getDemoUserId(): string | null {
  return demoUserId;
}

export function generateDemoToken(): string | null {
  if (!demoUserId) return null;
  return generateToken(demoUserId);
}
