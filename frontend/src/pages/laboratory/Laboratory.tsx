import { useState } from "react";
import type { Session } from "../../services/session";
import type { LaboratoryAction } from "../../types";
import ModuleCard from "../../components/ui/ModuleCard";
import IncidentsPanel from "./IncidentsPanel";
import ResultsPanel from "./ResultsPanel";
import SamplesPanel from "./SamplesPanel";
import type { LabStore } from "./store";
import ValidationPanel from "./ValidationPanel";
import ChatPanel from "../../components/chat/ChatPanel";

type Action = LaboratoryAction;

function LabIcon() {
  return <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-4" /><rect x="9" y="1" width="6" height="4" rx="1" /><path d="m9 12 2 2 4-4" /></svg>;
}

interface LaboratoryProps {
  lab: LabStore; // estado del laboratorio (muestras, incidencias, avisos)
  session: Session; // químico en turno
  onChatActivity?: () => void;
  activeAction?: Action | null;
  onActionChange?: (action: Action | null) => void;
}

export default function Laboratory({ lab, session, onChatActivity, activeAction, onActionChange }: LaboratoryProps) {
  const [localActive, setLocalActive] = useState<Action | null>(null);
  const active = activeAction === undefined ? localActive : activeAction;
  const setActive = onActionChange ?? setLocalActive;
  const [incidentSample, setIncidentSample] = useState<string | null>(null);

  const cards: { id: Action; title: string; description: string; actionLabel: string; badge: string }[] = [
    { id: "samples", title: "RECEPCIÓN DE MUESTRAS", description: "Historial, avisos y trazabilidad de muestras biológicas recibidas.", actionLabel: "Consultar muestras", badge: lab.counts.toReceive ? `${lab.counts.toReceive} por recibir` : "" },
    { id: "incidents", title: "REGISTRO DE INCIDENCIAS", description: "Documentación de incidencias y anomalías en el proceso.", actionLabel: "Registrar incidencia", badge: lab.counts.retake ? `${lab.counts.retake} por retomar` : "" },
    { id: "results", title: "CAPTURA DE RESULTADOS", description: "Campos según el estudio y reportes externos del expediente.", actionLabel: "Capturar resultados", badge: lab.counts.toCapture ? `${lab.counts.toCapture} por capturar` : "" },
    { id: "validation", title: "VALIDACIÓN MÉDICA", description: "Revisión y autorización de resultados por el químico.", actionLabel: "Revisar pendientes", badge: lab.counts.toValidate ? `${lab.counts.toValidate} por validar` : "" },
    { id: "messages", title: "MENSAJES", description: "Chat interno con Recepción y Gerencia.", actionLabel: "Abrir chat", badge: "" },
  ];

  const open = (action: Action) => { setIncidentSample(null); setActive(action); };
  const close = () => setActive(null);

  return (
    <div>
      {active === null && (
        <>
          <div className="mb-6">
            <h1 className="text-xl font-bold text-slate-800">Laboratorio</h1>
            <p className="mt-0.5 text-sm text-slate-500">Interfaz del Químico — Procesamiento de muestras y resultados</p>
          </div>
          <div className="grid max-w-6xl gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map((card) => (
              <ModuleCard key={card.id} title={card.title} description={card.description} actionLabel={card.actionLabel} badge={card.badge} icon={<LabIcon />} onAction={() => open(card.id)} />
            ))}
          </div>
        </>
      )}

      {active === "samples" && <SamplesPanel lab={lab} onReport={(id) => { setIncidentSample(id); setActive("incidents"); }} onClose={close} />}
      {/* key: al llegar desde "Reportar incidencia" el formulario se reinicia con el folio precargado */}
      {active === "incidents" && <IncidentsPanel key={incidentSample ?? "new"} lab={lab} session={session} prefillSampleId={incidentSample} onClose={close} />}
      {active === "results" && <ResultsPanel lab={lab} session={session} onClose={close} />}
      {active === "validation" && <ValidationPanel lab={lab} session={session} onClose={close} />}
      {active === "messages" && <ChatPanel onActivity={onChatActivity} onClose={close} />}
    </div>
  );
}
