"use client";

import { useEffect, useRef, useState } from "react";
import { createCampaignAction } from "@/app/actions";
import { SubmitButton } from "@/components/client";
import { FormulaFields } from "@/components/formula";
import { Card, cx, Field, inputClass, Notice } from "@/components/ui";

const STEPS = ["Brief", "Audience & deliverables", "Compensation", "Measurement & rights"];
const NICHES = ["Beauty", "Fashion", "Fitness", "Food", "Tech", "Travel", "Finance", "Parenting", "Lifestyle", "Gaming"];
const CHANNELS = ["Instagram", "YouTube", "Blog", "Podcast"];
const LANGS = ["English", "Hindi", "Tamil", "Telugu", "Kannada", "Malayalam", "Marathi", "Bengali", "Gujarati"];
const KEY = "pc:campaign-draft";

type Req = { type: string; channel: string; qty: number; due: number; criteria: string };
const iso = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);

export function CampaignBuilder() {
  const form = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState(0);
  const [budget, setBudget] = useState("30000");
  const [slots, setSlots] = useState("3");
  const [target, setTarget] = useState("100");
  const [reqs, setReqs] = useState<Req[]>([
    { type: "Reel", channel: "Instagram", qty: 1, due: 3, criteria: "Product visible in first 3 seconds; #ad disclosure in first line" },
    { type: "Story", channel: "Instagram", qty: 3, due: 5, criteria: "Link sticker with tracked link" },
  ]);
  const [restored, setRestored] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // Autosave simple fields locally (per browser). The server remains the source of truth.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw || !form.current) return;
      const data = JSON.parse(raw) as Record<string, string | string[]>;
      for (const [k, v] of Object.entries(data)) {
        const els = form.current.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(`[name="${CSS.escape(k)}"]`);
        els.forEach((el) => {
          if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) el.checked = Array.isArray(v) ? v.includes(el.value) : v === el.value;
          else if (!k.startsWith("req_") && !k.startsWith("f_") && typeof v === "string") el.value = v;
        });
      }
      if (typeof data.budget === "string") setBudget(data.budget);
      if (typeof data.creatorSlots === "string") setSlots(data.creatorSlots);
      if (typeof data.target === "string") setTarget(data.target);
      setRestored(true);
    } catch {
      /* storage unavailable */
    }
  }, []);
  const save = () => {
    if (!form.current) return;
    const fd = new FormData(form.current);
    const out: Record<string, string | string[]> = {};
    for (const k of new Set(fd.keys())) {
      if (k === "intent") continue;
      const all = fd.getAll(k).map(String);
      out[k] = all.length > 1 || ["channels", "languages"].includes(k) ? all : (all[0] ?? "");
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(out));
      setSavedAt(new Date().toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }));
    } catch {
      /* ignore */
    }
  };

  const budgetMinor = Math.round((Number(budget.replace(/,/g, "")) || 0) * 100);

  return (
    <form ref={form} action={createCampaignAction} noValidate onInput={save} onSubmit={() => { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }} className="grid gap-8 lg:grid-cols-[220px_1fr]">
      <input type="hidden" name="back" value="/brand/campaigns/new" />
      <nav aria-label="Campaign builder steps" className="lg:sticky lg:top-20 lg:self-start">
        <ol className="flex gap-2 overflow-x-auto lg:flex-col">
          {STEPS.map((s, i) => (
            <li key={s}>
              <button type="button" onClick={() => setStep(i)} aria-current={step === i ? "step" : undefined}
                className={cx("flex w-full items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm", step === i ? "bg-white font-medium text-ink shadow-sm ring-1 ring-line" : "text-muted hover:text-ink")}>
                <span className={cx("tnum grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-semibold", i < step ? "bg-good text-white" : step === i ? "bg-accent text-white" : "bg-black/10 text-slate-600")}>{i < step ? "✓" : i + 1}</span>
                {s}
              </button>
            </li>
          ))}
        </ol>
        <p className="mt-3 hidden px-3 text-xs text-muted lg:block">{savedAt ? `Autosaved in this browser at ${savedAt}` : restored ? "Restored your unsaved draft" : "Changes autosave in this browser"}</p>
      </nav>

      <div className="min-w-0 space-y-8">
        {/* Step 1 */}
        <Card className={cx("p-5 sm:p-6", step !== 0 && "hidden")}>
          <h2 className="text-lg font-semibold">The brief</h2>
          <p className="mb-5 text-sm text-muted">Plain language works best. Creators see this before applying.</p>
          <div className="space-y-4">
            <Field label="Campaign title" htmlFor="title"><input id="title" name="title" required minLength={4} maxLength={120} placeholder="e.g. Monsoon Glow Serum launch" className={inputClass} /></Field>
            <Field label="Brief" htmlFor="brief" hint="What you're launching, the angle you want, and what success looks like."><textarea id="brief" name="brief" required minLength={20} rows={5} className={inputClass} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Objective" htmlFor="objective">
                <select id="objective" name="objective" className={inputClass} defaultValue="signups">
                  <option value="signups">Signups / leads</option>
                  <option value="sales">Sales</option>
                  <option value="installs">App installs</option>
                  <option value="awareness">Awareness</option>
                  <option value="ugc">UGC production</option>
                </select>
              </Field>
              <Field label="Category" htmlFor="niche">
                <select id="niche" name="niche" className={inputClass} defaultValue="Beauty">{NICHES.map((n) => <option key={n}>{n}</option>)}</select>
              </Field>
            </div>
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-ink-2">Channels</legend>
              <div className="flex flex-wrap gap-2">
                {CHANNELS.map((c) => (
                  <label key={c} className="inline-flex items-center gap-2 rounded-full border border-black/[0.07] bg-white/60 px-3.5 py-1.5 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent-50">
                    <input type="checkbox" name="channels" value={c} defaultChecked={c === "Instagram"} /> {c}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        </Card>

        {/* Step 2 */}
        <Card className={cx("p-5 sm:p-6", step !== 1 && "hidden")}>
          <h2 className="text-lg font-semibold">Audience & deliverables</h2>
          <p className="mb-5 text-sm text-muted">Due dates are counted from the campaign start date.</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Target cities" htmlFor="locations" hint="Comma-separated, or Pan-India"><input id="locations" name="locations" defaultValue="Pan-India" className={inputClass} /></Field>
            <Field label="Age range" htmlFor="ageRange"><input id="ageRange" name="ageRange" defaultValue="18–34" className={inputClass} /></Field>
            <Field label="Min. followers" htmlFor="minFollowers"><input id="minFollowers" name="minFollowers" inputMode="numeric" defaultValue="10000" className={inputClass} /></Field>
          </div>
          <fieldset className="mt-4">
            <legend className="mb-2 text-sm font-medium text-ink-2">Content languages</legend>
            <div className="flex flex-wrap gap-2">
              {LANGS.map((l) => (
                <label key={l} className="inline-flex items-center gap-2 rounded-full border border-black/[0.07] bg-white/60 px-3.5 py-1.5 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent-50">
                  <input type="checkbox" name="languages" value={l} defaultChecked={l === "English" || l === "Hindi"} /> {l}
                </label>
              ))}
            </div>
          </fieldset>
          <h3 className="mb-2 mt-6 text-sm font-semibold">Deliverables per creator</h3>
          <div className="space-y-3">
            {reqs.map((r, i) => (
              <div key={i} className="grid gap-2 rounded-2xl border border-line p-3 sm:grid-cols-[1fr_1fr_80px_100px_auto]">
                <input aria-label="Deliverable type" name="req_type" value={r.type} onChange={(e) => setReqs(reqs.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)))} className={inputClass} placeholder="Reel" />
                <select aria-label="Channel" name="req_channel" value={r.channel} onChange={(e) => setReqs(reqs.map((x, j) => (j === i ? { ...x, channel: e.target.value } : x)))} className={inputClass}>{CHANNELS.map((c) => <option key={c}>{c}</option>)}</select>
                <input aria-label="Quantity" name="req_qty" inputMode="numeric" value={r.qty} onChange={(e) => setReqs(reqs.map((x, j) => (j === i ? { ...x, qty: Number(e.target.value) || 0 } : x)))} className={inputClass} />
                <label className="flex items-center gap-1 text-xs text-muted">day <input aria-label="Due day" name="req_due" inputMode="numeric" value={r.due} onChange={(e) => setReqs(reqs.map((x, j) => (j === i ? { ...x, due: Number(e.target.value) || 0 } : x)))} className={inputClass} /></label>
                <button type="button" onClick={() => setReqs(reqs.filter((_, j) => j !== i))} disabled={reqs.length === 1} className="rounded-lg px-2 text-sm text-muted hover:text-bad disabled:opacity-40" aria-label="Remove deliverable">Remove</button>
                <input aria-label="Acceptance criteria" name="req_criteria" value={r.criteria} onChange={(e) => setReqs(reqs.map((x, j) => (j === i ? { ...x, criteria: e.target.value } : x)))} className={cx(inputClass, "sm:col-span-5")} placeholder="Acceptance criteria" />
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setReqs([...reqs, { type: "", channel: "Instagram", qty: 1, due: 7, criteria: "" }])} className="mt-3 text-sm font-medium text-accent">+ Add deliverable</button>
        </Card>

        {/* Step 3 */}
        <Card className={cx("p-5 sm:p-6", step !== 2 && "hidden")}>
          <h2 className="text-lg font-semibold">Compensation</h2>
          <p className="mb-5 text-sm text-muted">This formula is snapshotted into every agreement. Changing it later requires an amendment both sides accept.</p>
          <div className="mb-5 grid gap-4 sm:grid-cols-3">
            <Field label="Total budget (₹)" htmlFor="budget"><input id="budget" name="budget" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} className={cx(inputClass, "tnum")} /></Field>
            <Field label="Creator slots" htmlFor="creatorSlots"><input id="creatorSlots" name="creatorSlots" inputMode="numeric" value={slots} onChange={(e) => setSlots(e.target.value)} className={inputClass} /></Field>
            <Field label="Target outcomes per creator" htmlFor="target"><input id="target" name="target" inputMode="numeric" value={target} onChange={(e) => setTarget(e.target.value)} className={inputClass} /></Field>
          </div>
          <FormulaFields target={Number(target) || 100} budgetMinor={budgetMinor} slots={Number(slots) || 1} />
        </Card>

        {/* Step 4 */}
        <Card className={cx("p-5 sm:p-6", step !== 3 && "hidden")}>
          <h2 className="text-lg font-semibold">Measurement, rights & dates</h2>
          <p className="mb-5 text-sm text-muted">Define what counts before work starts. It prevents most disputes.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Primary metric" htmlFor="primaryMetric"><input id="primaryMetric" name="primaryMetric" defaultValue="Verified signups" className={inputClass} /></Field>
            <Field label="Source of truth" htmlFor="sourceOfTruth">
              <select id="sourceOfTruth" name="sourceOfTruth" className={inputClass}>
                <option value="brand_webhook">Signed brand webhook</option>
                <option value="csv_upload">CSV upload with event IDs</option>
                <option value="tracked_link">Tracked link clicks</option>
              </select>
            </Field>
          </div>
          <div className="mt-4 space-y-4">
            <Field label="What counts as a valid outcome?" htmlFor="validDefinition"><textarea id="validDefinition" name="validDefinition" rows={2} required defaultValue="New account with verified email, first-time customer, not cancelled within 24 hours" className={inputClass} /></Field>
            <Field label="Content usage rights" htmlFor="rights"><textarea id="rights" name="rights" rows={2} required defaultValue="Brand may repost organically for 90 days with credit. Paid amplification requires a separate fee." className={inputClass} /></Field>
            <Field label="Landing page" htmlFor="landingUrl" hint="Tracked links redirect here with campaign and creator IDs attached."><input id="landingUrl" name="landingUrl" type="url" required defaultValue="https://" className={inputClass} /></Field>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-4">
            <Field label="Start" htmlFor="startAt"><input id="startAt" name="startAt" type="date" required defaultValue={iso(7)} className={inputClass} /></Field>
            <Field label="End" htmlFor="endAt"><input id="endAt" name="endAt" type="date" required defaultValue={iso(28)} className={inputClass} /></Field>
            <Field label="Apply by" htmlFor="applyBy"><input id="applyBy" name="applyBy" type="date" defaultValue={iso(5)} className={inputClass} /></Field>
            <Field label="Visibility" htmlFor="visibility"><select id="visibility" name="visibility" className={inputClass}><option value="public">Public listing</option><option value="private">Invite only</option></select></Field>
          </div>
          <div className="mt-8"><Notice tone="info">Publishing checks that every material term is filled and that the budget covers the worst-case payout for all slots.</Notice></div>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} className="text-sm font-medium text-muted hover:text-ink disabled:opacity-40">← Back</button>
          <div className="flex flex-wrap gap-2">
            <SubmitButton name="intent" value="draft" variant="secondary" pendingLabel="Saving…">Save draft</SubmitButton>
            {step < STEPS.length - 1 ? (
              <button type="button" onClick={() => setStep(step + 1)} className="inline-flex h-10 items-center rounded-full bg-ink px-4 text-sm font-medium text-white hover:bg-accent-600">Continue</button>
            ) : (
              <SubmitButton name="intent" value="publish" pendingLabel="Publishing…">Publish campaign</SubmitButton>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
