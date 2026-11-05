/**
 * Límite de intentos fallidos en memoria (ventana deslizante).
 * Suficiente para un solo servidor; si algún día hay varios, mover a Redis/BD.
 */
export class AttemptLimiter {
  private readonly fallos = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly ventanaMs: number,
    private readonly ahora: () => number = Date.now,
  ) {
    // limpieza periódica para que el mapa no crezca; unref() no mantiene vivo el proceso
    setInterval(() => this.limpiar(), Math.min(ventanaMs, 60_000)).unref();
  }

  private vigentes(clave: string): number[] {
    const desde = this.ahora() - this.ventanaMs;
    const lista = (this.fallos.get(clave) ?? []).filter((t) => t > desde);
    if (lista.length) this.fallos.set(clave, lista);
    else this.fallos.delete(clave);
    return lista;
  }

  /** Segundos que faltan para poder reintentar; 0 si no está bloqueado. */
  segundosBloqueado(clave: string): number {
    const lista = this.vigentes(clave);
    if (lista.length < this.max) return 0;
    const libera = lista[lista.length - this.max]! + this.ventanaMs;
    return Math.max(1, Math.ceil((libera - this.ahora()) / 1000));
  }

  registrarFallo(clave: string): void {
    const lista = this.vigentes(clave);
    lista.push(this.ahora());
    this.fallos.set(clave, lista);
  }

  reiniciar(clave: string): void {
    this.fallos.delete(clave);
  }

  private limpiar(): void {
    for (const clave of [...this.fallos.keys()]) this.vigentes(clave);
  }
}
