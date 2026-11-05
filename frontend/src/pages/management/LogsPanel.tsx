import { useMemo, useState } from "react";
import { Button, Field, Input, Select, Workspace } from "../../components/ui/FormControls";
import { dayKey, LOG_KINDS, monthKey, timeLabel, dateLabel, type LogEntry, type StaffUser } from "./data";

type PeriodMode = "all" | "today" | "yesterday" | "day" | "month" | "range";
const PAGE_SIZE = 20;

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

interface Props { logs: LogEntry[]; users: StaffUser[]; now: Date; onClose: () => void }

export default function LogsPanel({ logs, users, now, onClose }: Props) {
  const [module, setModule] = useState("Todos");
  const [period, setPeriod] = useState<PeriodMode>("all");
  const [day, setDay] = useState(dayKey(now));
  const [month, setMonth] = useState(monthKey(now));
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [user, setUser] = useState("Todos");
  const [kind, setKind] = useState("Todos");
  const [patient, setPatient] = useState("");
  const [patientId, setPatientId] = useState("");
  const [folio, setFolio] = useState("");
  const [text, setText] = useState("");
  const [newestFirst, setNewestFirst] = useState(true);
  const [page, setPage] = useState(1);

  const todayKey = dayKey(now);
  const yesterdayKey = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));

  const filtered = useMemo(() => {
    const result = logs.filter((log) => {
      const k = dayKey(log.at);
      if (module !== "Todos" && log.module !== module) return false;
      if (period === "today" && k !== todayKey) return false;
      if (period === "yesterday" && k !== yesterdayKey) return false;
      if (period === "day" && day && k !== day) return false;
      if (period === "month" && month && monthKey(log.at) !== month) return false;
      if (period === "range") { if (from && k < from) return false; if (to && k > to) return false; }
      if (user !== "Todos" && log.user !== user) return false;
      if (kind !== "Todos" && log.kind !== kind) return false;
      if (patient && !norm(log.patientName ?? "").includes(norm(patient))) return false;
      if (patientId && !norm(log.patientId ?? "").includes(norm(patientId))) return false;
      if (folio && !norm(log.folio ?? "").includes(norm(folio))) return false;
      if (text && !norm(`${log.action} ${log.user}`).includes(norm(text))) return false;
      return true;
    });
    return result.sort((a, b) => (newestFirst ? b.at.getTime() - a.at.getTime() : a.at.getTime() - b.at.getTime()));
  }, [logs, module, period, day, month, from, to, user, kind, patient, patientId, folio, text, newestFirst, todayKey, yesterdayKey]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const rows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  // Cualquier cambio de filtro regresa a la primera página.
  const f = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setPage(1); };

  const activeFilters = [
    module !== "Todos" && `Módulo: ${module}`,
    period !== "all" && `Periodo: ${{ today: "Hoy", yesterday: "Ayer", day: day, month: month, range: `${from || "…"} → ${to || "…"}`, all: "" }[period]}`,
    user !== "Todos" && `Usuario: ${user}`,
    kind !== "Todos" && `Tipo: ${kind}`,
    patient && `Paciente: ${patient}`,
    patientId && `ID paciente: ${patientId}`,
    folio && `Folio: ${folio}`,
    text && `Texto: ${text}`,
  ].filter(Boolean) as string[];

  const clear = () => {
    setModule("Todos"); setPeriod("all"); setDay(todayKey); setMonth(monthKey(now)); setFrom(""); setTo("");
    setUser("Todos"); setKind("Todos"); setPatient(""); setPatientId(""); setFolio(""); setText(""); setPage(1);
  };

  const exportCsv = () => {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = [["Fecha", "Hora", "Usuario", "Módulo", "Tipo", "Actividad", "Folio", "ID paciente", "Paciente"].join(",")].concat(
      filtered.map((l) => [dayKey(l.at), timeLabel(l.at, true), l.user, l.module, l.kind, l.action, l.folio ?? "", l.patientId ?? "", l.patientName ?? ""].map(esc).join(",")),
    );
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `bitacora-${todayKey}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Workspace title="Bitácora de auditoría" subtitle="Eventos protegidos de modificación · Solo lectura (inmutable)" onClose={onClose}>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Filtrar por módulo">
          <Select value={module} onChange={(e) => f(setModule)(e.target.value)}><option>Todos</option><option>Recepción</option><option>Laboratorio</option><option>Gerencia</option></Select>
        </Field>
        <Field label="Periodo">
          <Select value={period} onChange={(e) => f(setPeriod)(e.target.value as PeriodMode)}>
            <option value="all">Todo el historial</option><option value="today">Hoy</option><option value="yesterday">Ayer</option>
            <option value="day">Por día…</option><option value="month">Por mes…</option><option value="range">Rango de fechas…</option>
          </Select>
        </Field>
        {period === "day" && <Field label="Día"><Input type="date" value={day} max={todayKey} onChange={(e) => f(setDay)(e.target.value)} /></Field>}
        {period === "month" && <Field label="Mes"><Input type="month" value={month} max={monthKey(now)} onChange={(e) => f(setMonth)(e.target.value)} /></Field>}
        {period === "range" && (
          <>
            <Field label="Desde"><Input type="date" value={from} max={to || todayKey} onChange={(e) => f(setFrom)(e.target.value)} /></Field>
            <Field label="Hasta"><Input type="date" value={to} min={from} max={todayKey} onChange={(e) => f(setTo)(e.target.value)} /></Field>
          </>
        )}
        <Field label="Usuario responsable">
          <Select value={user} onChange={(e) => f(setUser)(e.target.value)}><option>Todos</option>{users.map((u) => <option key={u.id}>{u.name}</option>)}</Select>
        </Field>
        <Field label="Tipo de actividad">
          <Select value={kind} onChange={(e) => f(setKind)(e.target.value)}><option>Todos</option>{LOG_KINDS.map((k) => <option key={k}>{k}</option>)}</Select>
        </Field>
        <Field label="Paciente (nombre)"><Input value={patient} onChange={(e) => f(setPatient)(e.target.value)} placeholder="Ej. Ana Martínez" /></Field>
        <Field label="ID de paciente"><Input value={patientId} onChange={(e) => f(setPatientId)(e.target.value)} placeholder="Ej. P-1048" /></Field>
        <Field label="Folio de orden"><Input value={folio} onChange={(e) => f(setFolio)(e.target.value)} placeholder="Ej. LMT-20261031" /></Field>
        <Field label="Buscar en actividad"><Input value={text} onChange={(e) => f(setText)(e.target.value)} placeholder="Ej. validó, pago…" /></Field>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" onClick={clear}>Limpiar filtros</Button>
        <Button type="button" variant="secondary" onClick={() => setNewestFirst((v) => !v)}>{newestFirst ? "Más recientes primero ↓" : "Más antiguos primero ↑"}</Button>
        <Button type="button" variant="secondary" onClick={exportCsv} disabled={filtered.length === 0}>Exportar CSV</Button>
        <span className="ml-auto text-xs text-slate-500">{filtered.length.toLocaleString("es-MX")} registro(s)</span>
      </div>

      {activeFilters.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">{activeFilters.map((chip) => <span key={chip} className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700">{chip}</span>)}</div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr><th className="px-4 py-3">Fecha y hora</th><th className="px-4 py-3">Usuario</th><th className="px-4 py-3">Módulo</th><th className="px-4 py-3">Actividad</th><th className="px-4 py-3">Paciente / Folio</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((log) => (
              <tr key={log.id}>
                <td className="whitespace-nowrap px-4 py-3 text-slate-500">{dateLabel(log.at)} · {timeLabel(log.at)}</td>
                <td className="px-4 py-3 font-medium text-slate-700">{log.user}</td>
                <td className="px-4 py-3"><span className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-600">{log.module}</span></td>
                <td className="px-4 py-3 text-slate-600">{log.action}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{log.patientName ? <><span className="font-medium text-slate-700">{log.patientName}</span> · {log.patientId}<br />{log.folio}</> : "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-400">No hay registros con estos filtros.</td></tr>}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
          <span>Página {current} de {pages}</span>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" disabled={current === 1} onClick={() => setPage(current - 1)}>Anterior</Button>
            <Button type="button" variant="secondary" disabled={current === pages} onClick={() => setPage(current + 1)}>Siguiente</Button>
          </div>
        </div>
      )}
    </Workspace>
  );
}
