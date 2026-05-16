CREATE TABLE "mints" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"activity_id" bigint NOT NULL,
	"tx_hash" varchar(66) NOT NULL,
	"token_id" bigint,
	"minted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mints_activity_id_unique" UNIQUE("activity_id")
);
--> statement-breakpoint
CREATE TABLE "user_identities" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"ref_type" varchar(50) NOT NULL,
	"ref_id" varchar(255) NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"token_expires_at" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_user_identities_ref" UNIQUE("ref_type","ref_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mints" ADD CONSTRAINT "mints_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_identities" ADD CONSTRAINT "user_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_identities_user_id_idx" ON "user_identities" USING btree ("user_id");