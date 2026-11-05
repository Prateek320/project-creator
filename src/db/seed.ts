/**
 * Demo seed. Runs once on an empty database. All money, events and payouts are TEST DATA
 * produced through the real domain services, so the ledger, audit trail and state machines
 * are exactly what a real run would produce.
 */
import { eq, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import type { DB } from "./index";
import * as schema from "./schema";
import type { Formula } from "@/domain/types";

const DAY = 86_400_000;
const rupees = (r: number) => r * 100;

const hybrid = (base: number, rate: number, cap: number, event: Formula["outcomeEvent"] = "signup"): Formula => ({
  model: "hybrid",
  currency: "INR",
  baseFeeMinor: rupees(base),
  ratePerOutcomeMinor: rupees(rate),
  capMinor: rupees(cap),
  outcomeEvent: event,
  attributionWindowDays: 7,
  partialDeliverablePolicy: "all_or_nothing",
  exclusions: "Test accounts, self-referrals, duplicate emails and signups cancelled within 24 hours",
});
const performance = (rate: number, cap: number, event: Formula["outcomeEvent"]): Formula => ({
  model: "performance",
  currency: "INR",
  ratePerOutcomeMinor: rupees(rate),
  capMinor: rupees(cap),
  outcomeEvent: event,
  attributionWindowDays: 14,
  partialDeliverablePolicy: "all_or_nothing",
  exclusions: "Returned or cancelled orders, orders using stacked discount codes",
});
const fixed = (fee: number): Formula => ({
  model: "fixed",
  currency: "INR",
  fixedFeeMinor: rupees(fee),
  attributionWindowDays: 0,
  partialDeliverablePolicy: "pro_rata",
  exclusions: "",
});

const CREATORS = [
  { key: "meera", name: "Meera Iyer", email: "meera@creators.demo", headline: "Skincare & clean beauty for Indian skin", location: "Bengaluru, Karnataka", niches: ["Beauty", "Lifestyle"], languages: ["English", "Tamil", "Kannada"], band: "50k-200k", rate: [6000, 15000], accent: "#7c3aed", ig: 142_300, yt: 38_900, er: 5.4, verified: "verified" as const },
  { key: "kabir", name: "Kabir Malhotra", email: "kabir@creators.demo", headline: "Strength training, no-nonsense nutrition", location: "Delhi, NCR", niches: ["Fitness"], languages: ["English", "Hindi"], band: "200k-1M", rate: [12000, 30000], accent: "#0891b2", ig: 318_000, yt: 120_400, er: 3.9, verified: "verified" as const },
  { key: "sana", name: "Sana Qureshi", email: "sana@creators.demo", headline: "Affordable makeup, honest swatches", location: "Hyderabad, Telangana", niches: ["Beauty"], languages: ["English", "Hindi", "Urdu"], band: "10k-50k", rate: [3000, 8000], accent: "#db2777", ig: 41_200, yt: 0, er: 7.1, verified: "verified" as const },
  { key: "ishita", name: "Ishita Kapoor", email: "ishita@creators.demo", headline: "Everyday fashion on a budget", location: "Mumbai, Maharashtra", niches: ["Fashion", "Beauty"], languages: ["English", "Hindi"], band: "50k-200k", rate: [5000, 12000], accent: "#ea580c", ig: 96_800, yt: 12_300, er: 4.6, verified: "pending" as const },
  { key: "zoya", name: "Zoya Khan", email: "zoya@creators.demo", headline: "Slow living, skincare rituals and Lucknow stories", location: "Lucknow, Uttar Pradesh", niches: ["Lifestyle", "Beauty"], languages: ["Hindi", "Urdu", "English"], band: "10k-50k", rate: [2500, 6000], accent: "#65a30d", ig: 28_400, yt: 0, er: 8.2, verified: "unverified" as const },
  { key: "tanvi", name: "Tanvi Joshi", email: "tanvi@creators.demo", headline: "Ethnic wear styling and festive looks", location: "Jaipur, Rajasthan", niches: ["Fashion"], languages: ["Hindi", "English"], band: "50k-200k", rate: [6000, 14000], accent: "#c2410c", ig: 77_900, yt: 0, er: 3.2, verified: "verified" as const },
  { key: "dev", name: "Dev Patel", email: "dev@creators.demo", headline: "Running, cycling and gear reviews", location: "Ahmedabad, Gujarat", niches: ["Fitness", "Tech"], languages: ["Gujarati", "Hindi", "English"], band: "10k-50k", rate: [4000, 9000], accent: "#2563eb", ig: 22_100, yt: 31_500, er: 6.0, verified: "verified" as const },
  { key: "ananya", name: "Ananya Sharma", email: "ananya@creators.demo", headline: "Home cooking, 20-minute recipes", location: "Mumbai, Maharashtra", niches: ["Food"], languages: ["English", "Hindi", "Marathi"], band: "200k-1M", rate: [15000, 35000], accent: "#b45309", ig: 410_000, yt: 205_000, er: 4.1, verified: "verified" as const },
  { key: "rohan", name: "Rohan Das", email: "rohan@creators.demo", headline: "Phones, laptops and honest tech advice", location: "Pune, Maharashtra", niches: ["Tech"], languages: ["English", "Bengali", "Hindi"], band: "50k-200k", rate: [8000, 20000], accent: "#4f46e5", ig: 54_000, yt: 162_000, er: 3.6, verified: "verified" as const },
  { key: "priya", name: "Priya Menon", email: "priya@creators.demo", headline: "Parenting toddlers without the guilt", location: "Chennai, Tamil Nadu", niches: ["Parenting", "Lifestyle"], languages: ["English", "Tamil", "Malayalam"], band: "10k-50k", rate: [3000, 7000], accent: "#0d9488", ig: 36_700, yt: 0, er: 6.8, verified: "verified" as const },
  { key: "arjun", name: "Arjun Nair", email: "arjun@creators.demo", headline: "Slow travel across South India", location: "Kochi, Kerala", niches: ["Travel"], languages: ["English", "Malayalam"], band: "50k-200k", rate: [7000, 16000], accent: "#0284c7", ig: 88_200, yt: 44_000, er: 5.0, verified: "verified" as const },
  { key: "vikram", name: "Vikram Singh", email: "vikram@creators.demo", headline: "Personal finance for first jobbers", location: "Gurugram, Haryana", niches: ["Finance"], languages: ["Hindi", "English"], band: "200k-1M", rate: [18000, 40000], accent: "#475569", ig: 260_000, yt: 390_000, er: 2.9, verified: "verified" as const },
];

export async function seed(db: DB): Promise<void> {
  const [{ n } = { n: 0 }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.users);
  if (Number(n) > 0) return;

  // Late imports avoid a module cycle (services import the schema, the db module imports this seed).
  const core = await import("@/server/core");
  const campaignsSvc = await import("@/server/campaigns");
  const collab = await import("@/server/collaborations");
  const finance = await import("@/server/finance");
  const admin = await import("@/server/admin");

  const now = Date.now();
  const secret = () => randomBytes(24).toString("hex");

  // ---------- organisations & users ----------
  const [glow, stride] = await db
    .insert(schema.organizations)
    .values([
      { legalName: "Glow Botanics Pvt Ltd", displayName: "Glow Botanics", category: "Beauty & skincare D2C", website: "https://glowbotanics.example", verificationState: "verified", webhookSecret: secret() },
      { legalName: "Urban Stride Apparel LLP", displayName: "Urban Stride", category: "Athleisure D2C", website: "https://urbanstride.example", verificationState: "verified", webhookSecret: secret() },
    ])
    .returning();
  await db.insert(schema.organizations).values({ legalName: "Chai & Co Foods", displayName: "Chai & Co", category: "Food & beverage", verificationState: "pending", webhookSecret: secret() });

  const [aarav, nisha, ops] = await db
    .insert(schema.users)
    .values([
      { authSubject: "demo|aarav", email: "aarav@glowbotanics.demo", name: "Aarav Mehta", role: "brand" },
      { authSubject: "demo|nisha", email: "nisha@urbanstride.demo", name: "Nisha Rao", role: "brand" },
      { authSubject: "demo|ops", email: "ritu@ops.demo", name: "Ritu Bansal", role: "admin" },
    ])
    .returning();
  await db.insert(schema.memberships).values([
    { userId: aarav!.id, organizationId: glow!.id, role: "owner" },
    { userId: nisha!.id, organizationId: stride!.id, role: "owner" },
  ]);

  const creatorIds: Record<string, string> = {};
  for (const [i, c] of CREATORS.entries()) {
    const [u] = await db.insert(schema.users).values({ authSubject: `demo|${c.key}`, email: c.email, name: c.name, role: "creator" }).returning();
    const [p] = await db
      .insert(schema.creatorProfiles)
      .values({
        userId: u!.id,
        displayName: c.name,
        headline: c.headline,
        bio: `${c.headline}. Posting since ${2017 + (i % 5)}. Audience mostly 18–34, ${c.location.split(",")[0]} and metro India.`,
        location: c.location,
        languages: c.languages,
        niches: c.niches,
        primaryNiche: c.niches[0]!,
        audienceBand: c.band,
        rateMinMinor: rupees(c.rate[0]!),
        rateMaxMinor: rupees(c.rate[1]!),
        verificationState: c.verified,
        accent: c.accent,
        createdAt: new Date(now - (60 - i) * DAY),
      })
      .returning();
    creatorIds[c.key] = p!.id;
    const ig = await db
      .insert(schema.socialAccounts)
      .values({
        creatorProfileId: p!.id,
        platform: "Instagram",
        handle: c.key + (i % 2 ? ".creates" : "_daily"),
        connectionState: i % 3 === 2 ? "manual_evidence" : "connected_api",
        scopes: i % 3 === 2 ? [] : ["instagram_basic", "instagram_manage_insights"],
        tokenSecretRef: i % 3 === 2 ? null : `vault://demo/${c.key}/instagram`,
        connectedAt: new Date(now - 30 * DAY),
      })
      .returning();
    const igVerified = i % 3 === 2 ? "creator_reported" : "verified_api";
    const igSource = i % 3 === 2 ? "creator_upload:screenshot" : "instagram_graph_api (demo seed)";
    const metrics: (typeof schema.metricSnapshots.$inferInsert)[] = [
      { creatorProfileId: p!.id, socialAccountId: ig[0]!.id, metricKey: "followers", valueNumeric: c.ig, source: igSource, verificationStatus: igVerified, observedAt: new Date(now - (i % 4) * DAY) },
      { creatorProfileId: p!.id, socialAccountId: ig[0]!.id, metricKey: "engagement_rate_bp", valueNumeric: Math.round(c.er * 100), unit: "basis_points", source: igSource, verificationStatus: igVerified, observedAt: new Date(now - (i % 4) * DAY) },
      { creatorProfileId: p!.id, socialAccountId: ig[0]!.id, metricKey: "avg_reel_views", valueNumeric: Math.round(c.ig * (0.35 + (i % 5) * 0.08)), source: igSource, verificationStatus: i === 5 ? "stale" : igVerified, observedAt: new Date(now - (i === 5 ? 75 : 2) * DAY) },
      { creatorProfileId: p!.id, metricKey: "audience_female_pct", valueNumeric: c.niches.includes("Beauty") ? 78 : c.niches.includes("Fitness") ? 41 : 56, unit: "percent", source: "modelled from public engagement", verificationStatus: "estimated", observedAt: new Date(now - 5 * DAY) },
    ];
    if (c.yt > 0) {
      const yt = await db
        .insert(schema.socialAccounts)
        .values({ creatorProfileId: p!.id, platform: "YouTube", handle: `@${c.key}`, connectionState: "manual_evidence", connectedAt: new Date(now - 20 * DAY) })
        .returning();
      metrics.push({ creatorProfileId: p!.id, socialAccountId: yt[0]!.id, metricKey: "subscribers", valueNumeric: c.yt, source: "creator_upload:studio_export.csv", verificationStatus: "creator_reported", observedAt: new Date(now - 9 * DAY) });
    }
    await db.insert(schema.metricSnapshots).values(metrics);
  }
  const ops$ = ops!;
  await db.insert(schema.portfolioItems).values([
    { creatorProfileId: creatorIds.meera!, title: "Vitamin C serum 30-day diary", url: "https://instagram.com/p/demo-meera-1", platform: "Instagram", brandName: "Dewdrop Labs", resultSummary: "212K views · 1,140 saves" },
    { creatorProfileId: creatorIds.meera!, title: "Monsoon skincare routine (long-form)", url: "https://youtube.com/watch?v=demo-meera-2", platform: "YouTube", brandName: null, resultSummary: "48K views · 6.1% CTR on description link" },
    { creatorProfileId: creatorIds.meera!, title: "Sunscreen myths, busted", url: "https://instagram.com/p/demo-meera-3", platform: "Instagram", brandName: "Glow Botanics", resultSummary: "Verified 50 signups on proovd" },
    { creatorProfileId: creatorIds.kabir!, title: "12-week strength block", url: "https://youtube.com/watch?v=demo-kabir-1", platform: "YouTube", brandName: null, resultSummary: "310K views" },
  ]);

  const actor = async (userId: string) => (await core.loadActor(db, userId))!;
  const A = await actor(aarav!.id);
  const N = await actor(nisha!.id);
  const OPS = await actor(ops$.id);
  const creatorActor = async (key: string) => {
    const [p] = await db.select().from(schema.creatorProfiles).where(eq(schema.creatorProfiles.id, creatorIds[key]!));
    return actor(p!.userId);
  };
  const reqs = (r: [string, string, number, number][]) =>
    r.map(([channel, deliverableType, quantity, dueOffsetDays]) => ({ channel, deliverableType, quantity, dueOffsetDays, acceptanceCriteria: "Product visible in first 3 seconds; #ad disclosure; tracked link in bio/description" }));
  const base = {
    channels: ["Instagram"],
    audience: { locations: ["Pan-India"], ageRange: "18–34", languages: ["English", "Hindi"], minFollowers: 10_000 },
    rights: "Brand may repost organically for 90 days. Paid amplification/whitelisting requires a separate fee.",
    visibility: "public" as const,
    applyBy: null,
  };
  const apply = async (key: string, campaignId: string, pitch: string, rate: number) =>
    collab.applyToCampaign(db, await creatorActor(key), campaignId, { pitch, proposedRateMinor: rupees(rate), availability: "Can start within 3 days", portfolioLinks: [] });
  const backdateSubmissions = async (rootId: string, lateIndex = -1) => {
    const ds = await db.select().from(schema.deliverables).where(eq(schema.deliverables.agreementId, rootId)).orderBy(schema.deliverables.dueAt);
    for (const [i, d] of ds.entries()) {
      if (!d.submittedAt) continue;
      const at = new Date(d.dueAt.getTime() + (i === lateIndex ? 1 : -1) * DAY);
      await db.update(schema.deliverables).set({ submittedAt: at, approvedAt: d.approvedAt ? new Date(at.getTime() + DAY / 2) : null }).where(eq(schema.deliverables.id, d.id));
    }
  };
  const events = (campaignId: string, creatorId: string, type: string, count: number, startMs: number, spanMs: number, prefix: string) =>
    Array.from({ length: count }, (_, i) => ({
      event_id: `${prefix}-${i + 1}`,
      campaign_id: campaignId,
      creator_id: creatorId,
      event_type: type,
      occurred_at: new Date(startMs + Math.floor((spanMs * (i + 0.5)) / count)).toISOString(),
      value_minor: type === "sale" ? rupees(1899) : 0,
    }));

  // ---------- Glow Botanics: completed campaign (history for Meera) ----------
  const c4 = await campaignsSvc.createCampaign(
    db,
    A,
    {
      ...base,
      title: "Winter Lip Care launch",
      brief: "Introduce our ceramide lip balm to dry-skin audiences ahead of winter. One Reel and two Stories with a tracked link to the launch page.",
      objective: "signups",
      niche: "Beauty",
      budgetMinor: rupees(20_000),
      creatorSlots: 2,
      compensation: hybrid(3000, 70, 10_000),
      measurement: { primaryMetric: "Verified signups", target: 100, sourceOfTruth: "brand_webhook", validDefinition: "New account with verified email, not previously registered" },
      landingUrl: "https://glowbotanics.example/lip-care",
      startAt: new Date(now - 70 * DAY),
      endAt: new Date(now - 50 * DAY),
      requirements: reqs([["Instagram", "Reel", 1, 4], ["Instagram", "Story", 2, 6]]),
    },
    true,
  );
  await campaignsSvc.fundCampaign(db, A, c4.id);
  const app4 = await apply("meera", c4.id, "My audience is 78% women aged 20–32 who struggle with winter dryness. I'd film a 7-day before/after with honest texture shots.", 6500);
  const ag4 = await collab.makeOffer(db, A, app4.id, { formula: c4.compensation });
  const M = await creatorActor("meera");
  await collab.acceptAgreement(db, M, ag4.id);
  for (const d of await db.select().from(schema.deliverables).where(eq(schema.deliverables.agreementId, ag4.id))) {
    await collab.submitDeliverable(db, M, d.id, `https://instagram.com/p/demo-lipcare-${d.id.slice(0, 6)}`, "");
    await collab.reviewDeliverable(db, A, d.id, "approved", "");
  }
  await backdateSubmissions(ag4.id);
  await finance.ingestEvents(db, glow!.id, events(c4.id, creatorIds.meera!, "signup", 50, now - 66 * DAY, 18 * DAY, "glow-lip"), "brand_webhook");
  await finance.approveSettlement(db, A, ag4.id);
  await finance.payoutCreator(db, A, ag4.id);
  await finance.completeCollaboration(db, A, ag4.id);
  await admin.leaveReview(db, A, ag4.id, { rating: 5, quality: 5, communication: 5, timeliness: 4, comment: "Clear, honest content and every deadline met. Would rebook." });
  await campaignsSvc.transitionCampaign(db, A, c4.id, "completed");
  await finance.refundUnspent(db, A, c4.id);

  // ---------- Glow Botanics: live hybrid campaign ----------
  const c1 = await campaignsSvc.createCampaign(
    db,
    A,
    {
      ...base,
      title: "Monsoon Glow Serum launch",
      brief: "Launch our niacinamide + rice water serum for humid-weather skin. Show a real morning routine, mention the 10% intro code and drive verified signups to the launch page.",
      objective: "signups",
      niche: "Beauty",
      channels: ["Instagram"],
      audience: { locations: ["Pan-India"], ageRange: "20–34", languages: ["English", "Hindi", "Tamil"], minFollowers: 10_000 },
      budgetMinor: rupees(30_000),
      creatorSlots: 3,
      compensation: hybrid(3000, 70, 10_000),
      measurement: { primaryMetric: "Verified signups", target: 100, sourceOfTruth: "brand_webhook", validDefinition: "New account with verified email, first-time customer, not cancelled within 24 hours" },
      landingUrl: "https://glowbotanics.example/monsoon-serum",
      startAt: new Date(now - 10 * DAY),
      endAt: new Date(now + 6 * DAY),
      requirements: reqs([["Instagram", "Reel", 1, 2], ["Instagram", "Story", 3, 4]]),
    },
    true,
  );
  await campaignsSvc.fundCampaign(db, A, c1.id);
  const app1 = await apply("meera", c1.id, "Humid-weather skincare is my most-saved series. I'll do a real 6am routine Reel plus three Stories walking through texture, layering and the intro code.", 7000);
  const ag1 = await collab.makeOffer(db, A, app1.id, { formula: c1.compensation, note: "Standard hybrid terms" });
  await collab.acceptAgreement(db, M, ag1.id);
  const d1 = await db.select().from(schema.deliverables).where(eq(schema.deliverables.agreementId, ag1.id)).orderBy(schema.deliverables.dueAt);
  for (const [i, d] of d1.entries()) {
    if (i === 3) {
      await collab.submitDeliverable(db, M, d.id, "https://instagram.com/stories/meera_daily/demo-4", "Final story with the intro code sticker");
      continue;
    }
    await collab.submitDeliverable(db, M, d.id, `https://instagram.com/p/demo-serum-${i + 1}`, "");
    if (i === 0) {
      await collab.reviewDeliverable(db, A, d.id, "changes_requested", "Please add the #ad disclosure in the first line of the caption.");
      await collab.submitDeliverable(db, M, d.id, "https://instagram.com/p/demo-serum-1-v2", "Disclosure added to first line");
    }
    await collab.reviewDeliverable(db, A, d.id, "approved", "");
  }
  await backdateSubmissions(ag1.id, 2);
  const serumEvents = events(c1.id, creatorIds.meera!, "signup", 49, now - 8 * DAY, 8 * DAY - 3_600_000, "glow-serum");
  await finance.ingestEvents(db, glow!.id, [...serumEvents, serumEvents[3]!, serumEvents[7]!, { ...serumEvents[0]!, event_id: "glow-serum-qa-1", test: true }], "brand_webhook");
  const flagged = await db.select().from(schema.attributionEvents).where(sql`${schema.attributionEvents.eventId} in ('glow-serum-12','glow-serum-30','glow-serum-41')`);
  for (const f of flagged) await finance.setEventValidity(db, A, f.id, "invalid", "Same device fingerprint as an employee test account");
  const clicks = Array.from({ length: 640 }, (_, i) => ({ event_id: `glow-serum-click-${i}`, campaign_id: c1.id, creator_id: creatorIds.meera!, event_type: "click", occurred_at: new Date(now - 8 * DAY + i * 1_070_000).toISOString(), source: "first_party_link" }));
  await finance.ingestEvents(db, glow!.id, clicks, "first_party_link");
  await db.insert(schema.metricSnapshots).values([
    { creatorProfileId: creatorIds.meera!, campaignId: c1.id, contentRef: "reel-1", metricKey: "views", valueNumeric: 182_400, source: "instagram_graph_api (demo seed)", verificationStatus: "verified_api", observedAt: new Date(now - DAY) },
    { creatorProfileId: creatorIds.meera!, campaignId: c1.id, contentRef: "reel-1", metricKey: "reach", valueNumeric: 131_900, source: "instagram_graph_api (demo seed)", verificationStatus: "verified_api", observedAt: new Date(now - DAY) },
    { creatorProfileId: creatorIds.meera!, campaignId: c1.id, contentRef: "reel-1", metricKey: "saves", valueNumeric: 2_310, source: "creator_upload:insights_screenshot.png", verificationStatus: "creator_reported", observedAt: new Date(now - 2 * DAY) },
    { creatorProfileId: creatorIds.meera!, campaignId: c1.id, contentRef: "stories", metricKey: "story_reach", valueNumeric: 48_000, source: "modelled: 34% of followers", verificationStatus: "estimated", observedAt: new Date(now - DAY) },
    { creatorProfileId: creatorIds.meera!, campaignId: c1.id, contentRef: "stories", metricKey: "link_sticker_taps", valueNumeric: 0, source: "story insights not yet shared", verificationStatus: "unavailable", observedAt: new Date(now - DAY) },
  ]);
  await apply("sana", c1.id, "Beauty is all I post and my audience is in Hyderabad and Bengaluru — exactly the humid-weather crowd. Swatch-led Reel with honest texture notes.", 4500);
  const appIshita = await apply("ishita", c1.id, "I can style the serum into a 'monsoon commute' GRWM that lands with my fashion audience, who over-index on skincare purchases.", 8000);
  const appZoya = await apply("zoya", c1.id, "Slow-morning rituals are my format. A calm, ASMR-style application Reel would suit a launch that wants trust over hype.", 3500);
  const appTanvi = await apply("tanvi", c1.id, "Festive looks start with skin prep — I'd do a 'pre-wedding glow' angle with the serum as step one.", 9000);
  await collab.setApplicationStatus(db, A, (await db.select().from(schema.applications).where(eq(schema.applications.creatorProfileId, creatorIds.sana!)))[0]!.id, "shortlisted", "Great audience fit");
  await collab.setApplicationStatus(db, A, appIshita.id, "shortlisted", "Strong saves on past skincare posts");
  await collab.makeOffer(db, A, appZoya.id, { formula: { ...c1.compensation, baseFeeMinor: rupees(2500) }, note: "Base adjusted to ₹2,500 for a single Reel; same per-signup rate" });
  await collab.setApplicationStatus(db, A, appTanvi.id, "rejected", "Festive angle doesn't fit a monsoon launch");

  // ---------- Glow Botanics: open fixed-fee UGC + a draft ----------
  const c2 = await campaignsSvc.createCampaign(
    db,
    A,
    {
      ...base,
      title: "Sunscreen UGC pack",
      brief: "We need 3 vertical UGC videos (no posting required) showing our SPF 50 gel on oily skin, for use in our own ads.",
      objective: "ugc",
      niche: "Beauty",
      budgetMinor: rupees(24_000),
      creatorSlots: 3,
      compensation: fixed(8000),
      measurement: { primaryMetric: "Approved UGC videos", target: 3, sourceOfTruth: "csv_upload", validDefinition: "Video delivered in 9:16, 20–45s, product on screen, raw files supplied" },
      rights: "Perpetual usage on brand-owned channels and paid ads in India. No whitelisting of creator handle.",
      landingUrl: "https://glowbotanics.example/spf50",
      startAt: new Date(now + 2 * DAY),
      endAt: new Date(now + 20 * DAY),
      applyBy: new Date(now + 8 * DAY),
      requirements: reqs([["Instagram", "UGC video", 3, 5]]),
    },
    true,
  );
  await apply("ishita", c2.id, "I shoot clean, well-lit UGC on an iPhone 15 Pro with a lav mic. Oily-skin is my own skin type so the demo will be authentic.", 8000);
  await campaignsSvc.createCampaign(db, A, {
    ...base,
    title: "Festive gift box",
    brief: "Diwali gift box featuring our three bestsellers. Draft — finalising budget with finance.",
    objective: "sales",
    niche: "Beauty",
    budgetMinor: rupees(50_000),
    creatorSlots: 4,
    compensation: hybrid(4000, 120, 12_000, "sale"),
    measurement: { primaryMetric: "Verified orders", target: 60, sourceOfTruth: "brand_webhook", validDefinition: "" },
    landingUrl: "https://glowbotanics.example/festive",
    startAt: new Date(now + 14 * DAY),
    endAt: new Date(now + 30 * DAY),
    requirements: reqs([["Instagram", "Reel", 1, 3]]),
  });

  // ---------- Urban Stride: performance campaign with a dispute ----------
  const u1 = await campaignsSvc.createCampaign(
    db,
    N,
    {
      ...base,
      title: "10K Steps Challenge",
      brief: "Drive sales of our Featherlite running shoes. Do the 10K-steps-a-day challenge for a week in Featherlites, with your coupon code in every post.",
      objective: "sales",
      niche: "Fitness",
      channels: ["Instagram", "YouTube"],
      audience: { locations: ["Delhi", "Mumbai", "Bengaluru", "Pune"], ageRange: "22–40", languages: ["English", "Hindi"], minFollowers: 20_000 },
      budgetMinor: rupees(45_000),
      creatorSlots: 3,
      compensation: performance(150, 15_000, "sale"),
      measurement: { primaryMetric: "Verified orders", target: 100, sourceOfTruth: "brand_webhook", validDefinition: "Paid order using creator coupon or tracked link, not returned within 14 days" },
      rights: "Brand may repost for 60 days with credit.",
      landingUrl: "https://urbanstride.example/featherlite",
      startAt: new Date(now - 21 * DAY),
      endAt: new Date(now - 2 * DAY),
      requirements: reqs([["Instagram", "Reel", 2, 3], ["YouTube", "Short", 1, 6]]),
    },
    true,
  );
  await campaignsSvc.fundCampaign(db, N, u1.id);
  const appK = await apply("kabir", u1.id, "My audience trains 4–5x a week and buys gear on my recommendation — last shoe collab did 210 coupon orders. Happy to go performance-only.", 15000);
  const agK = await collab.makeOffer(db, N, appK.id, { formula: u1.compensation });
  const K = await creatorActor("kabir");
  await collab.acceptAgreement(db, K, agK.id);
  for (const d of await db.select().from(schema.deliverables).where(eq(schema.deliverables.agreementId, agK.id))) {
    await collab.submitDeliverable(db, K, d.id, `https://instagram.com/p/demo-steps-${d.id.slice(0, 6)}`, "");
    await collab.reviewDeliverable(db, N, d.id, "approved", "");
  }
  await backdateSubmissions(agK.id);
  await finance.ingestEvents(db, stride!.id, events(u1.id, creatorIds.kabir!, "sale", 60, now - 19 * DAY, 9 * DAY, "us-steps-a"), "brand_webhook");
  await finance.approveSettlement(db, N, agK.id);
  await finance.payoutCreator(db, N, agK.id);
  await finance.ingestEvents(db, stride!.id, events(u1.id, creatorIds.kabir!, "sale", 20, now - 9 * DAY, 6 * DAY, "us-steps-b"), "brand_webhook");
  await finance.approveSettlement(db, N, agK.id);
  await finance.openDispute(db, N, agK.id, {
    category: "invalid_leads",
    description: "10 of the second batch of orders were returned inside the 14-day window. We'd like those excluded before paying out the balance.",
    amountHeldMinor: rupees(1500),
  });
  await apply("dev", u1.id, "I review running gear for a serious amateur audience in Gujarat — I can do an honest 100km wear test.", 6000);

  const u2 = await campaignsSvc.createCampaign(
    db,
    N,
    {
      ...base,
      title: "Athleisure try-on hauls",
      brief: "Show 4 pieces from the new Studio range styled for work-to-gym. Honest fit notes for different body types encouraged.",
      objective: "awareness",
      niche: "Fashion",
      channels: ["Instagram", "YouTube"],
      budgetMinor: rupees(36_000),
      creatorSlots: 3,
      compensation: fixed(12_000),
      measurement: { primaryMetric: "Approved posts live for 30 days", target: 3, sourceOfTruth: "tracked_link", validDefinition: "Post live with disclosure and tracked link for 30 days" },
      landingUrl: "https://urbanstride.example/studio",
      startAt: new Date(now + 5 * DAY),
      endAt: new Date(now + 25 * DAY),
      applyBy: new Date(now + 4 * DAY),
      requirements: reqs([["Instagram", "Reel", 1, 3], ["YouTube", "Video", 1, 10]]),
    },
    true,
  );
  await apply("tanvi", u2.id, "Work-to-gym styling for women who wear kurtas to the office — a fresh angle for Studio.", 12000);
  await campaignsSvc.createCampaign(
    db,
    N,
    {
      ...base,
      title: "Monsoon trail-running series",
      brief: "Three-part trail series in the Western Ghats wearing our GripPro trail shoe. Safety-first; no risky stunts.",
      objective: "awareness",
      niche: "Travel",
      channels: ["YouTube"],
      budgetMinor: rupees(40_000),
      creatorSlots: 2,
      compensation: hybrid(10_000, 200, 18_000, "sale"),
      measurement: { primaryMetric: "Verified orders", target: 40, sourceOfTruth: "brand_webhook", validDefinition: "Paid order via tracked link, not returned within 14 days" },
      landingUrl: "https://urbanstride.example/grippro",
      startAt: new Date(now + 10 * DAY),
      endAt: new Date(now + 40 * DAY),
      requirements: reqs([["YouTube", "Video", 3, 7]]),
    },
    true,
  );

  // A couple of unread notifications for the ops queue context.
  await core.audit(db, OPS, "platform", "seed", "demo_seeded", { note: "All money and events are test data" });
}
