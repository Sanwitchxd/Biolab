import { useEffect, useRef, useState } from "react";
import { Button, Workspace } from "../ui/FormControls";
import { dateLabel, timeLabel } from "../../utils/format";
import { useChatSummary, useConversation } from "../../services/chat";

const ROLE_STYLE: Record<string, string> = {
  Gerente: "bg-violet-100 text-violet-700", Recepcionista: "bg-sky-100 text-sky-700", Químico: "bg-emerald-100 text-emerald-700",
};
const initials = (name: string) => name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

/** Chat interno sencillo: lista de compañeros a la izquierda, conversación a la derecha. */
export default function ChatPanel({ onClose, onActivity }: { onClose: () => void; onActivity?: () => void }) {
  const summary = useChatSummary(true);
  const [contactId, setContactId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const chat = useConversation(contactId, () => { void summary.refresh(); onActivity?.(); });
  const endRef = useRef<HTMLDivElement>(null);
  const contact = summary.contacts.find((c) => c.id === contactId) ?? null;

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [chat.messages.length, contactId]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true); setError("");
    try { await chat.send(text); setDraft(""); void summary.refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : "No se pudo enviar el mensaje."); }
    finally { setBusy(false); }
  };

  return (
    <Workspace title="Mensajes" subtitle="Comunicación interna entre Gerencia, Recepción y Laboratorio" onClose={onClose}>
      <div className="grid min-h-[28rem] gap-4 md:grid-cols-[260px_1fr]">
        <ul className="max-h-[32rem] space-y-1.5 overflow-y-auto pr-1" aria-label="Compañeros">
          {summary.contacts.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => { setContactId(c.id); setError(""); }}
                className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${c.id === contactId ? "border-blue-300 bg-blue-50" : "border-slate-100 hover:border-blue-200 hover:bg-blue-50/40"}`}>
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">{initials(c.name)}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2"><span className="truncate text-sm font-semibold text-slate-800">{c.name}</span>
                    {c.unread > 0 && <span className="rounded-full bg-red-500 px-1.5 text-[10px] font-bold leading-4 text-white">{c.unread}</span>}</span>
                  <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${ROLE_STYLE[c.role] ?? "bg-slate-100 text-slate-600"}`}>{c.role}</span>
                  {c.last && <span className="mt-1 block truncate text-[11px] text-slate-400">{c.last}</span>}
                </span>
              </button>
            </li>
          ))}
          {summary.contacts.length === 0 && <li className="rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-500">No hay otros usuarios activos.</li>}
        </ul>

        <div className="flex min-h-[28rem] min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200">
          {contact ? (
            <>
              <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50 px-4 py-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">{initials(contact.name)}</span>
                <div><p className="text-sm font-bold text-slate-800">{contact.name}</p><p className="text-[11px] text-slate-500">{contact.role}</p></div>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto bg-white p-4" style={{ maxHeight: "24rem" }} aria-live="polite">
                {chat.messages.map((m, i) => {
                  const newDay = i === 0 || dateLabel(chat.messages[i - 1]!.at) !== dateLabel(m.at);
                  return (
                    <div key={m.id}>
                      {newDay && <p className="my-2 text-center text-[11px] font-semibold text-slate-400">{dateLabel(m.at)}</p>}
                      <div className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm ${m.mine ? "rounded-br-md bg-blue-500 text-white" : "rounded-bl-md bg-slate-100 text-slate-800"}`}>
                          <p className="whitespace-pre-wrap break-words">{m.text}</p>
                          <p className={`mt-0.5 text-right text-[10px] ${m.mine ? "text-blue-100" : "text-slate-400"}`}>{timeLabel(m.at)}{m.mine && (m.readAt ? " · leído" : " · enviado")}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {chat.messages.length === 0 && <p className="py-10 text-center text-sm text-slate-400">Aún no hay mensajes. Escribe el primero.</p>}
                <div ref={endRef} />
              </div>
              {(error || chat.error) && <p role="alert" className="border-t border-red-100 bg-red-50 px-4 py-2 text-xs font-medium text-red-600">{error || chat.error}</p>}
              <form onSubmit={send} className="flex items-end gap-2 border-t border-slate-100 p-3">
                <textarea value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={1000} rows={2} aria-label="Escribe un mensaje" placeholder="Escribe un mensaje…"
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}
                  className="min-h-0 flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100" />
                <Button type="submit" disabled={busy || !draft.trim()}>Enviar</Button>
              </form>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-slate-500">Elige a un compañero para ver la conversación.<br />Enter envía el mensaje · Shift + Enter agrega una línea.</div>
          )}
        </div>
      </div>
    </Workspace>
  );
}
