CREATE TABLE "check_details" (
	"check_id" integer PRIMARY KEY NOT NULL,
	"site_id" text NOT NULL,
	"strategy" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "check_details" ADD CONSTRAINT "check_details_check_id_checks_id_fk" FOREIGN KEY ("check_id") REFERENCES "public"."checks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_details" ADD CONSTRAINT "check_details_site_id_sites_id_fk" FOREIGN KEY ("site_id") REFERENCES "public"."sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "check_details_site_idx" ON "check_details" USING btree ("site_id","strategy","created_at");