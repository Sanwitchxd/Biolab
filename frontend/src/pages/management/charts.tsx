// Gráficas SVG ligeras (sin dependencias externas).
import { useState } from "react";
import { money } from "./data";

export const CHART_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EF4444", "#06B6D4"];

export interface Datum { label: string; value: number; color?: string }

export function BarChart({ data, height = 180, formatValue = money, color = "#60A5FA" }: { data: Datum[]; height?: number; formatValue?: (v: number) => string; color?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const dense = data.length > 14;
  return (
    <div>
      <div className="relative flex items-end gap-1 border-b border-slate-200 px-1" style={{ height }}>
        {data.map((d, i) => (
          <div key={`${d.label}-${i}`} className="group relative flex h-full flex-1 flex-col justify-end" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            {hover === i && (
              <div className="absolute -top-1 left-1/2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg bg-slate-800 px-2.5 py-1.5 text-[11px] font-medium text-white shadow-lg">
                {d.label}: {formatValue(d.value)}
              </div>
            )}
            <div className="w-full rounded-t-md transition-opacity" style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value > 0 ? 2 : 0, background: d.color ?? color, opacity: hover === null || hover === i ? 1 : 0.55 }} />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1 px-1">
        {data.map((d, i) => (
          <span key={`${d.label}-l-${i}`} className="flex-1 truncate text-center text-[10px] text-slate-400">{dense && i % Math.ceil(data.length / 10) !== 0 ? "" : d.label}</span>
        ))}
      </div>
    </div>
  );
}

export function DonutChart({ data, size = 170, centerLabel, formatValue = money }: { data: Datum[]; size?: number; centerLabel?: string; formatValue?: (v: number) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const r = 62;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex flex-wrap items-center justify-center gap-6">
      <svg width={size} height={size} viewBox="0 0 160 160" role="img" aria-label="Gráfica de pastel">
        <g transform="rotate(-90 80 80)">
          <circle cx="80" cy="80" r={r} fill="none" stroke="#F1F5F9" strokeWidth="26" />
          {total > 0 && data.map((d, i) => {
            const len = (d.value / total) * c;
            const el = (
              <circle key={d.label} cx="80" cy="80" r={r} fill="none" stroke={d.color ?? CHART_COLORS[i % CHART_COLORS.length]}
                strokeWidth={hover === i ? 30 : 26} strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset}
                onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} style={{ transition: "stroke-width .15s", opacity: hover === null || hover === i ? 1 : 0.6 }} />
            );
            offset += len;
            return el;
          })}
        </g>
        <text x="80" y="76" textAnchor="middle" className="fill-slate-800" fontSize="15" fontWeight="700">
          {hover !== null ? `${Math.round((data[hover].value / total) * 100)}%` : formatValue(total)}
        </text>
        <text x="80" y="93" textAnchor="middle" className="fill-slate-400" fontSize="9">{hover !== null ? data[hover].label : centerLabel ?? "Total"}</text>
      </svg>
      <ul className="space-y-2 text-xs">
        {data.map((d, i) => (
          <li key={d.label} className="flex items-center gap-2" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color ?? CHART_COLORS[i % CHART_COLORS.length] }} />
            <span className="text-slate-600">{d.label}</span>
            <span className="ml-auto pl-3 font-semibold text-slate-800">{formatValue(d.value)}</span>
            <span className="w-9 text-right text-slate-400">{total > 0 ? Math.round((d.value / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HBars({ data, formatValue = money }: { data: Datum[]; formatValue?: (v: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="space-y-2.5">
      {data.map((d, i) => (
        <li key={d.label} className="text-xs">
          <div className="mb-1 flex justify-between"><span className="text-slate-600">{d.label}</span><span className="font-semibold text-slate-800">{formatValue(d.value)}</span></div>
          <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full" style={{ width: `${(d.value / max) * 100}%`, background: d.color ?? CHART_COLORS[i % CHART_COLORS.length] }} /></div>
        </li>
      ))}
    </ul>
  );
}

export function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-100 p-5">
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      {subtitle && <p className="mb-4 text-xs text-slate-500">{subtitle}</p>}
      {!subtitle && <div className="mb-4" />}
      {children}
    </div>
  );
}
