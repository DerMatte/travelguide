CREATE TABLE "airport_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"iata" varchar(3) NOT NULL,
	"author" text NOT NULL,
	"trip_type" text NOT NULL,
	"rating" smallint NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'published' NOT NULL,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "airport_reviews_rating_check" CHECK ("airport_reviews"."rating" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE INDEX "airport_reviews_iata_created_at_idx" ON "airport_reviews" USING btree ("iata","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "airport_reviews_ip_hash_created_at_idx" ON "airport_reviews" USING btree ("ip_hash","created_at" DESC NULLS LAST);