ALTER TABLE "mints" ADD COLUMN "distance" real NOT NULL;--> statement-breakpoint
ALTER TABLE "mints" ADD COLUMN "moving_time" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "mints" ADD COLUMN "elevation_gain" real NOT NULL;--> statement-breakpoint
ALTER TABLE "mints" ADD COLUMN "run_at" timestamp with time zone NOT NULL;--> statement-breakpoint
ALTER TABLE "mints" ADD COLUMN "wallet_address" varchar(42) NOT NULL;--> statement-breakpoint
ALTER TABLE "mints" ADD COLUMN "chain_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "mints" ADD COLUMN "contract_address" varchar(42) NOT NULL;