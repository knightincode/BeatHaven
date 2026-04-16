ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "plan" text DEFAULT 'none';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subscription_source" text;
