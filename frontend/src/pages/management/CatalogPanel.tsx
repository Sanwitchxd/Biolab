import { useMemo, useState } from "react";
import { Button, Field, Input, Notice, Workspace } from "../../components/ui/FormControls";
import Modal from "../../components/ui/Modal";
import TypeChips, { countByType, type TypeFilter } from "../../components/ui/TypeChips";
import { norm, squash, studyType, STUDY_TYPE_STYLE } from "../../utils/validation";
import { moneyExact, type CatalogInput, type CatalogParam, type CatalogStudy } from "./data";

interface Props {
  catalog: CatalogStudy[];
  onCreate: (input: CatalogInput) => Promise<void>;
  onUpdate: (id: number, input: CatalogInput) => Promise<void>;
  onClose: () => void;
}

interface Draft { id: number | null; clave: string; name: string; price: string; external: boolean; active: boolean; params: CatalogParam[]; ordered: number }
const emptyDraft = (): Draft => ({ id: null, clave: "", name: "", price: "", external: false, active: true, params: [], ordered: 0 });
const blankParam = (): CatalogParam => ({ id: null, name: "", unit: "", range: "", options: "" });
const CLAVE_RE = /^[A-Z0-9][A-Z0-9_-]{1,19}$/;

/** Catálogo de estudios (RF-21): solo Gerencia da de alta, edita precios y activa o desactiva estudios. */
export default function CatalogPanel({ catalog, onCreate, onUpdate, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<TypeFilter>("Todos");
  const [state, setState] = useState<"activos" | "inactivos" | "todos">("activos");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [notice, setNotice] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  const typeOf = (s: CatalogStudy) => studyType(s.clave, s.name, s.external);
  const byState = useMemo(() => catalog.filter((s) => state === "todos" || (state === "activos") === s.active), [catalog, state]);
  const counts = useMemo(() => countByType(byState, typeOf), [byState]);
  const rows = useMemo(() => {
    const q = norm(query);
    return byState.filter((s) => (type === "Todos" || typeOf(s) === type) && (!q || norm(`${s.clave} ${s.name}`).includes(q)));
  }, [byState, type, query]);

  const open = (s?: CatalogStudy) => {
    setFormError("");
    setDraft(s ? { id: s.id, clave: s.clave, name: s.name, price: String(s.price), external: s.external, active: s.active, params: s.params.map((p) => ({ ...p })), ordered: s.timesOrdered } : emptyDraft());
  };

  const setParam = (i: number, patch: Partial<CatalogParam>) => setDraft((d) => d && { ...d, params: d.params.map((p, k) => (k === i ? { ...p, ...patch } : p)) });

  const validate = (d: Draft): string => {
    const clave = d.clave.trim().toUpperCase();
    if (d.id === null) {
      if (!CLAVE_RE.test(clave)) return "La clave debe tener de 2 a 20 caracteres: letras, números, guion o guion bajo (ej. GLU, EXT04).";
      if (catalog.some((s) => s.clave.toUpperCase() === clave)) return `Ya existe un estudio con la clave ${clave}.`;
    }
    const name = squash(d.name);
    if (name.length < 3) return "El nombre del estudio debe tener al menos 3 caracteres.";
    if (name.length > 100) return "El nombre del estudio es demasiado largo (máximo 100).";
    if (catalog.some((s) => s.id !== d.id && norm(s.name) === norm(name))) return "Ya existe otro estudio con ese nombre.";
    const price = Number(d.price);
    if (d.price.trim() === "" || !Number.isFinite(price) || price <= 0) return "Escribe un precio mayor a 0.";
    if (price > 1_000_000) return "El precio no puede pasar de 1,000,000.";
    if (Math.round(price * 100) / 100 !== price) return "El precio solo admite hasta 2 decimales.";
    const names = new Set<string>();
    for (const [i, p] of d.params.entries()) {
      const n = squash(p.name);
      if (!n) return `El parámetro ${i + 1} no tiene nombre (llénalo o quítalo).`;
      if (names.has(norm(n))) return `El parámetro «${n}» está repetido.`;
      names.add(norm(n));
      if (p.unit.length > 20) return `La unidad de «${n}» es demasiado larga (máximo 20).`;
      if (p.range.length > 60) return `El rango de «${n}» es demasiado largo (máximo 60).`;
      if (p.options.trim() && p.options.split(",").map((o) => o.trim()).filter(Boolean).length < 2) return `Las opciones de «${n}» deben ser al menos 2, separadas por coma.`;
    }
    return "";
  };

  const save = async () => {
    if (!draft) return;
    const problem = validate(draft);
    if (problem) return setFormError(problem);
    setBusy(true); setFormError("");
    const input: CatalogInput = {
      ...(draft.id === null ? { clave: draft.clave.trim().toUpperCase() } : {}),
      name: squash(draft.name), price: Number(draft.price), external: draft.external, active: draft.active,
      params: draft.params.map((p) => ({ ...p, name: squash(p.name), unit: p.unit.trim(), range: p.range.trim(), options: p.options.split(",").map((o) => o.trim()).filter(Boolean).join(", ") })),
    };
    try {
      if (draft.id === null) await onCreate(input); else await onUpdate(draft.id, input);
      setNotice(draft.id === null ? `Estudio ${input.clave} creado. Recepción y Laboratorio lo verán en unos segundos.` : `Estudio «${input.name}» actualizado.`);
      setDraft(null);
    } catch (e) { setFormError(e instanceof Error ? e.message : "No se pudo guardar el estudio."); } finally { setBusy(false); }
  };

  return (
    <Workspace title="Catálogo de estudios" subtitle="Da de alta estudios, cambia precios y define sus parámetros · Exclusivo para Gerencia" onClose={onClose}>
      {notice && <Notice>{notice}</Notice>}

      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1"><Field label="Buscar por clave o nombre"><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ej. glucosa, EGO, perfil…" /></Field></div>
        <div>
          <Field label="Estado">
            <select value={state} onChange={(e) => setState(e.target.value as typeof state)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800">
              <option value="activos">Activos</option><option value="inactivos">Inactivos</option><option value="todos">Todos</option>
            </select>
          </Field>
        </div>
        <Button type="button" onClick={() => open()}>+ Nuevo estudio</Button>
      </div>
      <div className="mb-4"><TypeChips value={type} onChange={setType} counts={counts} /></div>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Clave</th><th className="px-4 py-3">Estudio</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3 text-right">Precio</th><th className="px-4 py-3">Parámetros</th><th className="px-4 py-3">Estado</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((s) => { const t = typeOf(s); return (
              <tr key={s.id} tabIndex={0} onClick={() => open(s)} onKeyDown={(e) => { if (e.key === "Enter") open(s); }} className="cursor-pointer hover:bg-blue-50/40 focus:bg-blue-50/40 focus:outline-none">
                <td className="px-4 py-2.5 font-semibold text-blue-600">{s.clave}</td>
                <td className="px-4 py-2.5 text-slate-700">{s.name}</td>
                <td className="px-4 py-2.5"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STUDY_TYPE_STYLE[t]}`}>{t}</span></td>
                <td className="px-4 py-2.5 text-right font-semibold text-slate-800">{moneyExact(s.price)}</td>
                <td className="px-4 py-2.5 text-xs text-slate-500">{s.params.length || "—"}</td>
                <td className="px-4 py-2.5"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{s.active ? "Activo" : "Inactivo"}</span></td>
              </tr>
            ); })}
            {rows.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">No hay estudios con esos filtros.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-400">{rows.length} de {catalog.length} estudios · Haz clic en uno para editarlo. Cambiar un precio no modifica las órdenes ya creadas.</p>

      {draft && (
        <Modal
          title={draft.id === null ? "Nuevo estudio" : `Editar ${draft.clave}`} subtitle={draft.id === null ? "Aparecerá en Recepción al agendar citas" : `Se ha pedido ${draft.ordered} ${draft.ordered === 1 ? "vez" : "veces"}`}
          onClose={() => !busy && setDraft(null)} size="lg" locked={busy}
          footer={<><Button type="button" variant="secondary" onClick={() => setDraft(null)} disabled={busy}>Cancelar</Button><Button type="button" onClick={save} disabled={busy}>{draft.id === null ? "Crear estudio" : "Guardar cambios"}</Button></>}
        >
          {formError && <p role="alert" className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-600">{formError}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Clave">
              <Input value={draft.clave} disabled={draft.id !== null} maxLength={20} onChange={(e) => setDraft({ ...draft, clave: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "") })} placeholder="Ej. GLU" />
              {draft.id !== null && <span className="text-[11px] font-normal text-slate-400">La clave no se puede cambiar.</span>}
            </Field>
            <Field label="Precio (MXN)"><Input type="number" min="0.01" max="1000000" step="0.01" value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} placeholder="0.00" /></Field>
            <div className="sm:col-span-2"><Field label="Nombre del estudio"><Input value={draft.name} maxLength={100} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Ej. Glucosa en ayuno" /></Field></div>
            <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-700"><input type="checkbox" checked={draft.external} onChange={(e) => setDraft({ ...draft, external: e.target.checked })} className="mt-0.5 h-4 w-4 accent-blue-500" /><span><span className="font-semibold">Estudio externo</span><span className="block text-xs text-slate-500">Se manda a un laboratorio de referencia y el químico adjunta su PDF.</span></span></label>
            {draft.id !== null && <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-700"><input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} className="mt-0.5 h-4 w-4 accent-blue-500" /><span><span className="font-semibold">Estudio activo</span><span className="block text-xs text-slate-500">Si lo desactivas ya no se puede agendar; las órdenes anteriores no cambian.</span></span></label>}
          </div>

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Parámetros a capturar</p><button type="button" onClick={() => setDraft({ ...draft, params: [...draft.params, blankParam()] })} className="text-xs font-semibold text-blue-600 hover:underline">+ Agregar parámetro</button></div>
            {draft.params.length === 0 && <p className="rounded-xl bg-slate-50 px-4 py-3 text-xs text-slate-500">{draft.external ? "Los estudios externos normalmente no llevan parámetros: el químico adjunta el PDF del laboratorio." : "Sin parámetros: el químico no tendrá campos de captura para este estudio."}</p>}
            <ul className="space-y-2">
              {draft.params.map((p, i) => (
                <li key={p.id ?? `n${i}`} className="grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-[1.4fr_0.6fr_1fr_1.2fr_auto]">
                  <Input aria-label="Nombre del parámetro" value={p.name} maxLength={80} onChange={(e) => setParam(i, { name: e.target.value })} placeholder="Nombre" />
                  <Input aria-label="Unidad" value={p.unit} maxLength={20} onChange={(e) => setParam(i, { unit: e.target.value })} placeholder="Unidad" />
                  <Input aria-label="Rango de referencia" value={p.range} maxLength={60} onChange={(e) => setParam(i, { range: e.target.value })} placeholder="Ref. ej. 70 - 100" />
                  <Input aria-label="Opciones" value={p.options} maxLength={200} onChange={(e) => setParam(i, { options: e.target.value })} placeholder="Opciones (si es cualitativo)" />
                  {p.id === null ? <button type="button" aria-label="Quitar parámetro" onClick={() => setDraft({ ...draft, params: draft.params.filter((_, k) => k !== i) })} className="self-center text-slate-400 hover:text-red-500">✕</button> : <span className="self-center text-[10px] text-slate-300" title="Los parámetros guardados no se eliminan, solo se editan">fijo</span>}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-slate-400">Rango: «70 - 100», «&lt; 200» o, si es cualitativo, los valores esperados separados por coma. Opciones: lista cerrada, ej. «Positivo, Negativo». Los parámetros ya guardados no se eliminan para no afectar resultados anteriores.</p>
          </div>
        </Modal>
      )}
    </Workspace>
  );
}
