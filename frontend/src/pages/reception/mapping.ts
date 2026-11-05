// Convierte la respuesta de GET /api/recepcion/datos (nombres de columnas de MySQL) al modelo de la interfaz.
import { evaluarReferencia } from "../../utils/reference";
import {
  formatPhone, patientCode, ymd,
  type Order, type OrderItem, type OrderStatus, type Patient, type Payment, type PayMethod, type PayType, type SampleState, type Service,
} from "./data";

export interface RawDatos {
  yo: { id: number; nombre: string };
  pacientes: { id_paciente: number; nombre_completo: string; telefono: string | null; tiene_whatsapp: boolean; fecha_registro: string }[];
  ordenes: {
    id_orden: number; folio: string; id_paciente: number; fecha_registro: string; fecha_cita: string | null; indicaciones: string | null;
    estado: OrderStatus; motivo_cancelacion: string | null; id_usuario_entrega: number | null; fecha_entrega: string | null;
    acepta_recordatorio: boolean; acepta_aviso_resultados: boolean; preparacion_mensaje: string | null; recordatorio_envio: string | null;
  }[];
  muestras: { id_muestra: number; id_orden: number; estado: SampleState; fecha_recepcion: string | null }[];
  detalles: { id_detalle: number; id_orden: number; id_estudio: number; clave: string; nombre: string; es_externo: boolean; precio_aplicado: number }[];
  pagos: { id_pago: number; id_orden: number; id_usuario: number; monto: number; metodo_pago: PayMethod; tipo: PayType; fecha_hora: string }[];
  informes: { id_orden: number; estudio_clave: string; parametro: string | null; unidad: string | null; valor: string | null; referencia: string | null; fecha_liberacion: string | null; ruta_pdf_externo: string | null }[];
  estudios: { id_estudio: number; clave: string; nombre: string; precio: number; es_externo: boolean }[];
}

export interface ReceptionData { patients: Patient[]; orders: Order[]; payments: Payment[]; services: Service[] }

const nombreArchivo = (ruta: string) => ruta.split(/[\\/]/).pop() ?? ruta;

export function mapDatos(raw: RawDatos): ReceptionData {
  const patients: Patient[] = raw.pacientes.map((p) => ({
    id: patientCode(p.id_paciente), name: p.nombre_completo, phone: formatPhone(p.telefono ?? ""),
    whatsapp: p.tiene_whatsapp, registeredAt: new Date(p.fecha_registro),
  }));
  const whatsappDe = new Map(raw.pacientes.map((p) => [p.id_paciente, p.tiene_whatsapp]));

  // Ticket TK-AAAAMMDD-NNN: consecutivo del día según el orden de los pagos.
  const porDia = new Map<string, number>();
  const payments: Payment[] = raw.pagos.map((p) => {
    const at = new Date(p.fecha_hora);
    const dia = ymd(at);
    const n = (porDia.get(dia) ?? 0) + 1;
    porDia.set(dia, n);
    return {
      id: String(p.id_pago), ticketNo: `TK-${dia}-${String(n).padStart(3, "0")}`, orderId: String(p.id_orden), amount: p.monto,
      method: p.metodo_pago, type: p.tipo, at, cashier: p.id_usuario === raw.yo.id ? raw.yo.nombre : "Recepción",
    };
  });

  const orders: Order[] = raw.ordenes.map((o) => {
    const items: OrderItem[] = raw.detalles.filter((d) => d.id_orden === o.id_orden).map((d) => {
      // vw_informe_resultado solo trae resultados LIBERADOS: lo demás se ve como "Pendiente" (RN-01).
      const filas = raw.informes.filter((i) => i.id_orden === o.id_orden && i.estudio_clave === d.clave);
      const liberado = filas.length > 0;
      const liberadoEn = filas[0]?.fecha_liberacion ? new Date(filas[0].fecha_liberacion) : undefined;
      const pdf = filas.find((f) => f.ruta_pdf_externo)?.ruta_pdf_externo;
      return {
        serviceId: String(d.id_estudio), name: d.nombre, price: d.precio_aplicado,
        result: {
          status: liberado ? "Liberado" : "Pendiente",
          values: filas.filter((f) => f.parametro !== null).map((f) => ({ name: f.parametro!, value: f.valor ?? "", unit: f.unidad ?? "", ref: f.referencia || "—", flag: evaluarReferencia(f.valor ?? "", f.referencia) })),
          ...(liberado ? { validatedAt: liberadoEn, releasedAt: liberadoEn } : {}),
          ...(pdf ? { externalPdf: nombreArchivo(pdf) } : {}),
        },
      };
    });
    return {
      id: String(o.id_orden), folio: o.folio, patientId: patientCode(o.id_paciente), createdAt: new Date(o.fecha_registro),
      appointmentAt: o.fecha_cita ? new Date(o.fecha_cita) : null, items, status: o.estado,
      ...(o.motivo_cancelacion ? { cancelReason: o.motivo_cancelacion } : {}),
      ...(o.fecha_entrega ? { deliveredAt: new Date(o.fecha_entrega) } : {}),
      ...(o.id_usuario_entrega !== null ? { deliveredBy: o.id_usuario_entrega === raw.yo.id ? raw.yo.nombre : "Recepción" } : {}),
      notify: whatsappDe.get(o.id_paciente) ? "WhatsApp" : "Físico",
      sample: raw.muestras.find((m) => m.id_orden === o.id_orden)?.estado ?? null,
      prep: o.preparacion_mensaje ?? "", remind: o.acepta_recordatorio, resultsNotice: o.acepta_aviso_resultados,
      remindAt: o.recordatorio_envio ? new Date(o.recordatorio_envio) : null,
    };
  });

  const services: Service[] = raw.estudios.map((e) => ({
    id: String(e.id_estudio), clave: e.clave, name: e.nombre, category: "Análisis clínico", price: e.precio, external: e.es_externo,
  }));

  return { patients, orders, payments, services };
}
