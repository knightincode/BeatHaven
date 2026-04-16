import { db } from "./db";
import { users } from "../shared/schema";
import { sql } from "drizzle-orm";

const ADMIN_EMAIL = "BeatHavenAdmin@gmail.com";
const ADMIN_PASSWORD_HASH = "$2b$10$vhbx8ytH4if0eQ1//mGu7.2MC/ybl4HRIWey0Coe7w1wTB7SvG9gW";

export async function seedAdminUser(): Promise<void> {
  try {
    await db
      .insert(users)
      .values({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD_HASH,
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
          password: sql`CASE WHEN ${users.password} IS NULL THEN ${ADMIN_PASSWORD_HASH} ELSE ${users.password} END`,
        },
      });

    console.log(`[Admin] Admin user ready: ${ADMIN_EMAIL}`);
  } catch (err) {
    console.error("[Admin] Failed to seed admin user:", err);
  }
}
