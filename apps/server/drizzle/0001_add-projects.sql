CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"name" text NOT NULL,
	"name_key" text NOT NULL,
	"description" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_name_length_check" CHECK (char_length("projects"."name") between 1 and 100 and "projects"."name" = btrim("projects"."name")),
	CONSTRAINT "projects_description_length_check" CHECK ("projects"."description" is null or char_length("projects"."description") <= 1000),
	CONSTRAINT "projects_default_active_check" CHECK (not "projects"."is_default" or "projects"."archived_at" is null)
);
--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "projects_owner_name_key_uidx" ON "projects" USING btree ("owner_user_id","name_key");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_owner_default_uidx" ON "projects" USING btree ("owner_user_id") WHERE "projects"."is_default";--> statement-breakpoint
CREATE INDEX "projects_owner_archived_name_idx" ON "projects" USING btree ("owner_user_id","archived_at","name_key");--> statement-breakpoint
INSERT INTO "projects" ("owner_user_id", "is_default", "name", "name_key")
SELECT "id", true, 'Default Project', 'default project'
FROM "user";--> statement-breakpoint
CREATE FUNCTION provision_default_project_for_user()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
	INSERT INTO "projects" ("owner_user_id", "is_default", "name", "name_key")
	VALUES (NEW."id", true, 'Default Project', 'default project');
	RETURN NEW;
END;
$function$;--> statement-breakpoint
CREATE TRIGGER "user_provision_default_project"
AFTER INSERT ON "user"
FOR EACH ROW
EXECUTE FUNCTION provision_default_project_for_user();
