export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-tight text-ink ${className}`}>
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="9" fill="#4f46e5" />
        <path d="M10 21.5V10.5h6.2a4.3 4.3 0 0 1 0 8.6H13" stroke="#fff" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="21.5" cy="21.5" r="2.2" fill="#a5b4fc" />
      </svg>
      <span>Project Creator</span>
    </span>
  );
}
