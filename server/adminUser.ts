import { db } from "./db";
import { users } from "../shared/schema";
import bcrypt from "bcryptjs";

export async function seedAdminUser(): Promise<void> {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.log("[Admin] ADMIN_EMAIL or ADMIN_PASSWORD not set — skipping admin seed");
    return;
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const [row] = await db
      .insert(users)
      .values({
        email,
        password: hashedPassword,
        authProvider: "email",
        isAdmin: true,
        isDemo: false,
        subscriptionStatus: "active",
      })
      .onConflictDoUpdate({
        target: users.email,
        set: {
          isAdmin: true,
          password: hashedPassword,
          subscriptionStatus: "active",
        },
      })
      .returning();

    console.log(`[Admin] Admin user ready: ${row.id} (${email})`);
  } catch (err) {
    console.error("[Admin] Failed to seed admin user:", err);
  }
}
