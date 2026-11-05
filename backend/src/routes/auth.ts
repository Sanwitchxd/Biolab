import { Router } from "express";
import {
  authenticate, buscarUsuarioLogin, compararContrasena, firmarToken, HASH_RELLENO, hashContrasena, ROL_PARA_LOGIN,
} from "../auth/auth.js";
import { getConfig } from "../config/config.js";
import { withConnection } from "../database/db.js";
import { HttpError } from "../middleware/errors.js";
import { AttemptLimiter } from "../middleware/limiter.js";
import { esRol, MODULO_POR_ROL } from "../auth/roles.js";

export function createAuthRouter(): Router {
  const { login } = getConfig();
  // Dos límites de intentos FALLIDOS: por usuario y por IP (la IP admite más, por oficinas con una sola salida).
  const porUsuario = new AttemptLimiter(login.maxIntentos, login.ventanaMs);
  const porIp = new AttemptLimiter(login.maxIntentos * 4, login.ventanaMs);

  const router = Router();

  /** POST /api/auth/login  { usuario, contrasena }  ->  { token, usuario:{...} } */
  router.post("/login", async (req, res) => {
    const cuerpo = (req.body ?? {}) as { usuario?: unknown; contrasena?: unknown };
    const usuario = typeof cuerpo.usuario === "string" ? cuerpo.usuario.trim() : "";
    const contrasena = typeof cuerpo.contrasena === "string" ? cuerpo.contrasena : "";
    if (!usuario || !contrasena || usuario.length > 30 || contrasena.length > 128) {
      throw new HttpError(400, "Escribe tu usuario y tu contraseña.", "DATOS_INCOMPLETOS");
    }

    const claveUsuario = usuario.toLowerCase();
    const claveIp = req.ip ?? "desconocida";
    const espera = Math.max(porUsuario.segundosBloqueado(claveUsuario), porIp.segundosBloqueado(claveIp));
    if (espera > 0) {
      res.set("Retry-After", String(espera));
      throw new HttpError(429, `Demasiados intentos fallidos. Intenta de nuevo en ${Math.ceil(espera / 60)} minuto(s).`, "DEMASIADOS_INTENTOS");
    }

    // 1) CALL sp_login_usuario  2) bcrypt  3) estado = 'Activo'
    const fila = await buscarUsuarioLogin(ROL_PARA_LOGIN, usuario);
    const coincide = await compararContrasena(contrasena, fila?.contrasena_hash ?? HASH_RELLENO);
    if (!fila || !coincide) {
      porUsuario.registrarFallo(claveUsuario);
      porIp.registrarFallo(claveIp);
      throw new HttpError(401, "Usuario o contraseña incorrectos.", "CREDENCIALES");
    }
    if (fila.estado !== "Activo") {
      throw new HttpError(403, "Tu cuenta está bloqueada. Contacta al gerente.", "CUENTA_BLOQUEADA");
    }
    if (!esRol(fila.rol)) {
      throw new HttpError(500, "El rol de este usuario no es reconocido por el sistema.", "ROL_DESCONOCIDO");
    }
    const rol = fila.rol;

    // Bitácora: INICIO_SESION con la cuenta de BD del propio rol. El Gerente no tiene EXECUTE sobre
    // sp_registrar_bitacora (ver PERMISOS.md), por eso su inicio de sesión no se registra.
    if (rol !== "Gerente") {
      await withConnection(rol, fila.id_usuario, (conn) =>
        conn.query("CALL sp_registrar_bitacora(?, ?, ?, ?)", [fila.id_usuario, "INICIO_SESION", null, null]),
      );
    }

    porUsuario.reiniciar(claveUsuario);
    const token = firmarToken({ id: fila.id_usuario, usuario, nombre: fila.nombre_completo, rol });
    res.json({
      token,
      tipo: "Bearer",
      expiraEn: getConfig().jwt.expiresIn,
      usuario: { id: fila.id_usuario, usuario, nombre: fila.nombre_completo, rol, modulo: MODULO_POR_ROL[rol] },
    });
  });

  /** GET /api/auth/me  ->  datos del token (útil para restaurar la sesión al recargar la página) */
  router.get("/me", authenticate, (req, res) => {
    const u = req.user!;
    res.json({ usuario: { ...u, modulo: MODULO_POR_ROL[u.rol] } });
  });

  /**
   * POST /api/auth/cambiar-contrasena  { actual, nueva }
   * Solo el Gerente tiene UPDATE sobre USUARIO. Recepción y químico no pueden cambiarla ellos mismos
   * (sin ampliar permisos de MySQL): el gerente se la restablece desde Gestión de usuarios.
   */
  router.post("/cambiar-contrasena", authenticate, async (req, res) => {
    const u = req.user!;
    if (u.rol !== "Gerente") {
      throw new HttpError(403, "Tu cuenta no puede cambiar la contraseña desde el sistema. Pide al gerente que la restablezca.", "SIN_PERMISO_CAMBIO");
    }
    const cuerpo = (req.body ?? {}) as { actual?: unknown; nueva?: unknown };
    const actual = typeof cuerpo.actual === "string" ? cuerpo.actual : "";
    const nueva = typeof cuerpo.nueva === "string" ? cuerpo.nueva : "";
    if (nueva.length < 8 || Buffer.byteLength(nueva) > 72) {
      throw new HttpError(400, "La nueva contraseña debe tener entre 8 y 72 caracteres.", "DATOS_INVALIDOS");
    }
    if (nueva === actual) throw new HttpError(400, "La nueva contraseña debe ser distinta a la actual.", "DATOS_INVALIDOS");

    const fila = await buscarUsuarioLogin(u.rol, u.usuario);
    if (!fila || !(await compararContrasena(actual, fila.contrasena_hash))) {
      throw new HttpError(400, "La contraseña actual es incorrecta.", "CONTRASENA_ACTUAL");
    }
    const hash = await hashContrasena(nueva);
    await withConnection(u.rol, u.id, (conn) =>
      conn.query("UPDATE USUARIO SET contrasena_hash = ? WHERE id_usuario = ?", [hash, u.id]),
    );
    res.json({ ok: true });
  });

  return router;
}
