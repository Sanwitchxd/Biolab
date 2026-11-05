// Mensajería interna (los tres roles usan la misma API: /api/mensajes).
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";

export interface ChatContact { id: number; name: string; role: string; last: string | null; lastAt: Date | null; unread: number }
export interface ChatMessage { id: number; mine: boolean; text: string; at: Date; readAt: Date | null }

interface RawResumen {
  contactos: { id_usuario: number; nombre_completo: string; rol: string; ultimo: string | null; ultima_fecha: string | null; no_leidos: number }[];
  no_leidos: number;
}

const POLL_MS = 15_000;

/** Contactos y no leídos; se actualiza solo cada 15 s mientras el componente esté en pantalla. */
export function useChatSummary(enabled = true) {
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const r = await api<RawResumen>("/mensajes/resumen");
      setContacts(r.contactos.map((c) => ({
        id: c.id_usuario, name: c.nombre_completo, role: c.rol, last: c.ultimo, lastAt: c.ultima_fecha ? new Date(c.ultima_fecha) : null, unread: c.no_leidos,
      })));
      setUnread(r.no_leidos);
    } catch { /* se reintenta en el siguiente ciclo */ }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const t = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(t);
  }, [enabled, refresh]);

  return { contacts, unread, refresh };
}

/** Conversación abierta con un contacto: se refresca cada 4 s. */
export function useConversation(contactId: number | null, onChange?: () => void) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState("");
  const cb = useRef(onChange);
  cb.current = onChange;

  const load = useCallback(async () => {
    if (contactId === null) return;
    try {
      const r = await api<{ mensajes: { id_mensaje: number; mio: boolean; cuerpo: string; fecha_hora: string; leido_en: string | null }[] }>(`/mensajes/conversacion/${contactId}`);
      setMessages((prev) => {
        const next = r.mensajes.map((m) => ({ id: m.id_mensaje, mine: m.mio, text: m.cuerpo, at: new Date(m.fecha_hora), readAt: m.leido_en ? new Date(m.leido_en) : null }));
        return prev.length === next.length && prev.every((p, i) => p.id === next[i]!.id && (p.readAt === null) === (next[i]!.readAt === null)) ? prev : next;
      });
      setError("");
      cb.current?.();
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo cargar la conversación."); }
  }, [contactId]);

  useEffect(() => {
    setMessages([]);
    if (contactId === null) return;
    void load();
    const t = setInterval(() => void load(), 4000);
    return () => clearInterval(t);
  }, [contactId, load]);

  const send = async (text: string) => {
    if (contactId === null) return;
    await api("/mensajes", { body: { para: contactId, texto: text } });
    await load();
  };

  return { messages, error, send };
}
