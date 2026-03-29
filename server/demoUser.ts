import { db } from "./db";
import { users } from "../shared/schema";
import { generateToken } from "./auth";

const DEMO_EMAIL = "demo@beathaven.app";

let demoUserId: string | null = null;
let demoUserCache: { id: string; email: string; isAdmin: boolean; isDemo: boolean; subscriptionStatus: string } | null = null;

export async function seedDemoUser(): Promise<void> {
  try {
    const [row] = await db
      .insert(users)
      .values({
        email: DEMO_EMAIL,
        password: null,
        authProvider: "demo",
        isDemo: true,
        isAdmin: false,
        subscriptionStatus: "inactive",
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          isDemo: true,
          isAdmin: false,
          password: null,
          authProvider: "demo",
          subscriptionStatus: "inactive",
        },
      })
      .returning();

    demoUserId = row.id;
    demoUserCache = {
      id: row.id,
      email: row.email,
      isAdmin: false,
      isDemo: true,
      subscriptionStatus: "inactive",
    };
    console.log(`[Demo] Demo user ready: ${demoUserId}`);
  } catch (err) {
    console.error("[Demo] CRITICAL: Failed to seed demo user — demo mode will be unavailable:", err);
    console.error("[Demo] Check database connectivity and ensure the is_demo column exists (run migration 0001_add_is_demo.sql if needed).");
  }
}

export function getDemoUserId(): string | null {
  return demoUserId;
}

export function getDemoUser() {
  return demoUserCache;
}

export function generateDemoToken(): string | null {
  if (!demoUserId) return null;
  return generateToken(demoUserId);
}
