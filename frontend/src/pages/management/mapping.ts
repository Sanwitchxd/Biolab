// Convierte las respuestas de /api/gerencia/* (columnas de MySQL) al modelo de la interfaz.
import { patientCode } from "../reception/data";
import type { Payroll, Periodicidad, LogEntry, LogKind, LogModule, Payment, PayMethod, PayType, StaffUser, StudyCount, UserRole } from "./data";
import { AREA_BY_ROLE } from "./data";

export interface RawUsuario { id_usuario: number; nombre_completo: string; nombre_usuario: string; rol: "Gerente" | "Recepcionista" | "Químico"; estado: "Activo" | "Bloqueado"; ultimo_inicio: string | null }
export interface RawBitacora { id_bitacora: number; fecha_hora: string; usuario: string; rol: RawUsuario["rol"]; accion: string; detalle: string | null; folio: string | null; id_paciente: number | null; paciente: string | null }
export interface RawPago { id_pago: number; id_orden: number; folio: string; id_paciente: number; paciente: string; monto: number; metodo_pago: PayMethod; tipo: PayType; fecha_hora: string; cajero: string }
export interface RawEstudio { dia: string; estudio: string; es_externo: boolean; cantidad: number }

const ROL: Record<RawUsuario["rol"], UserRole> = { Gerente: "Gerencia", Recepcionista: "Recepcionista", Químico: "Químico" };
const MODULO: Record<RawUsuario["rol"], LogModule> = { Gerente: "Gerencia", Recepcionista: "Recepción", Químico: "Laboratorio" };

export const mapUsuarios = (rows: RawUsuario[]): StaffUser[] =>
  rows.map((u) => ({
    id: String(u.id_usuario), username: u.nombre_usuario, name: u.nombre_completo, role: ROL[u.rol], area: AREA_BY_ROLE[ROL[u.rol]],
    active: u.estado === "Activo", lastLogin: u.ultimo_inicio ? new Date(u.ultimo_inicio) : null,
  }));

const ACCIONES: Record<string, { kind: LogKind; text: string }> = {
  INICIO_SESION: { kind: "Sesión", text: "Inició sesión" },
  CREAR_ORDEN: { kind: "Orden", text: "Generó una orden" },
  MODIFICAR_ORDEN: { kind: "Orden", text: "Modificó una orden" },
  CAMBIO_ESTADO_ORDEN: { kind: "Orden", text: "Cambió el estado de la orden" },
  CANCELAR_ORDEN: { kind: "Orden", text: "Canceló una orden" },
  ENTREGAR_ORDEN: { kind: "Orden", text: "Entregó resultados" },
  AGREGAR_ESTUDIO: { kind: "Orden", text: "Agregó un estudio a la orden" },
  REGISTRAR_PACIENTE: { kind: "Orden", text: "Registró un paciente" },
  MODIFICAR_PACIENTE: { kind: "Orden", text: "Modificó datos de un paciente" },
  REGISTRAR_PAGO: { kind: "Pago", text: "Registró un pago" },
  REGISTRAR_MUESTRA: { kind: "Muestra", text: "Registró una muestra" },
  ACTUALIZAR_MUESTRA: { kind: "Muestra", text: "Actualizó una muestra" },
  INCIDENCIA_MUESTRA: { kind: "Muestra", text: "Registró una incidencia en muestra" },
  CAPTURAR_RESULTADO: { kind: "Resultado", text: "Capturó resultados" },
  VALIDAR_RESULTADO: { kind: "Resultado", text: "Validó resultados" },
  LIBERAR_RESULTADO: { kind: "Resultado", text: "Liberó resultados" },
  CREAR_USUARIO: { kind: "Usuarios", text: "Creó un usuario" },
  MODIFICAR_USUARIO: { kind: "Usuarios", text: "Modificó un usuario" },
  CREAR_ESTUDIO: { kind: "Usuarios", text: "Creó un estudio del catálogo" },
  MODIFICAR_ESTUDIO: { kind: "Usuarios", text: "Modificó un estudio del catálogo" },
  DEFINIR_SUELDO: { kind: "Usuarios", text: "Definió el sueldo de un empleado" },
  PAGO_NOMINA: { kind: "Pago", text: "Registró un pago de nómina" },
  WHATSAPP: { kind: "Orden", text: "Gestionó un mensaje de WhatsApp" },
  INSTALACION: { kind: "Usuarios", text: "Instalación del sistema" },
};

export const mapBitacora = (rows: RawBitacora[]): LogEntry[] =>
  rows.map((b) => {
    const a = ACCIONES[b.accion] ?? { kind: "Orden" as LogKind, text: b.accion };
    return {
      id: b.id_bitacora, at: new Date(b.fecha_hora), user: b.usuario, module: MODULO[b.rol], kind: a.kind,
      action: b.detalle ? `${a.text} · ${b.detalle}` : a.text,
      folio: b.folio ?? undefined, patientId: b.id_paciente ? patientCode(b.id_paciente) : undefined, patientName: b.paciente ?? undefined,
    };
  });

export const mapPagos = (rows: RawPago[]): Payment[] =>
  rows.map((p) => ({
    id: String(p.id_pago), folio: p.folio, patientId: patientCode(p.id_paciente), patientName: p.paciente, amount: p.monto,
    method: p.metodo_pago, type: p.tipo, at: new Date(p.fecha_hora), status: "Conciliado", cashier: p.cajero,
  }));

export const mapEstudios = (rows: RawEstudio[]): StudyCount[] =>
  rows.map((e) => ({ day: e.dia, study: e.estudio, external: e.es_externo, count: e.cantidad }));

export interface RawNomina {
  id_usuario: number; salario: number; periodicidad: Periodicidad; fecha_inicio: string; pendientes: string[]; adeudo: number; proximoPago: string; ultimoPago: string | null;
  pagos: { id_pago_nomina: number; fecha_corresponde: string; monto: number; metodo_pago: string; nota: string | null; fecha_hora: string; registro: string }[];
}
export const mapNomina = (rows: RawNomina[]): Payroll[] =>
  rows.map((n) => ({
    userId: String(n.id_usuario), salary: n.salario, periodicity: n.periodicidad, startDate: n.fecha_inicio, pending: n.pendientes, owed: n.adeudo,
    nextPay: n.proximoPago, lastPay: n.ultimoPago,
    payments: n.pagos.map((p) => ({ id: p.id_pago_nomina, period: p.fecha_corresponde, amount: p.monto, method: p.metodo_pago, note: p.nota, at: new Date(p.fecha_hora), by: p.registro })),
  }));
