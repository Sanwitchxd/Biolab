-- =====================================================================
-- BioLab - 03_roles_permisos.sql
-- Roles de MySQL, cuentas de base de datos y permisos mínimos.
-- Los usuarios de conexión usan host '%' (necesario para Docker). Para una
-- instalación nativa puede cambiarlo por 'localhost' (buscar y reemplazar).
-- Ningún rol tiene DELETE, DROP, ALTER ni GRANT.
-- BITACORA: SOLO rol_gerente (SELECT). Los demás roles escriben en ella de
-- forma indirecta (triggers / sp_registrar_bitacora) sin poder leerla.
-- =====================================================================
USE biolab;

CREATE ROLE IF NOT EXISTS 'rol_gerente', 'rol_recepcionista', 'rol_quimico';

-- ============================ GERENTE ================================
-- Supervisa todo, administra usuarios y catálogo, consulta la bitácora.
GRANT SELECT (id_usuario, nombre_completo, nombre_usuario, rol, estado) ON biolab.USUARIO TO 'rol_gerente';
GRANT INSERT, UPDATE ON biolab.USUARIO           TO 'rol_gerente';  -- alta/bloqueo y cambio de contraseña
GRANT SELECT, INSERT, UPDATE ON biolab.ESTUDIO           TO 'rol_gerente';  -- RF-21
GRANT SELECT, INSERT, UPDATE ON biolab.PARAMETRO_ESTUDIO TO 'rol_gerente';  -- RF-21
GRANT SELECT ON biolab.PACIENTE            TO 'rol_gerente';
GRANT SELECT ON biolab.ORDEN               TO 'rol_gerente';
GRANT SELECT ON biolab.DETALLE_ORDEN       TO 'rol_gerente';
GRANT SELECT ON biolab.MUESTRA             TO 'rol_gerente';
GRANT SELECT ON biolab.INCIDENCIA_MUESTRA  TO 'rol_gerente';
GRANT SELECT ON biolab.RESULTADO           TO 'rol_gerente';
GRANT SELECT ON biolab.VALOR_RESULTADO     TO 'rol_gerente';
GRANT SELECT ON biolab.PAGO                TO 'rol_gerente';
GRANT SELECT ON biolab.NOTIFICACION        TO 'rol_gerente';
GRANT SELECT ON biolab.BITACORA            TO 'rol_gerente';  -- EXCLUSIVO del gerente
GRANT SELECT ON biolab.vw_bitacora         TO 'rol_gerente';  -- EXCLUSIVO del gerente
GRANT SELECT ON biolab.vw_corte_caja       TO 'rol_gerente';  -- RF-19 / U16
GRANT SELECT ON biolab.vw_saldo_orden      TO 'rol_gerente';
GRANT SELECT ON biolab.vw_informe_resultado TO 'rol_gerente';
GRANT EXECUTE ON PROCEDURE biolab.sp_login_usuario TO 'rol_gerente';

-- ========================== RECEPCIONISTA ============================
-- Registro de pacientes/órdenes, caja, entrega y avisos. Sin acceso a BITACORA.
GRANT SELECT, INSERT ON biolab.PACIENTE TO 'rol_recepcionista';
GRANT UPDATE (nombre_completo, telefono, tiene_whatsapp) ON biolab.PACIENTE TO 'rol_recepcionista'; -- RF-13
GRANT SELECT ON biolab.ORDEN TO 'rol_recepcionista';  -- se crea con sp_crear_orden
GRANT UPDATE (fecha_cita, indicaciones, estado, motivo_cancelacion, id_usuario_entrega, fecha_entrega)
  ON biolab.ORDEN TO 'rol_recepcionista';              -- RF-01, RF-14 (cancelar), RF-15 (entregar)
GRANT SELECT ON biolab.DETALLE_ORDEN     TO 'rol_recepcionista';  -- se agrega con sp_agregar_estudio_orden
GRANT SELECT ON biolab.ESTUDIO           TO 'rol_recepcionista';
GRANT SELECT ON biolab.PARAMETRO_ESTUDIO TO 'rol_recepcionista';
GRANT SELECT, INSERT ON biolab.MUESTRA   TO 'rol_recepcionista';  -- RF-08
GRANT SELECT, INSERT ON biolab.PAGO      TO 'rol_recepcionista';  -- RF-09, RF-15
GRANT SELECT ON biolab.NOTIFICACION      TO 'rol_recepcionista';
GRANT UPDATE (estado) ON biolab.NOTIFICACION TO 'rol_recepcionista';  -- Enviada / Fallida / Atendida
GRANT SELECT ON biolab.vw_saldo_orden       TO 'rol_recepcionista';
GRANT SELECT ON biolab.vw_informe_resultado TO 'rol_recepcionista';  -- RF-10 (sin precios)
GRANT EXECUTE ON PROCEDURE biolab.sp_login_usuario        TO 'rol_recepcionista';
GRANT EXECUTE ON PROCEDURE biolab.sp_crear_orden          TO 'rol_recepcionista';
GRANT EXECUTE ON PROCEDURE biolab.sp_agregar_estudio_orden TO 'rol_recepcionista';
GRANT EXECUTE ON PROCEDURE biolab.sp_registrar_bitacora   TO 'rol_recepcionista';

-- ============================= QUÍMICO ===============================
-- Muestras, incidencias, captura, validación y liberación. Sin precios ni pagos (RN-01).
GRANT SELECT (id_paciente, nombre_completo) ON biolab.PACIENTE TO 'rol_quimico';
GRANT SELECT (id_orden, folio, id_paciente, fecha_registro, estado) ON biolab.ORDEN TO 'rol_quimico';
GRANT SELECT (id_detalle, id_orden, id_estudio) ON biolab.DETALLE_ORDEN TO 'rol_quimico'; -- sin precio_aplicado
GRANT SELECT (id_estudio, clave, nombre, es_externo, activo) ON biolab.ESTUDIO TO 'rol_quimico'; -- sin precio
GRANT SELECT ON biolab.PARAMETRO_ESTUDIO TO 'rol_quimico';
GRANT SELECT ON biolab.MUESTRA TO 'rol_quimico';
GRANT UPDATE (fecha_recepcion, estado) ON biolab.MUESTRA TO 'rol_quimico';
GRANT SELECT, INSERT ON biolab.INCIDENCIA_MUESTRA TO 'rol_quimico';       -- RF-04
GRANT SELECT, INSERT ON biolab.RESULTADO TO 'rol_quimico';                -- RF-11
GRANT UPDATE (estado, id_usuario_valida, fecha_validacion, fecha_liberacion, ruta_pdf_externo)
  ON biolab.RESULTADO TO 'rol_quimico';                                   -- RF-12, RF-17, RF-18
GRANT SELECT, INSERT ON biolab.VALOR_RESULTADO TO 'rol_quimico';
GRANT UPDATE (valor) ON biolab.VALOR_RESULTADO TO 'rol_quimico';
GRANT EXECUTE ON PROCEDURE biolab.sp_login_usuario      TO 'rol_quimico';
GRANT EXECUTE ON PROCEDURE biolab.sp_registrar_bitacora TO 'rol_quimico';

-- ===================== CUENTAS DE CONEXIÓN (BD) ======================
CREATE USER IF NOT EXISTS 'gerente_biolab'@'%'   IDENTIFIED BY '0pLtk=eo_oXHMpsFdGNc';
CREATE USER IF NOT EXISTS 'recepcion_biolab'@'%' IDENTIFIED BY 'Ds0iXdlFGEoHpPaoXUIa';
CREATE USER IF NOT EXISTS 'quimico_biolab'@'%'   IDENTIFIED BY 'p9ba3JHbX4+#QQjhuW-4';

GRANT 'rol_gerente'       TO 'gerente_biolab'@'%';
GRANT 'rol_recepcionista' TO 'recepcion_biolab'@'%';
GRANT 'rol_quimico'       TO 'quimico_biolab'@'%';

SET DEFAULT ROLE 'rol_gerente'       TO 'gerente_biolab'@'%';
SET DEFAULT ROLE 'rol_recepcionista' TO 'recepcion_biolab'@'%';
SET DEFAULT ROLE 'rol_quimico'       TO 'quimico_biolab'@'%';
