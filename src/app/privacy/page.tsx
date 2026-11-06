import Link from "next/link";
import { Logo } from "@/components/logo";
import { NOTICE_VERSION, RESPONSE_DAYS } from "@/server/privacy";

export const metadata = { title: "Privacy notice" };

/**
 * DRAFT pending legal review (docs/backend-plan.md, Phase 0 item 7). Keep in step with what the code does;
 * bump NOTICE_VERSION in src/server/privacy.ts when the substance changes.
 */
export default function Privacy() {
  const contact = process.env.PRIVACY_CONTACT_EMAIL;
  const h2 = "mt-10 text-lg font-semibold";
  return (
    <div className="min-h-dvh">
      <main id="main" className="mx-auto max-w-2xl px-4 py-10 leading-relaxed sm:py-16">
        <Link href="/" aria-label="proovd home"><Logo /></Link>
        <h1 className="mt-10 text-[28px] font-bold tracking-[-0.02em]">Privacy notice</h1>
        <p className="mt-1 text-sm text-muted">Version {NOTICE_VERSION}</p>

        <h2 className={h2}>What we collect</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>Account details: name, email address and sign-in data (handled by our sign-in provider).</li>
          <li>Creators: profile, niches, rates, social handles and audience numbers you enter or connect, portfolio links, applications and submitted content links.</li>
          <li>Brands: organisation details, team members, campaigns and the conversion events your systems send us.</li>
          <li>Money records: agreements, settlements, payouts and the ledger behind them.</li>
          <li>Security records: an audit trail of actions taken in the product.</li>
        </ul>

        <h2 className={h2}>Why</h2>
        <p className="mt-3">To run your account and collaborations, calculate and pay settlements, prevent fraud, keep records the law requires, and send you emails about activity on your account. Product news emails are optional and only sent if you agree.</p>

        <h2 className={h2}>Where it is stored and who processes it</h2>
        <p className="mt-3">Your data is stored in Singapore. Service providers process it on our behalf: Neon (database), Vercel (hosting), Clerk (sign-in), Resend (email) and Sentry (error monitoring). They may only use it to provide their service to us.</p>

        <h2 className={h2}>How long we keep it</h2>
        <p className="mt-3">While your account is open. When you delete your account we remove or anonymise your personal details. Agreements, settlements, payouts, the ledger and the audit trail are kept, linked to an anonymous id, for as long as tax and accounting law requires.</p>

        <h2 className={h2}>Your rights</h2>
        <p className="mt-3">From Settings → Privacy you can download your data, change your email preferences and delete your account. We respond to requests within {RESPONSE_DAYS} days. If you still have open collaborations, pending payouts or disputes, deletion waits until they are settled.</p>

        <h2 className={h2}>Contact</h2>
        <p className="mt-3">{contact ? <>Questions or complaints: <a className="font-semibold text-accent" href={`mailto:${contact}`}>{contact}</a>.</> : "Questions or complaints: contact us through Settings → Privacy."}</p>
      </main>
    </div>
  );
}
