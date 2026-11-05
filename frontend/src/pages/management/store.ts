import { useCallback, useEffect, useState } from "react";
import { api } from "../../services/api";
import type { Payroll, Periodicidad, PayrollMethod, LogEntry, Payment, StaffUser, StudyCount, UserRole } from "./data";
import {
  mapBitacora, mapEstudios, mapNomina, mapPagos, mapUsuarios,
  type RawBitacora, type RawNomina, type RawEstudio, type RawPago, type RawUsuario,
} from "./mapping";

export interface ManagementData { users: StaffUser[]; logs: LogEntry[]; payments: Payment[]; studies: StudyCount[]; payroll: Payroll[] }
const VACIO: ManagementData = { users: [], logs: [], payments: [], studies: [], payroll: [] };

const ROL_API: Record<UserRole, string> = { Gerencia: "Gerente", Recepcionista: "Recepcionista", Químico: "Químico" };

/** Datos de Gerencia desde la API (usuarios, bitácora de solo lectura, pagos y estudios). */
export function useManagementStore() {
  const [data, setData] = useState<ManagementData>(VACIO);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [u, b, c, e, n] = await Promise.all([
      api<{ usuarios: RawUsuario[] }>("/gerencia/usuarios"),
      api<{ bitacora: RawBitacora[] }>("/gerencia/bitacora"),
      api<{ pagos: RawPago[] }>("/gerencia/caja"),
      api<{ estudios: RawEstudio[] }>("/gerencia/estadisticas"),
      api<{ empleados: RawNomina[] }>("/gerencia/nomina"),
    ]);
    setData({ users: mapUsuarios(u.usuarios), logs: mapBitacora(b.bitacora), payments: mapPagos(c.pagos), studies: mapEstudios(e.estudios), payroll: mapNomina(n.empleados) });
  }, []);

  const start = useCallback(() => {
    setStatus("loading");
    load().then(() => setStatus("ready")).catch((e: unknown) => {
      setError(e instanceof Error ? e.message : "No se pudieron cargar los datos.");
      setStatus("error");
    });
  }, [load]);
  useEffect(() => { start(); }, [start]);

  const addUser = async (input: { name: string; username: string; password: string; role: UserRole }) => {
    await api("/gerencia/usuarios", { body: { nombre: input.name, usuario: input.username, contrasena: input.password, rol: ROL_API[input.role] } });
    await load();
  };

  const setActive = async (user: StaffUser, active: boolean) => {
    await api(`/gerencia/usuarios/${user.id}/estado`, { method: "PATCH", body: { estado: active ? "Activo" : "Bloqueado" } });
    await load();
  };

  const setSalary = async (user: StaffUser, input: { salary: number; periodicity: Periodicidad; startDate: string }) => {
    await api(`/gerencia/usuarios/${user.id}/sueldo`, { method: "PUT", body: { salario: input.salary, periodicidad: input.periodicity, fechaInicio: input.startDate } });
    await load();
  };

  const payPeriod = async (user: StaffUser, input: { period: string; method: PayrollMethod; note: string; amount?: number }) => {
    await api(`/gerencia/usuarios/${user.id}/nomina/pagos`, { body: { fecha: input.period, metodo: input.method, nota: input.note, monto: input.amount } });
    await load();
  };

  return { ...data, status, error, retry: start, reload: load, addUser, setActive, setSalary, payPeriod };
}

export type ManagementStore = ReturnType<typeof useManagementStore>;
