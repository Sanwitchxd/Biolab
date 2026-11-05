import type { ReactNode } from "react";

interface ModuleCardProps {
  title: string;
  subtitle?: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  icon: ReactNode;
  /** Etiqueta roja opcional (p. ej. "3 por validar"). */
  badge?: string;
}

/**
 * Tarjeta de inicio de cada módulo. Es la MISMA para Recepción, Laboratorio y Gerencia:
 * cualquier cambio de color o forma se hace aquí (y en los tokens de styles/index.css).
 */
export default function ModuleCard({ title, subtitle, description, actionLabel, onAction, icon, badge }: ModuleCardProps) {
  return (
    <article className="relative flex min-h-56 flex-col rounded-2xl bg-card-blue p-5 text-white transition hover:-translate-y-0.5 hover:shadow-lg">
      {badge && <span className="absolute right-4 top-4 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-red-600">{badge}</span>}
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white/15">{icon}</div>
      <h2 className="text-sm font-bold">{title}</h2>
      {subtitle && <p className="text-xs font-medium text-white/80">{subtitle}</p>}
      <p className="mt-2 text-xs leading-relaxed text-white/75">{description}</p>
      <button type="button" onClick={onAction} className="mt-auto w-full rounded-xl border border-white/30 bg-white/15 px-3 py-2 text-sm font-semibold transition hover:bg-white/25">{actionLabel}</button>
    </article>
  );
}
