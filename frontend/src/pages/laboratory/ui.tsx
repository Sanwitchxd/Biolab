import type { ReactNode } from "react";

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="mb-5 flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5h.01" /></svg>
      {children}
    </div>
  );
}

export function Pill({ className, children }: { className: string; children: ReactNode }) {
  return <span className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-semibold ${className}`}>{children}</span>;
}

export const ALERT_STYLE = {
  info: "border-blue-100 bg-blue-50 text-blue-800",
  warning: "border-amber-100 bg-amber-50 text-amber-800",
  danger: "border-red-100 bg-red-50 text-red-800",
} as const;
