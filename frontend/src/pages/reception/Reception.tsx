import { useState } from "react";
import type { ReceptionAction } from "../../types";
import ModuleCard from "../../components/ui/ModuleCard";
import AppointmentsPanel from "./AppointmentsPanel";
import PatientsPanel from "./PatientsPanel";
import PaymentsPanel from "./PaymentsPanel";
import WhatsAppPanel from "./WhatsAppPanel";
import ChatPanel from "../../components/chat/ChatPanel";
import type { ReceptionStore } from "./store";

type Action = ReceptionAction;

const cards: { id: Action; title: string; subtitle: string; description: string; actionLabel: string }[] = [
  { id: "patients", title: "PACIENTE", subtitle: "(CONSULTA)", description: "Búsqueda por nombre o ID, resultados validados y estado de cuenta.", actionLabel: "Buscar paciente" },
  { id: "appointments", title: "CITA", subtitle: "(REGISTRO Y ABONO)", description: "Programación de citas con costo automático y abono inicial.", actionLabel: "Registrar cita" },
  { id: "payments", title: "COBROS", subtitle: "(SERVICIOS)", description: "Cobro de saldos y emisión de comprobantes de pago.", actionLabel: "Cobrar servicio" },
  { id: "whatsapp", title: "WHATSAPP", subtitle: "(AVISOS)", description: "Recordatorios, indicaciones de preparación y aviso de resultados listos.", actionLabel: "Ver mensajes" },
  { id: "messages", title: "MENSAJES", subtitle: "(CHAT INTERNO)", description: "Comunicación con Gerencia y Laboratorio.", actionLabel: "Abrir chat" },
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
  onChatActivity?: () => void;
  activeAction?: Action | null;
  onActionChange?: (action: Action | null) => void;
}

export default function Reception({ store, onChatActivity, activeAction, onActionChange }: ReceptionProps) {
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
          <div className="grid max-w-5xl gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map((card) => (
              <ModuleCard key={card.id} title={card.title} subtitle={card.subtitle} description={card.description} actionLabel={card.actionLabel} icon={<CardIcon />} onAction={() => open(card.id)} />
            ))}
          </div>
        </>
      )}

      {/* key: al entrar desde "Ver paciente" se reinicia el panel con el paciente enfocado */}
      {active === "patients" && <PatientsPanel key={focusPatient ?? "dir"} store={store} focusPatientId={focusPatient} onClose={() => setActive(null)} />}
      {active === "appointments" && <AppointmentsPanel store={store} onViewPatient={(id) => { setFocusPatient(id); setActive("patients"); }} onClose={() => setActive(null)} />}
      {active === "payments" && <PaymentsPanel store={store} onClose={() => setActive(null)} />}
      {active === "whatsapp" && <WhatsAppPanel onClose={() => setActive(null)} />}
      {active === "messages" && <ChatPanel onActivity={onChatActivity} onClose={() => setActive(null)} />}
    </div>
  );
}
