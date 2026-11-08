"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Icon, type IconName } from "./icons";
import { cn } from "@/lib/format";

// ── Card ─────────────────────────────────────────────────────────────
export function Card({
  className,
  children,
  accent,
  as: Tag = "section",
  ...rest
}: React.HTMLAttributes<HTMLElement> & { accent?: boolean; as?: "section" | "div" | "article" }) {
  return (
    <Tag className={cn("card", accent && "card-accent", className)} {...rest}>
      {children}
    </Tag>
  );
}

export function CardHeader({
  title,
  subtitle,
  icon,
  action,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: IconName;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div className="flex min-w-0 items-center gap-2.5">
        {icon && (
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/15 text-highlight">
            <Icon name={icon} size={16} />
          </span>
        )}
        <div className="min-w-0">
          <h3 className="card-title truncate">{title}</h3>
          {subtitle && <p className="mt-0.5 truncate text-xs text-muted">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex shrink-0 items-center gap-1.5">{action}</div>}
    </div>
  );
}

// ── Buttons ──────────────────────────────────────────────────────────
type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "primary" | "ghost" | "danger";
  size?: "md" | "sm";
  icon?: IconName;
  iconOnly?: boolean;
  loading?: boolean;
};
export const Button = React.forwardRef<HTMLButtonElement, BtnProps>(function Button(
  { variant = "default", size = "md", icon, iconOnly, loading, className, children, type = "button", disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        "btn",
        variant === "primary" && "btn-primary",
        variant === "ghost" && "btn-ghost",
        variant === "danger" && "btn-danger",
        size === "sm" && "btn-sm",
        iconOnly && "btn-icon",
        className,
      )}
      {...rest}
    >
      {loading ? <Icon name="LoaderCircle" size={size === "sm" ? 14 : 16} className="animate-spin" /> : icon && <Icon name={icon} size={size === "sm" ? 14 : 16} />}
      {children}
    </button>
  );
});

// ── Form fields ──────────────────────────────────────────────────────
export function Field({ label, hint, error, children, className }: { label: string; hint?: React.ReactNode; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="label">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-xs text-danger">{error}</span> : hint ? <span className="mt-1 block text-xs text-subtle">{hint}</span> : null}
    </label>
  );
}

export function Select({ options, className, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement> & { options: readonly (string | { value: string; label: string })[] }) {
  return (
    <select className={cn("input", className)} {...rest}>
      {options.map((o) => {
        const v = typeof o === "string" ? o : o.value;
        const l = typeof o === "string" ? o : o.label;
        return (
          <option key={v} value={v}>
            {l}
          </option>
        );
      })}
    </select>
  );
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label?: string; description?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-4 text-left">
      {(label || description) && (
        <span className="min-w-0">
          {label && <span className="block text-sm font-medium">{label}</span>}
          {description && <span className="mt-0.5 block text-xs text-muted">{description}</span>}
        </span>
      )}
      <span className={cn("relative h-6 w-11 shrink-0 rounded-full border transition-colors", checked ? "border-primary bg-primary" : "border-line-strong bg-bg2")}>
        <span className={cn("absolute top-0.5 size-[18px] rounded-full bg-white shadow transition-all", checked ? "left-[22px]" : "left-0.5")} />
      </span>
    </button>
  );
}

export function Segmented<T extends string>({ value, onChange, options, className, size }: { value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode }[]; className?: string; size?: "sm" }) {
  return (
    <div className={cn("seg", className)} role="tablist">
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={value === o.value} data-active={value === o.value} onClick={() => onChange(o.value)} className={size === "sm" ? "!h-7 !px-2.5 !text-xs" : ""}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ── Indicators ───────────────────────────────────────────────────────
export function ProgressBar({ value, color, className, height = 6, track }: { value: number; color?: string; className?: string; height?: number; track?: string }) {
  const v = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return (
    <div className={cn("w-full overflow-hidden rounded-full", className)} style={{ height, background: track ?? "rgb(148 163 184 / 0.12)" }}>
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-out"
        style={{ width: `${v}%`, background: color ?? "linear-gradient(90deg, var(--color-primary), var(--color-accent))" }}
      />
    </div>
  );
}

export function Ring({ value, size = 64, stroke = 7, color, children, track }: { value: number; size?: number; stroke?: number; color?: string; children?: React.ReactNode; track?: string }) {
  const v = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const gid = React.useId().replace(/:/g, "");
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={`rg${gid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#2563EB" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track ?? "rgb(148 163 184 / 0.14)"} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color ?? `url(#rg${gid})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v / 100)}
          style={{ transition: "stroke-dashoffset 0.8s ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

export function Pill({ color, children, className, solid }: { color: string; children: React.ReactNode; className?: string; solid?: boolean }) {
  return (
    <span className={cn("badge", className)} style={solid ? { background: color, color: "#fff" } : { color, background: `${color}1f`, borderColor: `${color}40` }}>
      {children}
    </span>
  );
}

export function Dot({ color, className }: { color: string; className?: string }) {
  return <span className={cn("inline-block size-2 shrink-0 rounded-full", className)} style={{ background: color }} />;
}

export function DemoBadge({ show }: { show?: boolean }) {
  if (!show) return null;
  return (
    <span className="demo-badge" title="Data contoh — bisa dihapus di Pengaturan">
      DEMO
    </span>
  );
}

export function EmptyState({ icon = "Inbox", title, description, action, className }: { icon?: IconName; title: string; description?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-10 text-center", className)}>
      <div className="mb-3 grid size-12 place-items-center rounded-2xl border border-line bg-elevated text-muted">
        <Icon name={icon} size={22} />
      </div>
      <p className="text-sm font-semibold">{title}</p>
      {description && <p className="mt-1 max-w-xs text-xs text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function StatTile({
  label,
  value,
  icon,
  color = "#60A5FA",
  sub,
  className,
  children,
}: {
  label: string;
  value: React.ReactNode;
  icon: IconName;
  color?: string;
  sub?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("card card-hover p-4", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted">{label}</span>
        <span className="grid size-7 place-items-center rounded-lg" style={{ background: `${color}1c`, color }}>
          <Icon name={icon} size={15} />
        </span>
      </div>
      <div className="tabular mt-2 text-[1.35rem] font-semibold tracking-tight">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
      {children}
    </div>
  );
}

// ── Modal / Sheet ────────────────────────────────────────────────────
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: IconName;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open || !mounted) return null;
  const width = { sm: "sm:max-w-md", md: "sm:max-w-xl", lg: "sm:max-w-3xl", xl: "sm:max-w-5xl" }[size];
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 animate-fade-in bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={cn("relative flex max-h-[92dvh] w-full animate-slide-up flex-col overflow-hidden rounded-t-3xl border border-line-strong bg-card shadow-[var(--shadow-pop)] sm:rounded-3xl", width)}>
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            {icon && (
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-highlight">
                <Icon name={icon} size={18} />
              </span>
            )}
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold tracking-tight">{title}</h2>
              {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-sm btn-icon -mr-1" aria-label="Tutup">
            <Icon name="X" size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-bg2/40 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

// ── Dropdown menu ────────────────────────────────────────────────────
export function Menu({ trigger, items, align = "right" }: { trigger: (open: () => void) => React.ReactNode; items: { label: string; icon?: IconName; onClick: () => void; danger?: boolean }[]; align?: "left" | "right" }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      {trigger(() => setOpen((o) => !o))}
      {open && (
        <div className={cn("absolute top-full z-50 mt-1.5 min-w-44 animate-slide-up rounded-xl border border-line-strong bg-elevated p-1 shadow-[var(--shadow-pop)]", align === "right" ? "right-0" : "left-0")}>
          {items.map((it) => (
            <button
              key={it.label}
              onClick={() => {
                setOpen(false);
                it.onClick();
              }}
              className={cn("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-white/5", it.danger ? "text-danger" : "text-fg")}
            >
              {it.icon && <Icon name={it.icon} size={15} className={it.danger ? "" : "text-muted"} />}
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[1.65rem]">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}
