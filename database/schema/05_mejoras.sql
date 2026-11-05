-- =====================================================================
-- BioLab - 05_mejoras.sql  (versión 2)
--   * Sueldos y pagos de nómina del personal (solo Gerente)
--   * Mensajería interna entre usuarios (Gerente, Recepcionista, Químico)
--   * Cola de mensajes de WhatsApp (recordatorios, preparación, resultados listos)
--   * Rangos de referencia y listas de opciones en los parámetros de estudio
-- Se ejecuta UNA vez, después de 01..04 (los instaladores lo hacen solos; si la base
-- ya existía, la actualizan sin borrar datos).  Requiere MySQL 8.x y cuenta root.
-- =====================================================================
USE biolab;

-- ---------------------------------------------------------------------
-- 1) Parámetros de estudio: referencia y opciones
-- ---------------------------------------------------------------------
ALTER TABLE PARAMETRO_ESTUDIO
  ADD COLUMN rango_referencia VARCHAR(60)  NULL COMMENT 'Ej. "70 - 100", "< 200" o, en cualitativos, los valores esperados separados por coma' AFTER unidad,
  ADD COLUMN opciones         VARCHAR(200) NULL COMMENT 'Lista cerrada separada por coma (parámetros cualitativos)' AFTER rango_referencia;

-- ---------------------------------------------------------------------
-- 2) ORDEN: preferencias de WhatsApp de esta orden
-- ---------------------------------------------------------------------
ALTER TABLE ORDEN
  ADD COLUMN acepta_recordatorio      TINYINT(1)   NOT NULL DEFAULT 0 COMMENT 'RF-01: el paciente acepta recordatorio por WhatsApp',
  ADD COLUMN acepta_aviso_resultados  TINYINT(1)   NOT NULL DEFAULT 0 COMMENT 'RF-03: el paciente acepta aviso de resultados listos',
  ADD COLUMN preparacion_mensaje      VARCHAR(500) NULL COMMENT 'Indicaciones de preparación que se envían por WhatsApp',
  ADD COLUMN recordatorio_envio       DATETIME     NULL COMMENT 'Cuándo enviar el mensaje de preparación (NULL = el día anterior a las 17:00)';

-- ---------------------------------------------------------------------
-- 3) Nómina (solo Gerente)
-- ---------------------------------------------------------------------
CREATE TABLE SUELDO_USUARIO (
  id_usuario   INT           NOT NULL PRIMARY KEY,
  salario      DECIMAL(10,2) NOT NULL COMMENT 'Monto por periodo de pago',
  periodicidad VARCHAR(10)   NOT NULL,
  fecha_inicio DATE          NOT NULL COMMENT 'Desde cuándo se generan pagos (Semanal: primer día de pago)',
  CONSTRAINT fk_sueldo_usuario FOREIGN KEY (id_usuario) REFERENCES USUARIO (id_usuario),
  CONSTRAINT ck_sueldo_monto   CHECK (salario >= 0),
  CONSTRAINT ck_sueldo_period  CHECK (periodicidad IN ('Semanal','Quincenal','Mensual'))
) ENGINE=InnoDB;

CREATE TABLE PAGO_NOMINA (
  id_pago_nomina      INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario          INT           NOT NULL COMMENT 'Empleado que recibe el pago',
  fecha_corresponde   DATE          NOT NULL COMMENT 'Fecha de pago del periodo que se liquida',
  monto               DECIMAL(10,2) NOT NULL,
  metodo_pago         VARCHAR(15)   NOT NULL,
  nota                VARCHAR(255)  NULL,
  id_usuario_registra INT           NOT NULL,
  fecha_hora          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_nomina_periodo UNIQUE (id_usuario, fecha_corresponde),
  CONSTRAINT fk_nomina_usuario  FOREIGN KEY (id_usuario)          REFERENCES USUARIO (id_usuario),
  CONSTRAINT fk_nomina_registra FOREIGN KEY (id_usuario_registra) REFERENCES USUARIO (id_usuario),
  CONSTRAINT ck_nomina_monto  CHECK (monto > 0),
  CONSTRAINT ck_nomina_metodo CHECK (metodo_pago IN ('Efectivo','Transferencia','Cheque'))
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 4) Mensajería interna
-- ---------------------------------------------------------------------
CREATE TABLE MENSAJE (
  id_mensaje      BIGINT AUTO_INCREMENT PRIMARY KEY,
  id_remitente    INT           NOT NULL,
  id_destinatario INT           NOT NULL,
  cuerpo          VARCHAR(1000) NOT NULL,
  fecha_hora      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  leido_en        DATETIME      NULL,
  CONSTRAINT fk_msg_remitente    FOREIGN KEY (id_remitente)    REFERENCES USUARIO (id_usuario),
  CONSTRAINT fk_msg_destinatario FOREIGN KEY (id_destinatario) REFERENCES USUARIO (id_usuario),
  CONSTRAINT ck_msg_distintos CHECK (id_remitente <> id_destinatario),
  CONSTRAINT ck_msg_cuerpo    CHECK (CHAR_LENGTH(TRIM(cuerpo)) > 0),
  INDEX ix_msg_dest  (id_destinatario, leido_en),
  INDEX ix_msg_par   (id_remitente, id_destinatario)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 5) Cola de WhatsApp (RF-01, RF-03, RN-04)
-- ---------------------------------------------------------------------
CREATE TABLE WHATSAPP_COLA (
  id_wa           INT AUTO_INCREMENT PRIMARY KEY,
  id_orden        INT           NULL,
  id_paciente     INT           NOT NULL,
  telefono        VARCHAR(15)   NOT NULL,
  tipo            VARCHAR(20)   NOT NULL,
  cuerpo          VARCHAR(1000) NOT NULL,
  programado_para DATETIME      NOT NULL,
  estado          VARCHAR(10)   NOT NULL DEFAULT 'Pendiente',
  intentos        TINYINT       NOT NULL DEFAULT 0,
  error           VARCHAR(255)  NULL,
  fecha_envio     DATETIME      NULL,
  id_usuario_crea INT           NULL,
  creado          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_wa_orden    FOREIGN KEY (id_orden)        REFERENCES ORDEN    (id_orden),
  CONSTRAINT fk_wa_paciente FOREIGN KEY (id_paciente)     REFERENCES PACIENTE (id_paciente),
  CONSTRAINT fk_wa_usuario  FOREIGN KEY (id_usuario_crea) REFERENCES USUARIO  (id_usuario),
  CONSTRAINT ck_wa_tipo   CHECK (tipo   IN ('Recordatorio','Preparación','Resultado listo','Manual')),
  CONSTRAINT ck_wa_estado CHECK (estado IN ('Pendiente','Enviado','Fallido','Cancelado')),
  INDEX ix_wa_cola (estado, programado_para)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- Vista del informe clínico: ahora con la referencia del parámetro (sigue sin precios, RN-01)
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW vw_informe_resultado AS
SELECT o.id_orden, o.folio, pa.nombre_completo AS paciente,
       e.clave AS estudio_clave, e.nombre AS estudio, pe.nombre AS parametro, pe.unidad,
       v.valor, r.estado, r.fecha_liberacion, r.ruta_pdf_externo,
       pe.rango_referencia AS referencia
  FROM RESULTADO r
  JOIN DETALLE_ORDEN d ON d.id_detalle = r.id_detalle
  JOIN ORDEN o         ON o.id_orden   = d.id_orden
  JOIN PACIENTE pa     ON pa.id_paciente = o.id_paciente
  JOIN ESTUDIO e       ON e.id_estudio = d.id_estudio
  LEFT JOIN VALOR_RESULTADO v      ON v.id_resultado = r.id_resultado
  LEFT JOIN PARAMETRO_ESTUDIO pe   ON pe.id_parametro = v.id_parametro
 WHERE r.estado = 'Liberado';

-- Contactos para el chat: solo nombre y rol de cuentas activas (sin contraseñas ni usuarios de acceso)
CREATE OR REPLACE VIEW vw_contactos AS
SELECT id_usuario, nombre_completo, rol FROM USUARIO WHERE estado = 'Activo';

-- Cada cuenta solo ve los mensajes en los que participa (fn_actor() = usuario de la sesión)
CREATE OR REPLACE VIEW vw_mis_mensajes AS
SELECT id_mensaje, id_remitente, id_destinatario, cuerpo, fecha_hora, leido_en
  FROM MENSAJE
 WHERE id_remitente = fn_actor() OR id_destinatario = fn_actor();

DELIMITER $$

-- ---------------------------------------------------------------------
-- Procedimientos
-- ---------------------------------------------------------------------
CREATE PROCEDURE sp_enviar_mensaje(IN p_destinatario INT, IN p_cuerpo VARCHAR(1000))
  SQL SECURITY DEFINER
BEGIN
  DECLARE v_yo INT DEFAULT fn_actor();
  IF v_yo IS NULL OR NOT EXISTS (SELECT 1 FROM USUARIO WHERE id_usuario = v_yo AND estado = 'Activo') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Sesión no válida para enviar mensajes';
  END IF;
  IF p_destinatario = v_yo THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No puedes enviarte mensajes a ti mismo';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM USUARIO WHERE id_usuario = p_destinatario AND estado = 'Activo') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El destinatario no existe o está inactivo';
  END IF;
  INSERT INTO MENSAJE (id_remitente, id_destinatario, cuerpo) VALUES (v_yo, p_destinatario, TRIM(p_cuerpo));
END$$

CREATE PROCEDURE sp_marcar_leidos(IN p_remitente INT)
  SQL SECURITY DEFINER
BEGIN
  UPDATE MENSAJE SET leido_en = NOW()
   WHERE id_destinatario = fn_actor() AND id_remitente = p_remitente AND leido_en IS NULL;
END$$

-- WhatsApp manual desde Recepción (solo si el paciente autoriza WhatsApp)
CREATE PROCEDURE sp_encolar_whatsapp(IN p_id_paciente INT, IN p_cuerpo VARCHAR(1000), IN p_programado DATETIME)
  SQL SECURITY DEFINER
BEGIN
  DECLARE v_tel VARCHAR(15);
  DECLARE v_wa  TINYINT;
  IF fn_actor() IS NULL OR NOT EXISTS (SELECT 1 FROM USUARIO WHERE id_usuario = fn_actor() AND rol = 'Recepcionista' AND estado = 'Activo') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Solo un Recepcionista activo puede programar mensajes';
  END IF;
  SELECT telefono, tiene_whatsapp INTO v_tel, v_wa FROM PACIENTE WHERE id_paciente = p_id_paciente;
  IF v_wa IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Paciente inexistente';
  END IF;
  IF v_wa = 0 OR v_tel IS NULL OR v_tel = '' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RN-04: el paciente no autorizó WhatsApp; el aviso es en físico';
  END IF;
  IF CHAR_LENGTH(TRIM(p_cuerpo)) = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El mensaje está vacío';
  END IF;
  INSERT INTO WHATSAPP_COLA (id_paciente, telefono, tipo, cuerpo, programado_para, id_usuario_crea)
  VALUES (p_id_paciente, v_tel, 'Manual', TRIM(p_cuerpo), COALESCE(p_programado, NOW()), fn_actor());
END$$

-- ---------------------------------------------------------------------
-- Triggers: mensajes y cola inmutables (solo cambian los campos de estado)
-- ---------------------------------------------------------------------
CREATE TRIGGER trg_mensaje_bu BEFORE UPDATE ON MENSAJE FOR EACH ROW
BEGIN
  IF NEW.id_remitente <> OLD.id_remitente OR NEW.id_destinatario <> OLD.id_destinatario
     OR NEW.cuerpo <> OLD.cuerpo OR NEW.fecha_hora <> OLD.fecha_hora THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Los mensajes no se modifican';
  END IF;
END$$

CREATE TRIGGER trg_mensaje_bd BEFORE DELETE ON MENSAJE FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Los mensajes no se eliminan';
END$$

CREATE TRIGGER trg_wa_bu BEFORE UPDATE ON WHATSAPP_COLA FOR EACH ROW
BEGIN
  IF NEW.id_orden <=> OLD.id_orden AND NEW.id_paciente = OLD.id_paciente AND NEW.telefono = OLD.telefono
     AND NEW.tipo = OLD.tipo AND NEW.cuerpo = OLD.cuerpo AND NEW.programado_para = OLD.programado_para THEN
    IF OLD.estado IN ('Enviado','Cancelado') AND NEW.estado <> OLD.estado THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Un mensaje enviado o cancelado ya no cambia de estado';
    END IF;
  ELSE
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Solo puede cambiar el estado del envío';
  END IF;
END$$

CREATE TRIGGER trg_wa_bd BEFORE DELETE ON WHATSAPP_COLA FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Los mensajes de WhatsApp no se eliminan: se cancelan';
END$$

CREATE TRIGGER trg_wa_au AFTER UPDATE ON WHATSAPP_COLA FOR EACH ROW
BEGIN
  IF fn_actor() IS NOT NULL AND NEW.estado <> OLD.estado THEN
    INSERT INTO BITACORA (id_usuario, id_orden, accion, detalle)
    VALUES (fn_actor(), NEW.id_orden, 'WHATSAPP', CONCAT('Mensaje ', NEW.id_wa, ' (', NEW.tipo, '): ', OLD.estado, ' -> ', NEW.estado));
  END IF;
END$$

-- ---------------------------------------------------------------------
-- Triggers: nómina
-- ---------------------------------------------------------------------
CREATE TRIGGER trg_nomina_bu BEFORE UPDATE ON PAGO_NOMINA FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Los pagos de nómina son eventos históricos: no se modifican';
END$$

CREATE TRIGGER trg_nomina_bd BEFORE DELETE ON PAGO_NOMINA FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Los pagos de nómina son eventos históricos: no se eliminan';
END$$

CREATE TRIGGER trg_nomina_ai AFTER INSERT ON PAGO_NOMINA FOR EACH ROW
BEGIN
  INSERT INTO BITACORA (id_usuario, accion, detalle)
  VALUES (NEW.id_usuario_registra, 'PAGO_NOMINA',
          CONCAT('Empleado ', NEW.id_usuario, ': $', NEW.monto, ' del periodo ', NEW.fecha_corresponde, ' (', NEW.metodo_pago, ')'));
END$$

CREATE TRIGGER trg_sueldo_ai AFTER INSERT ON SUELDO_USUARIO FOR EACH ROW
BEGIN
  IF fn_actor() IS NOT NULL THEN
    INSERT INTO BITACORA (id_usuario, accion, detalle)
    VALUES (fn_actor(), 'DEFINIR_SUELDO', CONCAT('Empleado ', NEW.id_usuario, ': $', NEW.salario, ' ', NEW.periodicidad));
  END IF;
END$$

CREATE TRIGGER trg_sueldo_au AFTER UPDATE ON SUELDO_USUARIO FOR EACH ROW
BEGIN
  IF fn_actor() IS NOT NULL THEN
    INSERT INTO BITACORA (id_usuario, accion, detalle)
    VALUES (fn_actor(), 'DEFINIR_SUELDO',
            LEFT(CONCAT('Empleado ', NEW.id_usuario, ': $', OLD.salario, '->', NEW.salario, ' ', OLD.periodicidad, '->', NEW.periodicidad), 255));
  END IF;
END$$

-- ---------------------------------------------------------------------
-- Triggers sobre ORDEN: WhatsApp automático (se ejecutan después de los existentes)
-- ---------------------------------------------------------------------
CREATE TRIGGER trg_orden_au_wa AFTER UPDATE ON ORDEN FOR EACH ROW FOLLOWS trg_orden_au
BEGIN
  DECLARE v_wa  TINYINT DEFAULT 0;
  DECLARE v_tel VARCHAR(15);
  DECLARE v_nom VARCHAR(100);
  SELECT tiene_whatsapp, telefono, SUBSTRING_INDEX(TRIM(nombre_completo), ' ', 1)
    INTO v_wa, v_tel, v_nom FROM PACIENTE WHERE id_paciente = NEW.id_paciente;

  -- Orden cancelada: se anulan los avisos que no han salido
  IF NEW.estado = 'Cancelada' AND OLD.estado <> 'Cancelada' THEN
    UPDATE WHATSAPP_COLA SET estado = 'Cancelado'
     WHERE id_orden = NEW.id_orden AND estado = 'Pendiente' AND tipo IN ('Recordatorio','Preparación');
  END IF;

  -- RF-03: resultados listos (toda la orden liberada) -> WhatsApp, solo si el paciente lo autorizó
  IF NEW.estado = 'Liberada' AND OLD.estado <> 'Liberada'
     AND NEW.acepta_aviso_resultados = 1 AND v_wa = 1 AND v_tel IS NOT NULL AND v_tel <> '' THEN
    INSERT INTO WHATSAPP_COLA (id_orden, id_paciente, telefono, tipo, cuerpo, programado_para)
    VALUES (NEW.id_orden, NEW.id_paciente, v_tel, 'Resultado listo',
            CONCAT('Hola ', v_nom, ', tus resultados de BioLab (folio ', NEW.folio, ') ya están listos. Puedes pasar a recogerlos en sucursal. ¡Gracias!'),
            NOW());
  END IF;

  -- RF-01: mensaje de preparación a la hora elegida (se reprograma si cambian los datos)
  IF NEW.estado NOT IN ('Cancelada','Entregada')
     AND (NOT (NEW.acepta_recordatorio <=> OLD.acepta_recordatorio)
          OR NOT (NEW.preparacion_mensaje <=> OLD.preparacion_mensaje)
          OR NOT (NEW.recordatorio_envio <=> OLD.recordatorio_envio)) THEN
    UPDATE WHATSAPP_COLA SET estado = 'Cancelado'
     WHERE id_orden = NEW.id_orden AND tipo = 'Preparación' AND estado = 'Pendiente';
    IF NEW.acepta_recordatorio = 1 AND v_wa = 1 AND v_tel IS NOT NULL AND v_tel <> ''
       AND NEW.recordatorio_envio IS NOT NULL
       AND NEW.preparacion_mensaje IS NOT NULL AND CHAR_LENGTH(TRIM(NEW.preparacion_mensaje)) > 0 THEN
      INSERT INTO WHATSAPP_COLA (id_orden, id_paciente, telefono, tipo, cuerpo, programado_para)
      VALUES (NEW.id_orden, NEW.id_paciente, v_tel, 'Preparación',
              CONCAT('Hola ', v_nom, ', recordatorio de BioLab (folio ', NEW.folio, '): ', TRIM(NEW.preparacion_mensaje)),
              NEW.recordatorio_envio);
    END IF;
  END IF;
END$$

-- ---------------------------------------------------------------------
-- RN-03 reforzada: los datos del paciente quedan bloqueados mientras su trámite más
-- reciente tenga resultados validados, también DESPUÉS de entregarlos. Se desbloquean
-- cuando el paciente abre una nueva orden (nueva visita).
-- ---------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_paciente_bu$$
CREATE TRIGGER trg_paciente_bu BEFORE UPDATE ON PACIENTE FOR EACH ROW
BEGIN
  DECLARE v_ultima INT;
  IF fn_actor() IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Defina SET @app_usuario_id antes de modificar pacientes';
  END IF;
  IF EXISTS (SELECT 1
               FROM ORDEN o
               JOIN DETALLE_ORDEN d ON d.id_orden = o.id_orden
               JOIN RESULTADO r     ON r.id_detalle = d.id_detalle
              WHERE o.id_paciente = OLD.id_paciente
                AND o.estado NOT IN ('Entregada','Cancelada')
                AND r.fecha_validacion IS NOT NULL) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RN-03: el paciente tiene resultados validados; datos bloqueados';
  END IF;
  SELECT MAX(id_orden) INTO v_ultima FROM ORDEN WHERE id_paciente = OLD.id_paciente AND estado <> 'Cancelada';
  IF v_ultima IS NOT NULL AND EXISTS (SELECT 1
                                        FROM DETALLE_ORDEN d JOIN RESULTADO r ON r.id_detalle = d.id_detalle
                                       WHERE d.id_orden = v_ultima AND r.fecha_validacion IS NOT NULL) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RN-03: los resultados de su última visita ya fueron validados; datos bloqueados';
  END IF;
END$$

-- ---------------------------------------------------------------------
-- Evento diario 17:00 (RF-01): ahora también deja el recordatorio en la cola de WhatsApp
-- ---------------------------------------------------------------------
DROP EVENT IF EXISTS ev_recordatorio_citas$$
CREATE EVENT ev_recordatorio_citas
  ON SCHEDULE EVERY 1 DAY STARTS TIMESTAMP(CURRENT_DATE, '17:00:00')
  DO
  BEGIN
    INSERT INTO NOTIFICACION (id_orden, tipo, canal, estado)
    SELECT o.id_orden, 'Recordatorio',
           IF(p.tiene_whatsapp = 1, 'WhatsApp', 'Físico en sucursal'), 'Pendiente'
      FROM ORDEN o JOIN PACIENTE p ON p.id_paciente = o.id_paciente
     WHERE DATE(o.fecha_cita) = CURRENT_DATE + INTERVAL 1 DAY
       AND o.estado NOT IN ('Cancelada','Entregada')
       AND NOT EXISTS (SELECT 1 FROM NOTIFICACION n
                        WHERE n.id_orden = o.id_orden AND n.tipo = 'Recordatorio');

    -- Solo órdenes sin hora de envío personalizada (esas ya tienen su mensaje de "Preparación")
    INSERT INTO WHATSAPP_COLA (id_orden, id_paciente, telefono, tipo, cuerpo, programado_para)
    SELECT o.id_orden, p.id_paciente, p.telefono, 'Recordatorio',
           CONCAT('Hola ', SUBSTRING_INDEX(TRIM(p.nombre_completo), ' ', 1), ', te recordamos tu cita en BioLab mañana a las ',
                  DATE_FORMAT(o.fecha_cita, '%H:%i'), ' (folio ', o.folio, '). ',
                  COALESCE(NULLIF(TRIM(o.preparacion_mensaje), ''), 'Presenta una identificación oficial.')),
           NOW()
      FROM ORDEN o JOIN PACIENTE p ON p.id_paciente = o.id_paciente
     WHERE DATE(o.fecha_cita) = CURRENT_DATE + INTERVAL 1 DAY
       AND o.estado NOT IN ('Cancelada','Entregada')
       AND o.acepta_recordatorio = 1 AND o.recordatorio_envio IS NULL
       AND p.tiene_whatsapp = 1 AND p.telefono IS NOT NULL AND p.telefono <> ''
       AND NOT EXISTS (SELECT 1 FROM WHATSAPP_COLA w
                        WHERE w.id_orden = o.id_orden AND w.tipo = 'Recordatorio');
  END$$

DELIMITER ;

-- ---------------------------------------------------------------------
-- Permisos (mínimos; ningún rol recibe DELETE)
-- ---------------------------------------------------------------------
-- Gerente: sueldos y nómina
GRANT SELECT, INSERT, UPDATE ON biolab.SUELDO_USUARIO TO 'rol_gerente';
GRANT SELECT, INSERT         ON biolab.PAGO_NOMINA    TO 'rol_gerente';
GRANT SELECT                 ON biolab.WHATSAPP_COLA  TO 'rol_gerente';

-- Recepción: preferencias de WhatsApp de la orden y cola de envíos
GRANT UPDATE (acepta_recordatorio, acepta_aviso_resultados, preparacion_mensaje, recordatorio_envio)
  ON biolab.ORDEN TO 'rol_recepcionista';
GRANT SELECT ON biolab.WHATSAPP_COLA TO 'rol_recepcionista';
GRANT UPDATE (estado, intentos, error, fecha_envio) ON biolab.WHATSAPP_COLA TO 'rol_recepcionista';
GRANT EXECUTE ON PROCEDURE biolab.sp_encolar_whatsapp TO 'rol_recepcionista';

-- Chat: los tres roles (solo a través de las vistas y procedimientos)
GRANT SELECT ON biolab.vw_contactos    TO 'rol_gerente', 'rol_recepcionista', 'rol_quimico';
GRANT SELECT ON biolab.vw_mis_mensajes TO 'rol_gerente', 'rol_recepcionista', 'rol_quimico';
GRANT EXECUTE ON PROCEDURE biolab.sp_enviar_mensaje TO 'rol_gerente', 'rol_recepcionista', 'rol_quimico';
GRANT EXECUTE ON PROCEDURE biolab.sp_marcar_leidos  TO 'rol_gerente', 'rol_recepcionista', 'rol_quimico';
