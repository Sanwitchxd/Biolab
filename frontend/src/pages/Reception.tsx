import { useState } from "react";
import type { ReceptionAction } from "../types";
import AppointmentsPanel from "./reception/AppointmentsPanel";
import PatientsPanel from "./reception/PatientsPanel";
import PaymentsPanel from "./reception/PaymentsPanel";
import type { ReceptionStore } from "./reception/store";

type Action = ReceptionAction;

const cards: { id: Action; title: string; subtitle: string; description: string; actionLabel: string }[] = [
  { id: "patients", title: "PACIENTE", subtitle: "(CONSULTA)", description: "Búsqueda por nombre o ID, resultados validados y estado de cuenta.", actionLabel: "Buscar paciente" },
  { id: "appointments", title: "CITA", subtitle: "(REGISTRO Y ABONO)", description: "Programación de citas con costo automático y abono inicial.", actionLabel: "Registrar cita" },
  { id: "payments", title: "COBROS", subtitle: "(SERVICIOS)", description: "Cobro de saldos y emisión de comprobantes de pago.", actionLabel: "Cobrar servicio" },
];

function CardIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M8 13h8M8 17h5" />
    </svg>
  );
}

interface ReceptionProps {
  store: ReceptionStore; // estado compartido con Laboratorio (vive en App)
  activeAction?: Action | null;
  onActionChange?: (action: Action | null) => void;
}

export default function Reception({ store, activeAction, onActionChange }: ReceptionProps) {
  const [localActive, setLocalActive] = useState<Action | null>(null);
  const active = activeAction === undefined ? localActive : activeAction;
  const setActive = onActionChange ?? setLocalActive;
  const [focusPatient, setFocusPatient] = useState<string | null>(null);

  const open = (action: Action) => { setFocusPatient(null); setActive(action); };

  return (
    <div>
      {active === null && (
        <>
          <div className="mb-6">
            <h1 className="text-xl font-bold text-slate-800">Recepción</h1>
            <p className="mt-0.5 text-sm text-slate-500">Gestión de pacientes, citas y cobros</p>
          </div>
          <div className="grid max-w-4xl gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map((card) => (
              <article key={card.id} className="flex min-h-56 flex-col rounded-2xl bg-[#6B9EC7] p-5 text-white transition hover:-translate-y-0.5 hover:shadow-lg">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white/15"><CardIcon /></div>
                <h2 className="text-sm font-bold">{card.title}</h2>
                <p className="text-xs font-medium text-white/80">{card.subtitle}</p>
                <p className="mt-2 text-xs leading-relaxed text-white/70">{card.description}</p>
                <button type="button" onClick={() => open(card.id)} className="mt-auto w-full rounded-xl border border-white/30 bg-white/15 px-3 py-2 text-sm font-semibold transition hover:bg-white/25">{card.actionLabel}</button>
              </article>
            ))}
          </div>
        </>
      )}

      {/* key: al entrar desde "Ver paciente" se reinicia el panel con el paciente enfocado */}
      {active === "patients" && <PatientsPanel key={focusPatient ?? "dir"} store={store} focusPatientId={focusPatient} onClose={() => setActive(null)} />}
      {active === "appointments" && <AppointmentsPanel store={store} onViewPatient={(id) => { setFocusPatient(id); setActive("patients"); }} onClose={() => setActive(null)} />}
      {active === "payments" && <PaymentsPanel store={store} onClose={() => setActive(null)} />}
    </div>
  );
}
