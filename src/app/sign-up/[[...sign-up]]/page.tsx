import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { clerkEnabled } from "@/components/auth-provider";
import { Logo } from "@/components/logo";

export const metadata = { title: "Create your account" };

export default function SignUpPage() {
  if (!clerkEnabled()) notFound();
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-12">
      <Link href="/" aria-label="proovd home">
        <Logo size={30} />
      </Link>
      <Suspense>
        <SignUp fallbackRedirectUrl="/onboarding" />
      </Suspense>
    </main>
  );
}
