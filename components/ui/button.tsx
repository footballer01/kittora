import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-brand text-brand-ink hover:bg-brand-600 active:bg-brand-700 shadow-[0_1px_0_0_rgb(255_255_255/0.25)_inset]",
  secondary: "border border-line-strong text-ink hover:border-ink hover:bg-surface active:bg-surface-2",
  ghost: "text-ink hover:bg-surface active:bg-surface-2",
};
const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-step-n1 gap-1.5",
  md: "h-11 px-5 text-[0.95rem] gap-2",
  lg: "h-13 px-7 text-step-0 gap-2.5",
};

export function buttonClass({ variant = "primary", size = "md", className }: { variant?: Variant; size?: Size; className?: string } = {}) {
  return cn(
    "inline-flex select-none items-center justify-center rounded-full font-semibold whitespace-nowrap transition-colors duration-150",
    "disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45",
    variants[variant],
    sizes[size],
    className,
  );
}

type Common = { variant?: Variant; size?: Size; icon?: ReactNode; iconEnd?: ReactNode; loading?: boolean };

export function Button({ variant, size, icon, iconEnd, loading, className, children, disabled, ...rest }: Common & ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={buttonClass({ variant, size, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner /> : icon}
      {children}
      {iconEnd}
    </button>
  );
}

export function ButtonLink({ variant, size, icon, iconEnd, className, children, ...rest }: Common & ComponentProps<typeof Link>) {
  return (
    <Link className={buttonClass({ variant, size, className })} {...rest}>
      {icon}
      {children}
      {iconEnd}
    </Link>
  );
}

export function IconButton({ label, className, children, ...rest }: { label: string } & ComponentProps<"button">) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        "relative inline-flex size-11 items-center justify-center rounded-full text-ink transition-colors hover:bg-surface active:bg-surface-2",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

function Spinner() {
  return <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />;
}
