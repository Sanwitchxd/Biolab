import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../services/api";
import { isOpenOrder, type Incident, type IncidentType, type LabService, type Order, type Patient, type Sample } from "./data";
import { mapLab, type LabData, type RawLab } from "./mapping";

export interface SaveResultInput { detailId: number; values: { idParametro: number; valor: string }[]; pdf: File | null }
export interface IncidentInput { sampleId: string; type: IncidentType; description: string }
export type IncidentOutcome = { ok: true; incident: Incident } | { ok: false; error: string };
export interface ValidationOutcome { count: number; orders: { folio: string; patientName: string }[] }

export interface LabAlert { id: string; tone: "info" | "warning" | "danger"; title: string; body: string }
export interface LabCounts { toReceive: number; toCapture: number; toValidate: number; retake: number }

const VACIO: LabData = { orders: [], patients: [], services: [], samples: [], incidents: [] };

const aBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.readAsDataURL(file);
  });

/** Datos del laboratorio desde la API. Las reglas (RN-03, estados de la orden, bitácora, alertas a Recepción) las aplica MySQL. */
export function useLabStore() {
  const [data, setData] = useState<LabData>(VACIO);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const fresh = mapLab(await api<RawLab>("/laboratorio/datos"));
    setData(fresh);
    return fresh;
  }, []);

  const start = useCallback(() => {
    setStatus("loading");
    load().then(() => setStatus("ready")).catch((e: unknown) => {
      setError(e instanceof Error ? e.message : "No se pudieron cargar los datos.");
      setStatus("error");
    });
  }, [load]);
  useEffect(() => { start(); }, [start]);

  const { orders, patients, services, samples, incidents } = data;
  const serviceOf = (id: string): LabService => services.find((s) => s.id === id) ?? { id, clave: "", name: "Estudio", external: false, params: [] };
  const patientName = (o: Order) => patients.find((p) => p.id === o.patientId)?.name ?? "Paciente";

  /* ------------------------------- Muestras ------------------------------- */

  const receiveSample = async (sampleId: string) => {
    const s = samples.find((x) => x.id === sampleId);
    if (!s) return;
    await api(`/laboratorio/muestras/${s.dbId}/recibir`, { body: {} });
    await load();
  };

  /** La nueva toma ya está en camino: la muestra vuelve a Pendiente de recepción. */
  const markRetaken = async (sampleId: string) => {
    const s = samples.find((x) => x.id === sampleId);
    if (!s) return;
    await api(`/laboratorio/muestras/${s.dbId}/retomada`, { body: {} });
    await load();
  };

  /* ------------------------------ Incidencias ------------------------------ */

  const registerIncident = async (input: IncidentInput): Promise<IncidentOutcome> => {
    const wanted = input.sampleId.trim().toLowerCase();
    const sample = samples.find((s) => s.id.toLowerCase() === wanted);
    if (!sample) return { ok: false, error: wanted ? `No existe la muestra "${input.sampleId.trim()}".` : "Indica el folio de la muestra." };
    const order = orders.find((o) => o.id === sample.orderId);
    if (!order || !isOpenOrder(order)) return { ok: false, error: "La orden de esta muestra ya está cerrada (entregada o cancelada)." };
    const description = input.description.trim();
    if (description.length < 10) return { ok: false, error: "Describe lo ocurrido y la acción tomada (mínimo 10 caracteres)." };
    try {
      await api("/laboratorio/incidencias", { body: { idMuestra: sample.dbId, tipo: input.type, descripcion: description } });
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "No se pudo registrar la incidencia." };
    }
    const fresh = await load();
    const incident = fresh.incidents.find((i) => i.sampleId === sample.id) ?? fresh.incidents[0];
    return { ok: true, incident };
  };

  /* -------------------------------- Resultados -------------------------------- */

  /** Guarda la captura (RESULTADO + VALOR_RESULTADO). Editable hasta que se valide (RN-03, lo hace cumplir MySQL). */
  const saveResult = async (input: SaveResultInput) => {
    await api("/laboratorio/resultados", {
      body: { idDetalle: input.detailId, valores: input.values, ...(input.pdf ? { pdfBase64: await aBase64(input.pdf) } : {}) },
    });
    await load();
  };

  /** Validación médica: valida y libera los resultados; MySQL actualiza la orden y avisa a Recepción. */
  const validateItems = async (resultIds: number[]): Promise<ValidationOutcome> => {
    const r = await api<{ validados: number }>("/laboratorio/resultados/validar", { body: { ids: resultIds } });
    const before = new Set(resultIds);
    const affected = orders.filter((o) => o.items.some((i) => i.result.id !== null && before.has(i.result.id)));
    await load();
    return { count: r.validados, orders: affected.map((o) => ({ folio: o.folio, patientName: patientName(o) })) };
  };

  /* ---------------------- Avisos derivados para el químico ---------------------- */

  const { counts, alerts } = useMemo(() => {
    const byOrder = new Map(orders.map((o) => [o.id, o]));
    const open = (s: Sample) => { const o = byOrder.get(s.orderId); return !!o && isOpenOrder(o); };
    const toReceive = samples.filter((s) => s.state === "Pendiente" && open(s)).length;
    const retake = samples.filter((s) => s.state === "Con incidencia" && open(s)).length;
    let toCapture = 0;
    let toValidate = 0;
    orders.filter(isOpenOrder).forEach((o) => o.items.forEach((i) => {
      if (i.result.status === "Capturado") toValidate += 1;
      if (i.result.status === "Pendiente" && samples.some((s) => s.orderId === o.id && s.state === "Recibida")) toCapture += 1;
    }));
    const list: LabAlert[] = [];
    if (retake) list.push({ id: "retake", tone: "danger", title: `${retake} muestra${retake > 1 ? "s" : ""} con incidencia`, body: "Se solicitó nueva toma. Marca la muestra como retomada cuando llegue." });
    if (toReceive) list.push({ id: "receive", tone: "warning", title: `${toReceive} muestra${toReceive > 1 ? "s" : ""} por recibir`, body: "Hay órdenes registradas en Recepción sin muestra recibida en laboratorio." });
    if (toCapture) list.push({ id: "capture", tone: "info", title: `${toCapture} estudio${toCapture > 1 ? "s" : ""} por capturar`, body: "Muestras recibidas con resultados pendientes de captura." });
    if (toValidate) list.push({ id: "validate", tone: "info", title: `${toValidate} resultado${toValidate > 1 ? "s" : ""} por validar`, body: "Capturados y en espera de tu validación médica." });
    return { counts: { toReceive, toCapture, toValidate, retake } as LabCounts, alerts: list };
  }, [samples, orders]);

  return {
    orders, patients: patients as Patient[], samples, incidents, counts, alerts, serviceOf, patientName,
    status, error, retry: start, reload: load, receiveSample, markRetaken, registerIncident, saveResult, validateItems,
  };
}

export type LabStore = ReturnType<typeof useLabStore>;
