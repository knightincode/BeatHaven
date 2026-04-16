import { db } from "./db";
import { users } from "../shared/schema";

const ADMIN_EMAIL = "BeatHavenAdmin@gmail.com";

export async function seedAdminUser(): Promise<void> {
  try {
    await db
      .insert(users)
      .values({
        email: ADMIN_EMAIL,
        password: null,
        authProvider: "email",
        isAdmin: true,
        isDemo: false,
        subscriptionStatus: "active",
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          isAdmin: true,
          subscriptionStatus: "active",
        },
      });

    console.log(`[Admin] Admin user promoted: ${ADMIN_EMAIL}`);
  } catch (err) {
    console.error("[Admin] Failed to seed admin user:", err);
  }
}
