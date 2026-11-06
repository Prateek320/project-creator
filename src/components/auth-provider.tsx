/**
 * Clerk is on only when its keys are configured. The zero-setup demo and CI have no Clerk keys
 * and sign in through the demo account picker instead, so they must not need them.
 */
import { ClerkProvider } from "@clerk/nextjs";
import type { ReactNode } from "react";

export const clerkEnabled = () => Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);

export function AuthProvider({ children }: { children: ReactNode }) {
  if (!clerkEnabled()) return <>{children}</>;
  return (
    <ClerkProvider
      appearance={{
        // Clerk's components in proovd's tokens: stamp violet accent, carbon ink, Jakarta type.
        variables: {
          colorPrimary: "#5e2b8c",
          colorForeground: "#181b2c",
          colorMutedForeground: "#5b6075",
          colorBackground: "#ffffff",
          colorInput: "#ffffff",
          colorBorder: "#dadde4",
          colorRing: "#5e2b8c",
          colorDanger: "#b02a22",
          colorSuccess: "#0f6e4a",
          fontFamily: "var(--font-sans)",
          borderRadius: "10px",
        },
      }}
    >
      {children}
    </ClerkProvider>
  );
}
