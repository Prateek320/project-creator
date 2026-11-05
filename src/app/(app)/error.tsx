"use client";
export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div role="alert" className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-muted">Nothing was changed. Try again — if it keeps happening, operations has the error logged.</p>
      <button onClick={reset} className="mt-8 rounded-full bg-ink px-4 py-2 text-sm font-medium text-white">Try again</button>
    </div>
  );
}
