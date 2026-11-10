import { useEffect, useRef } from "react";

/**
 * Mantiene los datos al día sin tener que recargar la página: vuelve a pedirlos cada `ms` milisegundos
 * mientras la pestaña está visible, y en cuanto el usuario regresa a ella. Nunca hace dos cargas a la vez.
 */
export function useAutoRefresh(reload: () => Promise<unknown>, enabled: boolean, ms = 8000) {
  const fn = useRef(reload);
  fn.current = reload;
  const busy = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    const tick = async () => {
      if (busy.current || document.visibilityState !== "visible") return;
      busy.current = true;
      try { await fn.current(); } catch { /* se conservan los datos que ya se muestran; se reintenta en el siguiente ciclo */ } finally { busy.current = false; }
    };
    const timer = setInterval(() => void tick(), ms);
    const onVisible = () => void tick();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("focus", onVisible); };
  }, [enabled, ms]);
}
