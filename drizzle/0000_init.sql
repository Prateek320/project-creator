CREATE TYPE "public"."agreement_status" AS ENUM('offered', 'accepted', 'superseded', 'completed', 'cancelled', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."application_status" AS ENUM('submitted', 'shortlisted', 'offered', 'accepted', 'rejected', 'withdrawn', 'expired');--> statement-breakpoint
CREATE TYPE "public"."campaign_status" AS ENUM('draft', 'published', 'paused', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."connection_state" AS ENUM('connected_api', 'manual_evidence', 'disconnected');--> statement-breakpoint
CREATE TYPE "public"."deliverable_state" AS ENUM('pending', 'submitted', 'changes_requested', 'resubmitted', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."dispute_state" AS ENUM('open', 'under_review', 'resolved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."event_validity" AS ENUM('valid', 'invalid', 'duplicate', 'out_of_window', 'test');--> statement-breakpoint
CREATE TYPE "public"."funding_state" AS ENUM('not_funded', 'funding_pending', 'funded', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."milestone_state" AS ENUM('pending', 'evaluating', 'earned', 'partially_earned', 'not_earned', 'disputed', 'settled');--> statement-breakpoint
CREATE TYPE "public"."org_type" AS ENUM('brand', 'agency');--> statement-breakpoint
CREATE TYPE "public"."transfer_state" AS ENUM('transfer_pending', 'paid', 'failed', 'reversed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('brand', 'creator', 'admin');--> statement-breakpoint
CREATE TYPE "public"."verification_state" AS ENUM('unverified', 'pending', 'verified', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."metric_verification" AS ENUM('verified_api', 'verified_brand_event', 'creator_reported', 'manual_reviewed', 'estimated', 'unavailable', 'stale');--> statement-breakpoint
CREATE TYPE "public"."visibility" AS ENUM('public', 'private');--> statement-breakpoint
CREATE TABLE "agreements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"creator_profile_id" uuid NOT NULL,
	"application_id" uuid,
	"version" integer NOT NULL,
	"compensation_model" text NOT NULL,
	"formula_snapshot" jsonb NOT NULL,
	"deliverables_snapshot" jsonb NOT NULL,
	"rights" text NOT NULL,
	"change_summary" text,
	"status" "agreement_status" DEFAULT 'offered' NOT NULL,
	"accepted_by_brand_at" timestamp with time zone,
	"accepted_by_creator_at" timestamp with time zone,
	"tracking_slug" text NOT NULL,
	"coupon_code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"creator_profile_id" uuid NOT NULL,
	"pitch" text NOT NULL,
	"proposed_rate_minor" bigint NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"availability" text DEFAULT '' NOT NULL,
	"portfolio_links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "application_status" DEFAULT 'submitted' NOT NULL,
	"brand_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attribution_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" text NOT NULL,
	"campaign_id" uuid NOT NULL,
	"creator_profile_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"value_minor" bigint DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"source" text NOT NULL,
	"validity_state" "event_validity" DEFAULT 'valid' NOT NULL,
	"reason_code" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attribution_events_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" text NOT NULL,
	"reason" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"deliverable_type" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"due_offset_days" integer DEFAULT 7 NOT NULL,
	"acceptance_criteria" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" text NOT NULL,
	"brief" text DEFAULT '' NOT NULL,
	"objective" text NOT NULL,
	"niche" text NOT NULL,
	"channels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"audience" jsonb NOT NULL,
	"budget_minor" bigint NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"creator_slots" integer DEFAULT 1 NOT NULL,
	"compensation" jsonb NOT NULL,
	"measurement" jsonb NOT NULL,
	"rights" text DEFAULT '' NOT NULL,
	"landing_url" text DEFAULT 'https://example.com' NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"apply_by" timestamp with time zone,
	"status" "campaign_status" DEFAULT 'draft' NOT NULL,
	"funding_state" "funding_state" DEFAULT 'not_funded' NOT NULL,
	"visibility" "visibility" DEFAULT 'public' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creator_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"headline" text DEFAULT '' NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"languages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"niches" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"primary_niche" text DEFAULT 'Lifestyle' NOT NULL,
	"audience_band" text DEFAULT '10k-50k' NOT NULL,
	"rate_min_minor" bigint DEFAULT 0 NOT NULL,
	"rate_max_minor" bigint DEFAULT 0 NOT NULL,
	"availability" text DEFAULT 'available' NOT NULL,
	"visibility" "visibility" DEFAULT 'public' NOT NULL,
	"verification_state" "verification_state" DEFAULT 'unverified' NOT NULL,
	"accent" text DEFAULT '#4f46e5' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "creator_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "deliverables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agreement_id" uuid NOT NULL,
	"title" text NOT NULL,
	"type" text NOT NULL,
	"channel" text NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"submitted_url" text,
	"notes" text,
	"feedback" text,
	"approval_state" "deliverable_state" DEFAULT 'pending' NOT NULL,
	"revision_count" integer DEFAULT 0 NOT NULL,
	"submitted_at" timestamp with time zone,
	"approved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "disputes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agreement_id" uuid NOT NULL,
	"opened_by_user_id" uuid NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"amount_held_minor" bigint DEFAULT 0 NOT NULL,
	"state" "dispute_state" DEFAULT 'open' NOT NULL,
	"resolution" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_group_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"agreement_id" uuid,
	"creator_profile_id" uuid,
	"account" text NOT NULL,
	"entry_type" text NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"idempotency_key" text NOT NULL,
	"reference_type" text,
	"reference_id" text,
	"memo" text DEFAULT '' NOT NULL,
	"is_test_data" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_entries_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"role" text DEFAULT 'owner' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metric_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_profile_id" uuid NOT NULL,
	"social_account_id" uuid,
	"campaign_id" uuid,
	"content_ref" text,
	"metric_key" text NOT NULL,
	"value_numeric" bigint NOT NULL,
	"unit" text DEFAULT 'count' NOT NULL,
	"source" text NOT NULL,
	"verification_status" "metric_verification" NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agreement_id" uuid NOT NULL,
	"milestone_type" text NOT NULL,
	"label" text NOT NULL,
	"state" "milestone_state" DEFAULT 'pending' NOT NULL,
	"earned_minor" bigint DEFAULT 0 NOT NULL,
	"evaluated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"href" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "org_type" DEFAULT 'brand' NOT NULL,
	"legal_name" text NOT NULL,
	"display_name" text NOT NULL,
	"category" text DEFAULT 'D2C' NOT NULL,
	"website" text,
	"verification_state" "verification_state" DEFAULT 'unverified' NOT NULL,
	"webhook_secret" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"provider_ref" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"ledger_transaction_group_id" uuid NOT NULL,
	"agreement_id" uuid NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"state" "transfer_state" DEFAULT 'transfer_pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_transfers_provider_ref_unique" UNIQUE("provider_ref"),
	CONSTRAINT "payment_transfers_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "portfolio_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_profile_id" uuid NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"platform" text NOT NULL,
	"brand_name" text,
	"result_summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agreement_id" uuid NOT NULL,
	"reviewer_user_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"structured_feedback" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"comment" text,
	"moderation_state" text DEFAULT 'published' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creator_profile_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"handle" text NOT NULL,
	"external_id" text,
	"connection_state" "connection_state" DEFAULT 'manual_evidence' NOT NULL,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"token_secret_ref" text,
	"connected_at" timestamp with time zone,
	"disconnected_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_subject" text NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" "user_role" NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_auth_subject_unique" UNIQUE("auth_subject"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_creator_profile_id_creator_profiles_id_fk" FOREIGN KEY ("creator_profile_id") REFERENCES "public"."creator_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_creator_profile_id_creator_profiles_id_fk" FOREIGN KEY ("creator_profile_id") REFERENCES "public"."creator_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attribution_events" ADD CONSTRAINT "attribution_events_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attribution_events" ADD CONSTRAINT "attribution_events_creator_profile_id_creator_profiles_id_fk" FOREIGN KEY ("creator_profile_id") REFERENCES "public"."creator_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_requirements" ADD CONSTRAINT "campaign_requirements_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_profiles" ADD CONSTRAINT "creator_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_agreement_id_agreements_id_fk" FOREIGN KEY ("agreement_id") REFERENCES "public"."agreements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_agreement_id_agreements_id_fk" FOREIGN KEY ("agreement_id") REFERENCES "public"."agreements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_opened_by_user_id_users_id_fk" FOREIGN KEY ("opened_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_agreement_id_agreements_id_fk" FOREIGN KEY ("agreement_id") REFERENCES "public"."agreements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_creator_profile_id_creator_profiles_id_fk" FOREIGN KEY ("creator_profile_id") REFERENCES "public"."creator_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric_snapshots" ADD CONSTRAINT "metric_snapshots_creator_profile_id_creator_profiles_id_fk" FOREIGN KEY ("creator_profile_id") REFERENCES "public"."creator_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric_snapshots" ADD CONSTRAINT "metric_snapshots_social_account_id_social_accounts_id_fk" FOREIGN KEY ("social_account_id") REFERENCES "public"."social_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_agreement_id_agreements_id_fk" FOREIGN KEY ("agreement_id") REFERENCES "public"."agreements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transfers" ADD CONSTRAINT "payment_transfers_agreement_id_agreements_id_fk" FOREIGN KEY ("agreement_id") REFERENCES "public"."agreements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_items" ADD CONSTRAINT "portfolio_items_creator_profile_id_creator_profiles_id_fk" FOREIGN KEY ("creator_profile_id") REFERENCES "public"."creator_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_agreement_id_agreements_id_fk" FOREIGN KEY ("agreement_id") REFERENCES "public"."agreements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewer_user_id_users_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_creator_profile_id_creator_profiles_id_fk" FOREIGN KEY ("creator_profile_id") REFERENCES "public"."creator_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "agreement_campaign_creator_version_uq" ON "agreements" USING btree ("campaign_id","creator_profile_id","version");--> statement-breakpoint
CREATE INDEX "agreement_creator_idx" ON "agreements" USING btree ("creator_profile_id","status");--> statement-breakpoint
CREATE INDEX "agreement_slug_idx" ON "agreements" USING btree ("tracking_slug");--> statement-breakpoint
CREATE UNIQUE INDEX "application_campaign_creator_uq" ON "applications" USING btree ("campaign_id","creator_profile_id");--> statement-breakpoint
CREATE INDEX "application_campaign_status_idx" ON "applications" USING btree ("campaign_id","status");--> statement-breakpoint
CREATE INDEX "attr_campaign_creator_time_idx" ON "attribution_events" USING btree ("campaign_id","creator_profile_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_events" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_created_idx" ON "audit_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "campaign_status_niche_idx" ON "campaigns" USING btree ("status","niche","start_at");--> statement-breakpoint
CREATE INDEX "campaign_org_idx" ON "campaigns" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "creator_niche_loc_idx" ON "creator_profiles" USING btree ("primary_niche","location");--> statement-breakpoint
CREATE INDEX "creator_created_idx" ON "creator_profiles" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "deliverable_agreement_idx" ON "deliverables" USING btree ("agreement_id");--> statement-breakpoint
CREATE INDEX "ledger_campaign_idx" ON "ledger_entries" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "ledger_creator_idx" ON "ledger_entries" USING btree ("creator_profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "memberships_user_org_uq" ON "memberships" USING btree ("user_id","organization_id");--> statement-breakpoint
CREATE INDEX "metric_creator_key_idx" ON "metric_snapshots" USING btree ("creator_profile_id","metric_key");--> statement-breakpoint
CREATE INDEX "metric_campaign_idx" ON "metric_snapshots" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "notification_user_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "social_creator_idx" ON "social_accounts" USING btree ("creator_profile_id");