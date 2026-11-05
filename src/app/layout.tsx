import type { Metadata, Viewport } from "next";
import "@fontsource-variable/plus-jakarta-sans";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "proovd · Proof you can see. Performance you get paid for.", template: "%s · proovd" },
  description: "The operating system for creator–brand partnerships: clear terms, verified outcomes, dependable payouts.",
};
export const viewport: Viewport = { themeColor: "#f6f7f9", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body className="min-h-dvh font-sans">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:shadow">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
