"use client";

import { useState, type ComponentProps } from "react";
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
