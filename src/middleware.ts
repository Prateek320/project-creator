/**
 * Clerk middleware makes the session available to auth() everywhere. It stays bare: each page,
 * route handler and server action checks access itself (through getActor), as Clerk recommends
 * for @clerk/nextjs 7. Without Clerk keys (zero-setup demo, CI) it is a pass-through.
 */
import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

const clerk = clerkMiddleware();
const enabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  return enabled ? clerk(req, event) : NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
