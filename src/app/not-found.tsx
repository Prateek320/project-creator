import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main" className="mx-auto grid min-h-[60dvh] max-w-md place-items-center px-4 text-center">
      <div>
        <div className="text-sm font-semibold text-accent">404</div>
        <h1 className="mt-2 text-2xl font-semibold">Not found — or not yours to see</h1>
        <p className="mt-2 text-muted">It may have been removed, or it belongs to another workspace.</p>
        <Link href="/" className="mt-6 inline-block font-medium text-accent">Go home →</Link>
      </div>
    </main>
  );
}
