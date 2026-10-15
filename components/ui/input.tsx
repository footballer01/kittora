import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type FieldProps = { label: string; hint?: ReactNode; error?: string; className?: string };

const control =
  "w-full rounded-[var(--radius-input)] border bg-surface px-4 text-ink placeholder:text-ink-muted/80 transition-colors " +
  "hover:border-ink-muted focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-0 " +
  "disabled:opacity-50 aria-invalid:border-brand-text";

function Field({ id, label, hint, error, className, children }: FieldProps & { id: string; children: ReactNode }) {
  return (
    <div className={cn("grid content-start gap-1.5", className)}>
      <label htmlFor={id} className="text-step-n1 font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-step-n1 text-brand-text">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-step-n1 text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function TextField({ label, hint, error, className, ...rest }: FieldProps & Omit<ComponentProps<"input">, "className">) {
  const id = useId();
  return (
    <Field id={id} label={label} hint={hint} error={error} className={className}>
      <input
        id={id}
        className={cn(control, "h-12", error ? "border-brand-text" : "border-line-strong")}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        {...rest}
      />
    </Field>
  );
}

export function SelectField({
  label,
  hint,
  error,
  className,
  children,
  ...rest
}: FieldProps & Omit<ComponentProps<"select">, "className">) {
  const id = useId();
  return (
    <Field id={id} label={label} hint={hint} error={error} className={className}>
      <div className="relative">
        <select
          id={id}
          className={cn(control, "h-12 appearance-none pr-10", error ? "border-brand-text" : "border-line-strong")}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          {...rest}
        >
          {children}
        </select>
        <svg className="pointer-events-none absolute top-1/2 right-4 size-4 -translate-y-1/2 text-ink-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
    </Field>
  );
}

export function TextArea({ label, hint, error, className, ...rest }: FieldProps & Omit<ComponentProps<"textarea">, "className">) {
  const id = useId();
  return (
    <Field id={id} label={label} hint={hint} error={error} className={className}>
      <textarea
        id={id}
        rows={4}
        className={cn(control, "py-3", error ? "border-brand-text" : "border-line-strong")}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        {...rest}
      />
    </Field>
  );
}
