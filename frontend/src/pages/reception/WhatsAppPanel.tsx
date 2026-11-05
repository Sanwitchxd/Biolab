import { useCallback, useEffect, useState } from "react";
import { Button, Notice, Workspace } from "../../components/ui/FormControls";
import { api } from "../../services/api";
import { dateTimeLabel } from "../../utils/format";

type Estado = "Pendiente" | "Enviado" | "Fallido" | "Cancelado";
interface Raw {
  id_wa: number; folio: string | null; paciente: string; telefono: string; tipo: string; cuerpo: string; programado_para: string;
  estado: Estado; intentos: number; error: string | null; fecha_envio: string | null; vencido: boolean; enlace: string;
}

const ESTADO_STYLE: Record<Estado, string> = {
  Pendiente: "bg-amber-100 text-amber-700", Enviado: "bg-emerald-100 text-emerald-700", Fallido: "bg-red-100 text-red-700", Cancelado: "bg-slate-100 text-slate-500",
};

/** Cola de WhatsApp: recordatorios, preparación, resultados listos y mensajes manuales. */
export default function WhatsAppPanel({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<Raw[]>([]);
  const [auto, setAuto] = useState(false);
  const [filter, setFilter] = useState<"pendientes" | "todos">("pendientes");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await api<{ proveedor: "manual" | "cloudapi"; mensajes: Raw[] }>("/recepcion/whatsapp");
      setRows(r.mensajes); setAuto(r.proveedor === "cloudapi"); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo cargar la cola de WhatsApp."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 20_000);
    return () => clearInterval(t);
  }, [load]);

  const mark = async (id: number, estado: "Enviado" | "Fallido" | "Cancelado") => {
    setError(""); setNotice("");
    try { await api(`/recepcion/whatsapp/${id}`, { method: "PATCH", body: { estado } }); setNotice(estado === "Enviado" ? "Mensaje marcado como enviado." : estado === "Cancelado" ? "Mensaje cancelado." : "Mensaje marcado como fallido."); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo actualizar el mensaje."); }
  };

  const visible = filter === "pendientes" ? rows.filter((r) => r.estado === "Pendiente" || r.estado === "Fallido") : rows;
  const due = rows.filter((r) => r.estado === "Pendiente" && r.vencido).length;

  return (
    <Workspace title="WhatsApp" subtitle="Recordatorios, indicaciones de preparación y avisos de resultados para pacientes que autorizaron WhatsApp" onClose={onClose}>
      {notice && <Notice>{notice}</Notice>}
      {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{error}</p>}
      <p className={`mb-4 rounded-xl px-4 py-3 text-xs ${auto ? "bg-emerald-50 text-emerald-800" : "bg-sky-50 text-sky-800"}`}>
        {auto
          ? "Envío automático activo: el servidor entrega los mensajes pendientes cuando llega su hora."
          : "Modo manual: cuando llegue la hora de un mensaje, pulsa «Abrir WhatsApp» (se abre el chat con el texto ya escrito), envíalo y márcalo como enviado."}
        {" "}{due > 0 && <b>Tienes {due} mensaje{due === 1 ? "" : "s"} por enviar ahora.</b>}
      </p>

      <div className="mb-4 flex gap-2">
        {(["pendientes", "todos"] as const).map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)} className={`rounded-full px-4 py-1.5 text-xs font-semibold ${filter === f ? "bg-blue-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{f === "pendientes" ? "Por enviar" : "Historial completo"}</button>
        ))}
        <Button type="button" variant="secondary" className="!ml-auto !px-3 !py-1.5 !text-xs" onClick={() => void load()}>Actualizar</Button>
      </div>

      <ul className="space-y-3">
        {visible.map((m) => (
          <li key={m.id_wa} className={`rounded-xl border p-4 ${m.estado === "Pendiente" && m.vencido ? "border-amber-300 bg-amber-50/50" : "border-slate-200"}`}>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-bold text-slate-800">{m.paciente}</p>
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-600">{m.tipo}</span>
              {m.folio && <span className="text-[11px] text-slate-400">{m.folio}</span>}
              <span className={`ml-auto rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${ESTADO_STYLE[m.estado]}`}>{m.estado === "Pendiente" && !m.vencido ? "Programado" : m.estado}</span>
            </div>
            <p className="mt-2 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{m.cuerpo}</p>
            <p className="mt-2 text-[11px] text-slate-400">
              Tel. {m.telefono} · Para enviar el {dateTimeLabel(new Date(m.programado_para))}
              {m.fecha_envio && ` · Enviado ${dateTimeLabel(new Date(m.fecha_envio))}`}{m.error && ` · Error: ${m.error}`}
            </p>
            {(m.estado === "Pendiente" || m.estado === "Fallido") && (
              <div className="mt-3 flex flex-wrap gap-2">
                {!auto && <a href={m.enlace} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-600">Abrir WhatsApp</a>}
                {!auto && <Button type="button" variant="secondary" className="!px-4 !py-2 !text-xs" onClick={() => void mark(m.id_wa, "Enviado")}>Marcar como enviado</Button>}
                <Button type="button" variant="danger" className="!px-4 !py-2 !text-xs" onClick={() => void mark(m.id_wa, "Cancelado")}>Cancelar</Button>
              </div>
            )}
          </li>
        ))}
        {!loading && visible.length === 0 && <li className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">{filter === "pendientes" ? "No hay mensajes por enviar." : "Aún no hay mensajes de WhatsApp."}</li>}
      </ul>
    </Workspace>
  );
}
