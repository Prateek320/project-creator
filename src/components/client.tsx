"use client";

import { useActionState, useState, type ComponentProps } from "react";
import { rotateWebhookSecretAction } from "@/app/actions";
import { useFormStatus } from "react-dom";
import { buttonClass, cx } from "./ui";

/** Submit button with a pending state; prevents double submission. */
export function SubmitButton({
  variant = "primary",
  size = "md",
  className,
  children,
  pendingLabel,
  confirm,
  ...rest
}: ComponentProps<"button"> & { variant?: "primary" | "secondary" | "ghost" | "danger" | "success"; size?: "sm" | "md"; pendingLabel?: string; confirm?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || rest.disabled}
      aria-busy={pending}
      className={cx(buttonClass(variant, size), className)}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
      {...rest}
    >
      {pending ? (pendingLabel ?? "Working…") : children}
    </button>
  );
}

export function CopyButton({ value, label = "Copy", absolute = false }: { value: string; label?: string; absolute?: boolean }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={buttonClass("secondary", "sm")}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(absolute ? `${window.location.origin}${value}` : value);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard blocked: value stays visible to select manually */
        }
      }}
    >
      {done ? "Copied" : label}
    </button>
  );
}

/**
 * Share a tracked link: the native share sheet on phones (Instagram, WhatsApp…), copy elsewhere.
 * The link is the creator's daily tool, so it gets one obvious action.
 */
export function ShareButton({ path, text, className }: { path: string; text: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={cx(buttonClass("success", "md"), className)}
      onClick={async () => {
        const url = `${window.location.origin}${path}`;
        try {
          if (navigator.share) {
            await navigator.share({ url, text });
            return;
          }
          await navigator.clipboard.writeText(url);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* share cancelled or clipboard blocked: the link stays visible to copy by hand */
        }
      }}
    >
      {done ? "Link copied" : "Share link"}
    </button>
  );
}

/**
 * Webhook signing secret: generate or rotate, shown exactly once. The plaintext lives only in this
 * component's state until the page is left; the server stores it encrypted.
 */
export function RotateSecret({ hasSecret, rotatedAt }: { hasSecret: boolean; rotatedAt: string | null }) {
  const [state, action, pending] = useActionState(rotateWebhookSecretAction, null);
  return (
    <div className="rounded-xl border border-line bg-sunken p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-medium text-ink">Signing secret</div>
          <p className="text-xs text-muted">
            {state?.secret
              ? "Copy it now. It won't be shown again."
              : hasSecret
                ? `Stored encrypted${rotatedAt ? `, last rotated ${rotatedAt}` : ""}. Rotating keeps the old secret working for 24 hours.`
                : "No secret yet. Generate one to start sending events."}
          </p>
        </div>
        {!state?.secret && (
          <form action={action}>
            <button
              className={buttonClass("secondary", "sm")}
              disabled={pending}
              onClick={(e) => {
                if (hasSecret && !window.confirm("Rotate the signing secret? The current one keeps working for 24 hours.")) e.preventDefault();
              }}
            >
              {pending ? "Generating…" : hasSecret ? "Rotate secret" : "Generate secret"}
            </button>
          </form>
        )}
      </div>
      {state?.secret && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <code className="break-all rounded-md border border-dashed border-stamp-line bg-surface px-2.5 py-1.5 text-xs">{state.secret}</code>
          <CopyButton value={state.secret} />
        </div>
      )}
      {state?.error && <p role="alert" className="mt-2 text-xs text-bad">{state.error}</p>}
    </div>
  );
}
