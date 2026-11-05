// Convierte GET /api/laboratorio/datos (columnas de MySQL) al modelo de la interfaz del laboratorio.
import { evaluarReferencia } from "../../utils/reference";
import type { Incident, IncidentType, LabService, Order, OrderStatus, Patient, ResultStatus, Sample, SampleState } from "./data";

export interface RawLab {
  yo: { id: number; nombre: string };
  ordenes: { id_orden: number; folio: string; id_paciente: number; fecha_registro: string; estado: OrderStatus }[];
  pacientes: { id_paciente: number; nombre_completo: string }[];
  detalles: { id_detalle: number; id_orden: number; id_estudio: number }[];
  estudios: { id_estudio: number; clave: string; nombre: string; es_externo: boolean }[];
  parametros: { id_parametro: number; id_estudio: number; nombre: string; unidad: string | null; rango_referencia: string | null; opciones: string | null }[];
  muestras: { id_muestra: number; id_orden: number; fecha_recepcion: string | null; estado: SampleState | "Procesada" }[];
  incidencias: { id_incidencia: number; id_muestra: number; id_usuario: number; tipo: IncidentType; descripcion: string | null; fecha_hora: string }[];
  resultados: {
    id_resultado: number; id_detalle: number; estado: Exclude<ResultStatus, "Pendiente">; id_usuario_captura: number; fecha_captura: string;
    id_usuario_valida: number | null; fecha_validacion: string | null; fecha_liberacion: string | null; tiene_pdf: boolean;
  }[];
  valores: { id_resultado: number; id_parametro: number; valor: string }[];
}

export interface LabData { orders: Order[]; patients: Patient[]; services: LabService[]; samples: Sample[]; incidents: Incident[] }

export function mapLab(raw: RawLab): LabData {
  const quien = (id: number | null) => (id === null ? undefined : id === raw.yo.id ? raw.yo.nombre : "Químico");
  const d = (s: string | null) => (s ? new Date(s) : undefined);

  const services: LabService[] = raw.estudios.map((e) => ({
    id: String(e.id_estudio), clave: e.clave, name: e.nombre, external: e.es_externo,
    params: raw.parametros.filter((p) => p.id_estudio === e.id_estudio).map((p) => ({
      id: p.id_parametro, name: p.nombre, unit: p.unidad ?? "", ref: p.rango_referencia ?? "",
      options: (p.opciones ?? "").split(",").map((o) => o.trim()).filter(Boolean),
    })),
  }));
  const serviceOf = new Map(services.map((s) => [Number(s.id), s]));
  const resultOf = new Map(raw.resultados.map((r) => [r.id_detalle, r]));
  const valuesOf = new Map<number, RawLab["valores"]>();
  raw.valores.forEach((v) => valuesOf.set(v.id_resultado, [...(valuesOf.get(v.id_resultado) ?? []), v]));

  const orders: Order[] = raw.ordenes.map((o) => ({
    id: String(o.id_orden), folio: o.folio, patientId: String(o.id_paciente), createdAt: new Date(o.fecha_registro), status: o.estado,
    items: raw.detalles.filter((x) => x.id_orden === o.id_orden).map((det) => {
      const svc = serviceOf.get(det.id_estudio);
      const r = resultOf.get(det.id_detalle);
      const values = (r ? valuesOf.get(r.id_resultado) ?? [] : []).map((v) => {
        const p = svc?.params.find((x) => x.id === v.id_parametro);
        return { paramId: v.id_parametro, name: p?.name ?? "Parámetro", value: v.valor, unit: p?.unit ?? "", ref: p?.ref || "—", flag: evaluarReferencia(v.valor, p?.ref) };
      });
      return {
        detailId: det.id_detalle, serviceId: String(det.id_estudio), name: svc?.name ?? "Estudio",
        result: {
          id: r?.id_resultado ?? null, status: r?.estado ?? "Pendiente", capturedBy: r ? quien(r.id_usuario_captura) : undefined, capturedAt: r ? d(r.fecha_captura) : undefined,
          validatedBy: r ? quien(r.id_usuario_valida) : undefined, validatedAt: r ? d(r.fecha_validacion) : undefined, releasedAt: r ? d(r.fecha_liberacion) : undefined,
          values, hasPdf: r?.tiene_pdf ?? false,
        },
      };
    }),
  }));

  const samples: Sample[] = raw.muestras.map((m) => ({
    id: `M-${m.id_muestra}`, dbId: m.id_muestra, orderId: String(m.id_orden),
    state: m.estado === "Procesada" ? "Recibida" : m.estado, receivedAt: d(m.fecha_recepcion) ?? null,
  }));

  const incidents: Incident[] = raw.incidencias.map((i) => ({
    id: `INC-${String(i.id_incidencia).padStart(3, "0")}`, sampleId: `M-${i.id_muestra}`, type: i.tipo, description: i.descripcion ?? "",
    reportedBy: quien(i.id_usuario) ?? "Químico", at: new Date(i.fecha_hora),
  }));

  return { orders, patients: raw.pacientes.map((p) => ({ id: String(p.id_paciente), name: p.nombre_completo })), services, samples, incidents };
}
