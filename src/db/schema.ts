/**
 * Relational schema for proovd (PostgreSQL).
 *
 * Money is always stored as integer minor units (paise) + ISO currency code.
 * Amounts use bigint columns in "number" mode: safe up to 2^53 paise (~₹90 trillion).
 */
import {
  bigint,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { CampaignAudience, Formula, MeasurementPlan } from "@/domain/types";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();
const money = (name: string) => bigint(name, { mode: "number" });

// ---------- enums ----------
export const userRole = pgEnum("user_role", ["brand", "creator", "admin"]);
export const orgType = pgEnum("org_type", ["brand", "agency"]);
export const verificationState = pgEnum("verification_state", ["unverified", "pending", "verified", "rejected"]);
export const campaignStatus = pgEnum("campaign_status", ["draft", "published", "paused", "completed", "cancelled"]);
export const fundingState = pgEnum("funding_state", ["not_funded", "funding_pending", "funded", "refunded"]);
export const applicationStatus = pgEnum("application_status", [
  "submitted",
  "shortlisted",
  "offered",
  "accepted",
  "rejected",
  "withdrawn",
  "expired",
]);
export const agreementStatus = pgEnum("agreement_status", [
  "offered",
  "accepted",
  "superseded",
  "completed",
  "cancelled",
  "disputed",
]);
export const deliverableState = pgEnum("deliverable_state", [
  "pending",
  "submitted",
  "changes_requested",
  "resubmitted",
  "approved",
  "rejected",
]);
export const milestoneState = pgEnum("milestone_state", [
  "pending",
  "evaluating",
  "earned",
  "partially_earned",
  "not_earned",
  "disputed",
  "settled",
]);
export const transferState = pgEnum("transfer_state", [
  "transfer_pending",
  "paid",
  "failed",
  "reversed",
  "refunded",
]);
export const eventValidity = pgEnum("event_validity", ["valid", "invalid", "duplicate", "out_of_window", "test"]);
export const verificationStatus = pgEnum("metric_verification", [
  "verified_api",
  "verified_brand_event",
  "creator_reported",
  "manual_reviewed",
  "estimated",
  "unavailable",
  "stale",
]);
export const disputeState = pgEnum("dispute_state", ["open", "under_review", "resolved", "rejected"]);
export const connectionState = pgEnum("connection_state", ["connected_api", "manual_evidence", "disconnected"]);
export const visibility = pgEnum("visibility", ["public", "private"]);

// ---------- identity & organizations ----------
export const users = pgTable("users", {
  id: id(),
  authSubject: text("auth_subject").notNull().unique(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: userRole("role").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: createdAt(),
});

export const organizations = pgTable("organizations", {
  id: id(),
  type: orgType("type").notNull().default("brand"),
  legalName: text("legal_name").notNull(),
  displayName: text("display_name").notNull(),
  category: text("category").notNull().default("D2C"),
  website: text("website"),
  verificationState: verificationState("verification_state").notNull().default("unverified"),
  /** Demo-only HMAC secret for the brand conversion webhook. In production keep in a secrets manager. */
  webhookSecret: text("webhook_secret").notNull(),
  createdAt: createdAt(),
});

export const memberships = pgTable(
  "memberships",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id),
    role: text("role").notNull().default("owner"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("memberships_user_org_uq").on(t.userId, t.organizationId)],
);

// ---------- creators ----------
export const creatorProfiles = pgTable(
  "creator_profiles",
  {
    id: id(),
    userId: uuid("user_id").notNull().unique().references(() => users.id),
    displayName: text("display_name").notNull(),
    headline: text("headline").notNull().default(""),
    bio: text("bio").notNull().default(""),
    location: text("location").notNull().default(""),
    languages: jsonb("languages").$type<string[]>().notNull().default([]),
    niches: jsonb("niches").$type<string[]>().notNull().default([]),
    primaryNiche: text("primary_niche").notNull().default("Lifestyle"),
    audienceBand: text("audience_band").notNull().default("10k-50k"),
    rateMinMinor: money("rate_min_minor").notNull().default(0),
    rateMaxMinor: money("rate_max_minor").notNull().default(0),
    availability: text("availability").notNull().default("available"),
    visibility: visibility("visibility").notNull().default("public"),
    verificationState: verificationState("verification_state").notNull().default("unverified"),
    accent: text("accent").notNull().default("#4f46e5"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("creator_niche_loc_idx").on(t.primaryNiche, t.location), index("creator_created_idx").on(t.createdAt)],
);

export const portfolioItems = pgTable("portfolio_items", {
  id: id(),
  creatorProfileId: uuid("creator_profile_id").notNull().references(() => creatorProfiles.id),
  title: text("title").notNull(),
  url: text("url").notNull(),
  platform: text("platform").notNull(),
  brandName: text("brand_name"),
  resultSummary: text("result_summary"),
  createdAt: createdAt(),
});

export const socialAccounts = pgTable(
  "social_accounts",
  {
    id: id(),
    creatorProfileId: uuid("creator_profile_id").notNull().references(() => creatorProfiles.id),
    platform: text("platform").notNull(),
    handle: text("handle").notNull(),
    externalId: text("external_id"),
    connectionState: connectionState("connection_state").notNull().default("manual_evidence"),
    scopes: jsonb("scopes").$type<string[]>().notNull().default([]),
    /** Reference to an encrypted token in a secrets store — never the token itself. */
    tokenSecretRef: text("token_secret_ref"),
    connectedAt: timestamp("connected_at", { withTimezone: true }),
    disconnectedAt: timestamp("disconnected_at", { withTimezone: true }),
  },
  (t) => [index("social_creator_idx").on(t.creatorProfileId)],
);

export const metricSnapshots = pgTable(
  "metric_snapshots",
  {
    id: id(),
    creatorProfileId: uuid("creator_profile_id").notNull().references(() => creatorProfiles.id),
    socialAccountId: uuid("social_account_id").references(() => socialAccounts.id),
    campaignId: uuid("campaign_id"),
    contentRef: text("content_ref"),
    metricKey: text("metric_key").notNull(),
    valueNumeric: bigint("value_numeric", { mode: "number" }).notNull(),
    unit: text("unit").notNull().default("count"),
    source: text("source").notNull(),
    verificationStatus: verificationStatus("verification_status").notNull(),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("metric_creator_key_idx").on(t.creatorProfileId, t.metricKey), index("metric_campaign_idx").on(t.campaignId)],
);

// ---------- campaigns ----------
export const campaigns = pgTable(
  "campaigns",
  {
    id: id(),
    organizationId: uuid("organization_id").notNull().references(() => organizations.id),
    title: text("title").notNull(),
    brief: text("brief").notNull().default(""),
    objective: text("objective").notNull(),
    niche: text("niche").notNull(),
    channels: jsonb("channels").$type<string[]>().notNull().default([]),
    audience: jsonb("audience").$type<CampaignAudience>().notNull(),
    budgetMinor: money("budget_minor").notNull(),
    currency: text("currency").notNull().default("INR"),
    creatorSlots: integer("creator_slots").notNull().default(1),
    compensation: jsonb("compensation").$type<Formula>().notNull(),
    measurement: jsonb("measurement").$type<MeasurementPlan>().notNull(),
    rights: text("rights").notNull().default(""),
    landingUrl: text("landing_url").notNull().default("https://example.com"),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    applyBy: timestamp("apply_by", { withTimezone: true }),
    status: campaignStatus("status").notNull().default("draft"),
    fundingState: fundingState("funding_state").notNull().default("not_funded"),
    visibility: visibility("visibility").notNull().default("public"),
    version: integer("version").notNull().default(1),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("campaign_status_niche_idx").on(t.status, t.niche, t.startAt),
    index("campaign_org_idx").on(t.organizationId, t.status),
  ],
);

export const campaignRequirements = pgTable("campaign_requirements", {
  id: id(),
  campaignId: uuid("campaign_id").notNull().references(() => campaigns.id),
  channel: text("channel").notNull(),
  deliverableType: text("deliverable_type").notNull(),
  quantity: integer("quantity").notNull().default(1),
  dueOffsetDays: integer("due_offset_days").notNull().default(7),
  acceptanceCriteria: text("acceptance_criteria").notNull().default(""),
});

// ---------- applications & agreements ----------
export const applications = pgTable(
  "applications",
  {
    id: id(),
    campaignId: uuid("campaign_id").notNull().references(() => campaigns.id),
    creatorProfileId: uuid("creator_profile_id").notNull().references(() => creatorProfiles.id),
    pitch: text("pitch").notNull(),
    proposedRateMinor: money("proposed_rate_minor").notNull(),
    currency: text("currency").notNull().default("INR"),
    availability: text("availability").notNull().default(""),
    portfolioLinks: jsonb("portfolio_links").$type<string[]>().notNull().default([]),
    status: applicationStatus("status").notNull().default("submitted"),
    brandNote: text("brand_note"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("application_campaign_creator_uq").on(t.campaignId, t.creatorProfileId),
    index("application_campaign_status_idx").on(t.campaignId, t.status),
  ],
);

export const agreements = pgTable(
  "agreements",
  {
    id: id(),
    campaignId: uuid("campaign_id").notNull().references(() => campaigns.id),
    creatorProfileId: uuid("creator_profile_id").notNull().references(() => creatorProfiles.id),
    applicationId: uuid("application_id").references(() => applications.id),
    version: integer("version").notNull(),
    compensationModel: text("compensation_model").notNull(),
    /** Immutable once both parties accept. Changes create a new version (amendment). */
    formulaSnapshot: jsonb("formula_snapshot").$type<Formula>().notNull(),
    deliverablesSnapshot: jsonb("deliverables_snapshot")
      .$type<{ title: string; type: string; channel: string; dueAt: string }[]>()
      .notNull(),
    rights: text("rights").notNull(),
    changeSummary: text("change_summary"),
    status: agreementStatus("status").notNull().default("offered"),
    acceptedByBrandAt: timestamp("accepted_by_brand_at", { withTimezone: true }),
    acceptedByCreatorAt: timestamp("accepted_by_creator_at", { withTimezone: true }),
    trackingSlug: text("tracking_slug").notNull(),
    couponCode: text("coupon_code").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("agreement_campaign_creator_version_uq").on(t.campaignId, t.creatorProfileId, t.version),
    index("agreement_creator_idx").on(t.creatorProfileId, t.status),
    index("agreement_slug_idx").on(t.trackingSlug),
  ],
);

export const deliverables = pgTable(
  "deliverables",
  {
    id: id(),
    agreementId: uuid("agreement_id").notNull().references(() => agreements.id),
    title: text("title").notNull(),
    type: text("type").notNull(),
    channel: text("channel").notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    submittedUrl: text("submitted_url"),
    notes: text("notes"),
    feedback: text("feedback"),
    approvalState: deliverableState("approval_state").notNull().default("pending"),
    revisionCount: integer("revision_count").notNull().default(0),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
  },
  (t) => [index("deliverable_agreement_idx").on(t.agreementId)],
);

// ---------- attribution ----------
export const attributionEvents = pgTable(
  "attribution_events",
  {
    id: id(),
    eventId: text("event_id").notNull().unique(),
    campaignId: uuid("campaign_id").notNull().references(() => campaigns.id),
    creatorProfileId: uuid("creator_profile_id").notNull().references(() => creatorProfiles.id),
    eventType: text("event_type").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    valueMinor: money("value_minor").notNull().default(0),
    currency: text("currency").notNull().default("INR"),
    source: text("source").notNull(),
    validityState: eventValidity("validity_state").notNull().default("valid"),
    reasonCode: text("reason_code"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("attr_campaign_creator_time_idx").on(t.campaignId, t.creatorProfileId, t.occurredAt)],
);

// ---------- finance ----------
export const milestones = pgTable("milestones", {
  id: id(),
  agreementId: uuid("agreement_id").notNull().references(() => agreements.id),
  milestoneType: text("milestone_type").notNull(),
  label: text("label").notNull(),
  state: milestoneState("state").notNull().default("pending"),
  earnedMinor: money("earned_minor").notNull().default(0),
  evaluatedAt: timestamp("evaluated_at", { withTimezone: true }),
});

/**
 * Append-only ledger. Each transaction group sums to zero across accounts.
 * Corrections are made with compensating entries, never updates or deletes.
 */
export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: id(),
    transactionGroupId: uuid("transaction_group_id").notNull(),
    campaignId: uuid("campaign_id").notNull().references(() => campaigns.id),
    agreementId: uuid("agreement_id").references(() => agreements.id),
    creatorProfileId: uuid("creator_profile_id").references(() => creatorProfiles.id),
    account: text("account").notNull(),
    entryType: text("entry_type").notNull(),
    amountMinor: money("amount_minor").notNull(),
    currency: text("currency").notNull().default("INR"),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    referenceType: text("reference_type"),
    referenceId: text("reference_id"),
    memo: text("memo").notNull().default(""),
    isTestData: integer("is_test_data").notNull().default(1),
    createdAt: createdAt(),
  },
  (t) => [index("ledger_campaign_idx").on(t.campaignId), index("ledger_creator_idx").on(t.creatorProfileId)],
);

export const paymentTransfers = pgTable("payment_transfers", {
  id: id(),
  provider: text("provider").notNull(),
  providerRef: text("provider_ref").notNull().unique(),
  idempotencyKey: text("idempotency_key").notNull().unique(),
  ledgerTransactionGroupId: uuid("ledger_transaction_group_id").notNull(),
  agreementId: uuid("agreement_id").notNull().references(() => agreements.id),
  amountMinor: money("amount_minor").notNull(),
  currency: text("currency").notNull().default("INR"),
  state: transferState("state").notNull().default("transfer_pending"),
  createdAt: createdAt(),
});

// ---------- trust ----------
export const disputes = pgTable("disputes", {
  id: id(),
  agreementId: uuid("agreement_id").notNull().references(() => agreements.id),
  openedByUserId: uuid("opened_by_user_id").notNull().references(() => users.id),
  category: text("category").notNull(),
  description: text("description").notNull(),
  amountHeldMinor: money("amount_held_minor").notNull().default(0),
  state: disputeState("state").notNull().default("open"),
  resolution: jsonb("resolution").$type<{ outcome: string; reason: string; by: string }>(),
  createdAt: createdAt(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

export const reviews = pgTable("reviews", {
  id: id(),
  agreementId: uuid("agreement_id").notNull().references(() => agreements.id),
  reviewerUserId: uuid("reviewer_user_id").notNull().references(() => users.id),
  rating: integer("rating").notNull(),
  structuredFeedback: jsonb("structured_feedback").$type<Record<string, number>>().notNull().default({}),
  comment: text("comment"),
  moderationState: text("moderation_state").notNull().default("published"),
  createdAt: createdAt(),
});

export const auditEvents = pgTable(
  "audit_events",
  {
    id: id(),
    actorUserId: uuid("actor_user_id"),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    action: text("action").notNull(),
    reason: text("reason"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index("audit_entity_idx").on(t.entityType, t.entityId), index("audit_created_idx").on(t.createdAt)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    href: text("href"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("notification_user_idx").on(t.userId, t.createdAt)],
);

