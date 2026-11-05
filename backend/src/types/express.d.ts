import type { Rol } from "../auth/roles.js";

declare global {
  namespace Express {
    interface Request {
      /** Usuario autenticado. Sale SIEMPRE del JWT firmado, nunca de lo que mande el cliente. */
      user?: { id: number; usuario: string; nombre: string; rol: Rol };
    }
  }
}

export {};
