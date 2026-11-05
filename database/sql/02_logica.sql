-- =====================================================================
-- BioLab - 02_logica.sql
-- Funciones, procedimientos, triggers (reglas de negocio + bitácora),
-- vistas y evento de recordatorios.
-- Se ejecuta como root (los objetos quedan con DEFINER = root; por eso
-- los roles pueden usarlos sin tener acceso directo a BITACORA).
-- =====================================================================
USE biolab;
DELIMITER $$

-- ---------------------------------------------------------------------
-- FUNCIONES
-- ---------------------------------------------------------------------
-- Usuario "actor" informado por la aplicación tras el login:
--   SET @app_usuario_id = <id_usuario>;
CREATE FUNCTION fn_actor() RETURNS INT
  NOT DETERMINISTIC NO SQL
BEGIN
  RETURN @app_usuario_id;
END$$

-- Saldo = suma de DETALLE_ORDEN - suma de PAGO (derivado, no se guarda)
CREATE FUNCTION fn_saldo_orden(p_id_orden INT) RETURNS DECIMAL(10,2)
  NOT DETERMINISTIC READS SQL DATA
BEGIN
  DECLARE v_total DECIMAL(10,2);
  DECLARE v_pagado DECIMAL(10,2);
  SELECT COALESCE(SUM(precio_aplicado),0) INTO v_total  FROM DETALLE_ORDEN WHERE id_orden = p_id_orden;
  SELECT COALESCE(SUM(monto),0)           INTO v_pagado FROM PAGO          WHERE id_orden = p_id_orden;
  RETURN v_total - v_pagado;
END$$

-- ---------------------------------------------------------------------
-- PROCEDIMIENTOS (interfaz que usa la aplicación)
-- ---------------------------------------------------------------------

-- Autenticación (RF-05): devuelve el usuario para que la app compare el hash bcrypt.
CREATE PROCEDURE sp_login_usuario(IN p_nombre_usuario VARCHAR(30))
  SQL SECURITY DEFINER
BEGIN
  SELECT id_usuario, nombre_completo, contrasena_hash, rol, estado
    FROM USUARIO WHERE nombre_usuario = p_nombre_usuario;
END$$

-- Único camino de escritura a BITACORA para Recepcionista/Químico (RF-06, RNF-02)
CREATE PROCEDURE sp_registrar_bitacora(IN p_id_usuario INT, IN p_accion VARCHAR(50),
                                       IN p_detalle VARCHAR(255), IN p_id_orden INT)
  SQL SECURITY DEFINER
BEGIN
  IF NOT EXISTS (SELECT 1 FROM USUARIO WHERE id_usuario = p_id_usuario AND estado = 'Activo') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Usuario inexistente o bloqueado';
  END IF;
  INSERT INTO BITACORA (id_usuario, id_orden, accion, detalle)
  VALUES (p_id_usuario, p_id_orden, p_accion, p_detalle);
END$$

-- Crea la orden con folio LMT-AAAAMMDD-001 (RF-07, RF-16, I1)
CREATE PROCEDURE sp_crear_orden(IN p_id_paciente INT, IN p_id_usuario INT,
                                IN p_fecha_cita DATETIME, IN p_indicaciones TEXT,
                                OUT p_id_orden INT, OUT p_folio VARCHAR(20))
  SQL SECURITY DEFINER
BEGIN
  DECLARE v_pref VARCHAR(17);
  DECLARE v_n INT;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    DO RELEASE_LOCK('biolab_folio');
    RESIGNAL;
  END;

  IF NOT EXISTS (SELECT 1 FROM USUARIO WHERE id_usuario = p_id_usuario
                 AND estado = 'Activo' AND rol = 'Recepcionista') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Solo un Recepcionista activo puede registrar órdenes';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM PACIENTE WHERE id_paciente = p_id_paciente) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Paciente inexistente';
  END IF;
  IF GET_LOCK('biolab_folio', 5) <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No se pudo generar el folio, intente de nuevo';
  END IF;

  SET v_pref = CONCAT('LMT-', DATE_FORMAT(NOW(), '%Y%m%d'), '-');
  SELECT COALESCE(MAX(CAST(SUBSTRING(folio, 14) AS UNSIGNED)), 0) + 1 INTO v_n
    FROM ORDEN WHERE folio LIKE CONCAT(v_pref, '%');
  SET p_folio = CONCAT(v_pref, LPAD(v_n, 3, '0'));

  INSERT INTO ORDEN (folio, id_paciente, id_usuario_registra, fecha_cita, indicaciones)
  VALUES (p_folio, p_id_paciente, p_id_usuario, p_fecha_cita, p_indicaciones);
  SET p_id_orden = LAST_INSERT_ID();

  DO RELEASE_LOCK('biolab_folio');
END$$

-- Agrega un estudio a la orden tomando el precio vigente del catálogo (RF-09)
CREATE PROCEDURE sp_agregar_estudio_orden(IN p_id_orden INT, IN p_id_estudio INT)
  SQL SECURITY DEFINER
BEGIN
  DECLARE v_precio DECIMAL(10,2) DEFAULT NULL;
  SELECT precio INTO v_precio FROM ESTUDIO WHERE id_estudio = p_id_estudio AND activo = TRUE;
  IF v_precio IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Estudio inexistente o inactivo';
  END IF;
  INSERT INTO DETALLE_ORDEN (id_orden, id_estudio, precio_aplicado)
  VALUES (p_id_orden, p_id_estudio, v_precio);
END$$

-- Validación interna de VALOR_RESULTADO (la llaman los triggers; no se concede a roles)
CREATE PROCEDURE sp_interno_chk_valor(IN p_id_resultado INT, IN p_id_parametro INT)
BEGIN
  DECLARE v_est VARCHAR(12);
  DECLARE v_estudio INT;
  DECLARE v_pest INT;
  SELECT r.estado, d.id_estudio INTO v_est, v_estudio
    FROM RESULTADO r JOIN DETALLE_ORDEN d ON d.id_detalle = r.id_detalle
   WHERE r.id_resultado = p_id_resultado;
  IF v_est <> 'Capturado' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RN-03: el resultado ya fue validado y no puede editarse';
  END IF;
  SELECT id_estudio INTO v_pest FROM PARAMETRO_ESTUDIO WHERE id_parametro = p_id_parametro;
  IF v_pest IS NULL OR v_pest <> v_estudio THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El parámetro no pertenece al estudio del resultado';
  END IF;
END$$

-- ---------------------------------------------------------------------
-- TRIGGERS : USUARIO
-- ---------------------------------------------------------------------
CREATE TRIGGER trg_usuario_bd BEFORE DELETE ON USUARIO FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Los usuarios no se eliminan: use estado = Bloqueado';
END$$

CREATE TRIGGER trg_usuario_ai AFTER INSERT ON USUARIO FOR EACH ROW
BEGIN
  IF fn_actor() IS NOT NULL THEN
    INSERT INTO BITACORA (id_usuario, accion, detalle)
    VALUES (fn_actor(), 'CREAR_USUARIO', CONCAT('Usuario ', NEW.nombre_usuario, ' (', NEW.rol, ')'));
  END IF;
END$$

CREATE TRIGGER trg_usuario_au AFTER UPDATE ON USUARIO FOR EACH ROW
BEGIN
  IF fn_actor() IS NOT NULL THEN
    INSERT INTO BITACORA (id_usuario, accion, detalle)
    VALUES (fn_actor(), 'MODIFICAR_USUARIO',
            LEFT(CONCAT('Usuario ', NEW.nombre_usuario,
                        '; estado ', OLD.estado, '->', NEW.estado,
                        '; rol ', OLD.rol, '->', NEW.rol,
                        IF(OLD.contrasena_hash <> NEW.contrasena_hash, '; contraseña cambiada', '')), 255));
  END IF;
END$$

-- ---------------------------------------------------------------------
-- TRIGGERS : ESTUDIO (catálogo, RF-21)
-- ---------------------------------------------------------------------
CREATE TRIGGER trg_estudio_ai AFTER INSERT ON ESTUDIO FOR EACH ROW
BEGIN
  IF fn_actor() IS NOT NULL THEN
    INSERT INTO BITACORA (id_usuario, accion, detalle)
    VALUES (fn_actor(), 'CREAR_ESTUDIO', CONCAT(NEW.clave, ' precio ', NEW.precio));
  END IF;
END$$

CREATE TRIGGER trg_estudio_au AFTER UPDATE ON ESTUDIO FOR EACH ROW
BEGIN
  IF fn_actor() IS NOT NULL THEN
    INSERT INTO BITACORA (id_usuario, accion, detalle)
    VALUES (fn_actor(), 'MODIFICAR_ESTUDIO',
            LEFT(CONCAT(NEW.clave, '; precio ', OLD.precio, '->', NEW.precio,
                        '; activo ', OLD.activo, '->', NEW.activo), 255));
  END IF;
END$$

-- ---------------------------------------------------------------------
-- TRIGGERS : PACIENTE (RF-13, RN-03)
-- ---------------------------------------------------------------------
CREATE TRIGGER trg_paciente_bd BEFORE DELETE ON PACIENTE FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Los pacientes no se eliminan';
END$$

CREATE TRIGGER trg_paciente_bi BEFORE INSERT ON PACIENTE FOR EACH ROW
BEGIN
  IF fn_actor() IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Defina SET @app_usuario_id antes de registrar pacientes';
  END IF;
END$$

CREATE TRIGGER trg_paciente_bu BEFORE UPDATE ON PACIENTE FOR EACH ROW
BEGIN
  IF fn_actor() IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Defina SET @app_usuario_id antes de modificar pacientes';
  END IF;
  -- RN-03: no se corrigen datos mientras haya resultados validados sin entregar
  IF EXISTS (SELECT 1
               FROM ORDEN o
               JOIN DETALLE_ORDEN d ON d.id_orden = o.id_orden
               JOIN RESULTADO r     ON r.id_detalle = d.id_detalle
              WHERE o.id_paciente = OLD.id_paciente
                AND o.estado NOT IN ('Entregada','Cancelada')
                AND r.fecha_validacion IS NOT NULL) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RN-03: el paciente tiene resultados validados; datos bloqueados';
  END IF;
END$$

CREATE TRIGGER trg_paciente_ai AFTER INSERT ON PACIENTE FOR EACH ROW
BEGIN
  INSERT INTO BITACORA (id_usuario, accion, detalle)
  VALUES (fn_actor(), 'REGISTRAR_PACIENTE', CONCAT('Paciente ', NEW.id_paciente));
END$$

CREATE TRIGGER trg_paciente_au AFTER UPDATE ON PACIENTE FOR EACH ROW
BEGIN
  INSERT INTO BITACORA (id_usuario, accion, detalle)
  VALUES (fn_actor(), 'MODIFICAR_PACIENTE', CONCAT('Paciente ', NEW.id_paciente));
END$$

-- ---------------------------------------------------------------------
-- TRIGGERS : ORDEN (RF-14, RN-02, RN-05)
-- ---------------------------------------------------------------------
CREATE TRIGGER trg_orden_bd BEFORE DELETE ON ORDEN FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RN-02: las órdenes no se eliminan, se cancelan';
END$$

CREATE TRIGGER trg_orden_bu BEFORE UPDATE ON ORDEN FOR EACH ROW
BEGIN
  IF OLD.estado IN ('Cancelada','Entregada') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La orden está cancelada o entregada y ya no puede modificarse';
  END IF;
  IF NEW.folio <> OLD.folio OR NEW.id_paciente <> OLD.id_paciente
     OR NEW.id_usuario_registra <> OLD.id_usuario_registra THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Folio, paciente y usuario de registro son inmutables';
  END IF;
  IF NEW.estado = 'Cancelada' THEN
    IF NEW.motivo_cancelacion IS NULL OR CHAR_LENGTH(TRIM(NEW.motivo_cancelacion)) = 0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RN-02: la cancelación requiere justificación';
    END IF;
    IF fn_actor() IS NULL THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Defina SET @app_usuario_id antes de cancelar una orden';
    END IF;
  END IF;
  IF NEW.estado = 'Entregada' THEN
    IF OLD.estado <> 'Liberada' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Solo se entregan órdenes con resultados liberados';
    END IF;
    IF NEW.id_usuario_entrega IS NULL THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Indique quién entrega (id_usuario_entrega)';
    END IF;
    IF fn_saldo_orden(OLD.id_orden) <> 0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RN-05: la orden tiene saldo pendiente';
    END IF;
    IF NEW.fecha_entrega IS NULL THEN
      SET NEW.fecha_entrega = NOW();
    END IF;
  END IF;
END$$

CREATE TRIGGER trg_orden_ai AFTER INSERT ON ORDEN FOR EACH ROW
BEGIN
  INSERT INTO BITACORA (id_usuario, id_orden, accion, detalle)
  VALUES (NEW.id_usuario_registra, NEW.id_orden, 'CREAR_ORDEN', CONCAT('Folio ', NEW.folio));
END$$

CREATE TRIGGER trg_orden_au AFTER UPDATE ON ORDEN FOR EACH ROW
BEGIN
  DECLARE v_wa TINYINT DEFAULT 0;
  IF NEW.estado <> OLD.estado THEN
    IF NEW.estado = 'Cancelada' THEN
      INSERT INTO BITACORA (id_usuario, id_orden, accion, detalle)
      VALUES (fn_actor(), NEW.id_orden, 'CANCELAR_ORDEN', LEFT(CONCAT('Motivo: ', NEW.motivo_cancelacion), 255));
    ELSEIF NEW.estado = 'Entregada' THEN
      INSERT INTO BITACORA (id_usuario, id_orden, accion, detalle)
      VALUES (NEW.id_usuario_entrega, NEW.id_orden, 'ENTREGAR_ORDEN', CONCAT('Folio ', NEW.folio));
    ELSE
      INSERT INTO BITACORA (id_usuario, id_orden, accion, detalle)
      VALUES (COALESCE(fn_actor(), NEW.id_usuario_registra), NEW.id_orden, 'CAMBIO_ESTADO_ORDEN',
              CONCAT(OLD.estado, ' -> ', NEW.estado));
    END IF;

    -- RF-02 / RF-03 / RN-04: al liberarse toda la orden se generan los avisos
    IF NEW.estado = 'Liberada' THEN
      SELECT tiene_whatsapp INTO v_wa FROM PACIENTE WHERE id_paciente = NEW.id_paciente;
      INSERT INTO NOTIFICACION (id_orden, tipo, canal, estado)
      VALUES (NEW.id_orden, 'Resultado listo', 'Pantalla de recepción', 'Pendiente');
      INSERT INTO NOTIFICACION (id_orden, tipo, canal, estado)
      VALUES (NEW.id_orden, 'Resultado listo', IF(v_wa = 1, 'WhatsApp', 'Físico en sucursal'), 'Pendiente');
    END IF;
  ELSEIF NOT (NEW.fecha_cita <=> OLD.fecha_cita) OR NOT (NEW.indicaciones <=> OLD.indicaciones) THEN
    INSERT INTO BITACORA (id_usuario, id_orden, accion, detalle)
    VALUES (COALESCE(fn_actor(), NEW.id_usuario_registra), NEW.id_orden, 'MODIFICAR_ORDEN',
            'Cambio de cita o indicaciones');
  END IF;
END$$

-- ---------------------------------------------------------------------
-- TRIGGERS : DETALLE_ORDEN
-- ---------------------------------------------------------------------
CREATE TRIGGER trg_detalle_bi BEFORE INSERT ON DETALLE_ORDEN FOR EACH ROW
BEGIN
  DECLARE v_est VARCHAR(15);
  SELECT estado INTO v_est FROM ORDEN WHERE id_orden = NEW.id_orden;
  IF v_est IN ('Cancelada','Entregada') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No se agregan estudios a una orden cancelada o entregada';
  END IF;
END$$

CREATE TRIGGER trg_detalle_ai AFTER INSERT ON DETALLE_ORDEN FOR EACH ROW
BEGIN
  DECLARE v_reg INT;
  SELECT id_usuario_registra INTO v_reg FROM ORDEN WHERE id_orden = NEW.id_orden;
  INSERT INTO BITACORA (id_usuario, id_orden, accion, detalle)
  VALUES (COALESCE(fn_actor(), v_reg), NEW.id_orden, 'AGREGAR_ESTUDIO', CONCAT('Estudio ', NEW.id_estudio));
END$$

-- ---------------------------------------------------------------------
-- TRIGGERS : MUESTRA / INCIDENCIA_MUESTRA (RF-04, I5)
-- ---------------------------------------------------------------------
CREATE TRIGGER trg_muestra_ai AFTER INSERT ON MUESTRA FOR EACH ROW
BEGIN
  DECLARE v_reg INT;
  SELECT id_usuario_registra INTO v_reg FROM ORDEN WHERE id_orden = NEW.id_orden;
  INSERT INTO BITACORA (id_usuario, id_orden, accion, detalle)
  VALUES (COALESCE(fn_actor(), v_reg), NEW.id_orden, 'REGISTRAR_MUESTRA', CONCAT('Muestra ', NEW.id_muestra));
END$$

CREATE TRIGGER trg_muestra_au AFTER UPDATE ON MUESTRA FOR EACH ROW
BEGIN
  IF fn_actor() IS NOT NULL AND NEW.estado <> OLD.estado AND NEW.estado <> 'Con incidencia' THEN
    INSERT INTO BITACORA (id_usuario, id_orden, accion, detalle)
    VALUES (fn_actor(), NEW.id_orden, 'ACTUALIZAR_MUESTRA',
            CONCAT('Muestra ', NEW.id_muestra, ': ', OLD.estado, ' -> ', NEW.estado));
  END IF;
END$$

CREATE TRIGGER trg_incidencia_ai AFTER INSERT ON INCIDENCIA_MUESTRA FOR EACH ROW
BEGIN
  DECLARE v_orden INT;
  SELECT id_orden INTO v_orden FROM MUESTRA WHERE id_muestra = NEW.id_muestra;
  UPDATE MUESTRA SET estado = 'Con incidencia' WHERE id_muestra = NEW.id_muestra;
  INSERT INTO NOTIFICACION (id_orden, tipo, canal, estado)
  VALUES (v_orden, 'Alerta de retoma', 'Pantalla de recepción', 'Pendiente');
  INSERT INTO BITACORA (id_usuario, id_orden, accion, detalle)
  VALUES (NEW.id_usuario, v_orden, 'INCIDENCIA_MUESTRA', CONCAT('Muestra ', NEW.id_muestra, ': ', NEW.tipo));
END$$

-- ---------------------------------------------------------------------
-- TRIGGERS : RESULTADO (RF-11, RF-12, RF-17, RF-18, RN-03)
-- ---------------------------------------------------------------------
CREATE TRIGGER trg_resultado_bd BEFORE DELETE ON RESULTADO FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Los resultados no se eliminan';
END$$

CREATE TRIGGER trg_resultado_bi BEFORE INSERT ON RESULTADO FOR EACH ROW
BEGIN
  DECLARE v_est VARCHAR(15);
  DECLARE v_ext TINYINT;
  SELECT o.estado, e.es_externo INTO v_est, v_ext
    FROM DETALLE_ORDEN d
    JOIN ORDEN o   ON o.id_orden = d.id_orden
    JOIN ESTUDIO e ON e.id_estudio = d.id_estudio
   WHERE d.id_detalle = NEW.id_detalle;
  IF v_est IN ('Cancelada','Entregada') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No se capturan resultados en una orden cancelada o entregada';
  END IF;
  IF NEW.estado <> 'Capturado' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Un resultado nuevo inicia en estado Capturado';
  END IF;
  IF NEW.ruta_pdf_externo IS NOT NULL AND v_ext = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Solo los estudios externos admiten PDF de laboratorio de referencia';
  END IF;
END$$

CREATE TRIGGER trg_resultado_ai AFTER INSERT ON RESULTADO FOR EACH ROW
BEGIN
  DECLARE v_ord INT;
  SELECT id_orden INTO v_ord FROM DETALLE_ORDEN WHERE id_detalle = NEW.id_detalle;
  UPDATE ORDEN SET estado = 'En proceso' WHERE id_orden = v_ord AND estado = 'Registrada';
  INSERT INTO BITACORA (id_usuario, id_orden, accion, detalle)
  VALUES (NEW.id_usuario_captura, v_ord, 'CAPTURAR_RESULTADO', CONCAT('Resultado ', NEW.id_resultado));
END$$

CREATE TRIGGER trg_resultado_bu BEFORE UPDATE ON RESULTADO FOR EACH ROW
BEGIN
  DECLARE v_ext TINYINT;
  IF NEW.id_detalle <> OLD.id_detalle OR NEW.id_usuario_captura <> OLD.id_usuario_captura
     OR NEW.fecha_captura <> OLD.fecha_captura THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Los datos de captura son inmutables';
  END IF;

  IF NOT (NEW.ruta_pdf_externo <=> OLD.ruta_pdf_externo) AND NEW.ruta_pdf_externo IS NOT NULL THEN
    SELECT e.es_externo INTO v_ext
      FROM DETALLE_ORDEN d JOIN ESTUDIO e ON e.id_estudio = d.id_estudio
     WHERE d.id_detalle = OLD.id_detalle;
    IF v_ext = 0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Solo los estudios externos admiten PDF de laboratorio de referencia';
    END IF;
  END IF;

  IF OLD.estado = 'Capturado' THEN
    IF NEW.estado = 'Liberado' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Debe validarse antes de liberar';
    ELSEIF NEW.estado = 'Validado' THEN
      IF NEW.id_usuario_valida IS NULL OR NOT EXISTS
         (SELECT 1 FROM USUARIO WHERE id_usuario = NEW.id_usuario_valida
            AND rol = 'Químico' AND estado = 'Activo') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La validación requiere un Químico activo (id_usuario_valida)';
      END IF;
      SET NEW.fecha_validacion = COALESCE(NEW.fecha_validacion, NOW());
    ELSEIF NEW.id_usuario_valida IS NOT NULL OR NEW.fecha_validacion IS NOT NULL THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Para validar cambie también el estado a Validado';
    END IF;
  ELSEIF OLD.estado = 'Validado' THEN
    -- RN-03: validado = congelado; solo se permite pasar a Liberado
    IF NEW.estado = 'Capturado' OR NOT (NEW.id_usuario_valida <=> OLD.id_usuario_valida)
       OR NOT (NEW.fecha_validacion <=> OLD.fecha_validacion)
       OR NOT (NEW.ruta_pdf_externo <=> OLD.ruta_pdf_externo) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RN-03: resultado validado, solo puede liberarse';
    END IF;
    IF NEW.estado = 'Liberado' THEN
      SET NEW.fecha_liberacion = COALESCE(NEW.fecha_liberacion, NOW());
    END IF;
  ELSE
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Resultado liberado: no modificable';
  END IF;
END$$

CREATE TRIGGER trg_resultado_au AFTER UPDATE ON RESULTADO FOR EACH ROW
BEGIN
  DECLARE v_ord INT;
  DECLARE v_total INT DEFAULT 0;
  DECLARE v_val INT DEFAULT 0;
  DECLARE v_lib INT DEFAULT 0;
  IF NEW.estado <> OLD.estado THEN
    SELECT id_orden INTO v_ord FROM DETALLE_ORDEN WHERE id_detalle = NEW.id_detalle;

    IF NEW.estado = 'Validado' THEN
      INSERT INTO BITACORA (id_usuario, id_orden, accion, detalle)
      VALUES (NEW.id_usuario_valida, v_ord, 'VALIDAR_RESULTADO', CONCAT('Resultado ', NEW.id_resultado));
    ELSEIF NEW.estado = 'Liberado' THEN
      INSERT INTO BITACORA (id_usuario, id_orden, accion, detalle)
      VALUES (COALESCE(fn_actor(), NEW.id_usuario_valida), v_ord, 'LIBERAR_RESULTADO',
              CONCAT('Resultado ', NEW.id_resultado));
    END IF;

    -- Estado de la orden según el avance de todos sus estudios
    SELECT COUNT(*) INTO v_total FROM DETALLE_ORDEN WHERE id_orden = v_ord;
    SELECT COALESCE(SUM(r.estado IN ('Validado','Liberado')), 0),
           COALESCE(SUM(r.estado = 'Liberado'), 0)
      INTO v_val, v_lib
      FROM RESULTADO r JOIN DETALLE_ORDEN d ON d.id_detalle = r.id_detalle
     WHERE d.id_orden = v_ord;

    IF v_lib = v_total THEN
      UPDATE ORDEN SET estado = 'Liberada'
       WHERE id_orden = v_ord AND estado IN ('Registrada','En proceso','Validada');
    ELSEIF v_val = v_total THEN
      UPDATE ORDEN SET estado = 'Validada'
       WHERE id_orden = v_ord AND estado IN ('Registrada','En proceso');
    END IF;
  END IF;
END$$

-- ---------------------------------------------------------------------
-- TRIGGERS : VALOR_RESULTADO (RN-03)
-- ---------------------------------------------------------------------
CREATE TRIGGER trg_valor_bi BEFORE INSERT ON VALOR_RESULTADO FOR EACH ROW
BEGIN
  CALL sp_interno_chk_valor(NEW.id_resultado, NEW.id_parametro);
END$$

CREATE TRIGGER trg_valor_bu BEFORE UPDATE ON VALOR_RESULTADO FOR EACH ROW
BEGIN
  IF NEW.id_resultado <> OLD.id_resultado OR NEW.id_parametro <> OLD.id_parametro THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Solo puede modificarse el valor capturado';
  END IF;
  CALL sp_interno_chk_valor(NEW.id_resultado, NEW.id_parametro);
END$$

-- ---------------------------------------------------------------------
-- TRIGGERS : PAGO (RF-09, RF-15)
-- ---------------------------------------------------------------------
CREATE TRIGGER trg_pago_bi BEFORE INSERT ON PAGO FOR EACH ROW
BEGIN
  DECLARE v_est VARCHAR(15);
  DECLARE v_saldo DECIMAL(10,2);
  IF NOT EXISTS (SELECT 1 FROM USUARIO WHERE id_usuario = NEW.id_usuario
                 AND rol = 'Recepcionista' AND estado = 'Activo') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Los pagos los registra un Recepcionista activo';
  END IF;
  SELECT estado INTO v_est FROM ORDEN WHERE id_orden = NEW.id_orden;
  IF v_est IN ('Cancelada','Entregada') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No se registran pagos en una orden cancelada o entregada';
  END IF;
  SET v_saldo = fn_saldo_orden(NEW.id_orden);
  IF NEW.monto > v_saldo THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El pago excede el saldo de la orden (agregue primero los estudios)';
  END IF;
  IF NEW.tipo = 'Liquidación' AND NEW.monto <> v_saldo THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La liquidación debe cubrir exactamente el saldo';
  END IF;
END$$

CREATE TRIGGER trg_pago_bu BEFORE UPDATE ON PAGO FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Los pagos son eventos históricos: no se modifican';
END$$

CREATE TRIGGER trg_pago_bd BEFORE DELETE ON PAGO FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Los pagos son eventos históricos: no se eliminan';
END$$

CREATE TRIGGER trg_pago_ai AFTER INSERT ON PAGO FOR EACH ROW
BEGIN
  INSERT INTO BITACORA (id_usuario, id_orden, accion, detalle)
  VALUES (NEW.id_usuario, NEW.id_orden, 'REGISTRAR_PAGO',
          CONCAT(NEW.tipo, ' $', NEW.monto, ' (', NEW.metodo_pago, ')'));
END$$

-- ---------------------------------------------------------------------
-- TRIGGERS : BITACORA inmutable (RNF-02)
-- ---------------------------------------------------------------------
CREATE TRIGGER trg_bitacora_bu BEFORE UPDATE ON BITACORA FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RNF-02: la bitácora es inmutable';
END$$

CREATE TRIGGER trg_bitacora_bd BEFORE DELETE ON BITACORA FOR EACH ROW
BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'RNF-02: la bitácora es inmutable';
END$$

-- ---------------------------------------------------------------------
-- EVENTO: recordatorio un día antes de la cita, a las 17:00 (RF-01)
-- Requiere event_scheduler = ON (ver README).
-- ---------------------------------------------------------------------
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
  END$$

DELIMITER ;

-- ---------------------------------------------------------------------
-- VISTAS
-- ---------------------------------------------------------------------
-- Total, pagado y saldo por orden (ticket de caja, RF-09)
CREATE VIEW vw_saldo_orden AS
SELECT o.id_orden, o.folio, o.estado,
       COALESCE((SELECT SUM(d.precio_aplicado) FROM DETALLE_ORDEN d WHERE d.id_orden = o.id_orden), 0) AS total,
       COALESCE((SELECT SUM(p.monto) FROM PAGO p WHERE p.id_orden = o.id_orden), 0)                    AS pagado,
       fn_saldo_orden(o.id_orden)                                                                      AS saldo
  FROM ORDEN o;

-- Corte de caja por día y método de pago (RF-19, U16)
CREATE VIEW vw_corte_caja AS
SELECT DATE(fecha_hora) AS fecha, metodo_pago, COUNT(*) AS num_pagos, SUM(monto) AS total
  FROM PAGO
 GROUP BY DATE(fecha_hora), metodo_pago;

-- Informe clínico sin precios ni saldos (RF-10, RN-01); solo resultados liberados
CREATE VIEW vw_informe_resultado AS
SELECT o.id_orden, o.folio, pa.nombre_completo AS paciente,
       e.clave AS estudio_clave, e.nombre AS estudio, pe.nombre AS parametro, pe.unidad,
       v.valor, r.estado, r.fecha_liberacion, r.ruta_pdf_externo
  FROM RESULTADO r
  JOIN DETALLE_ORDEN d ON d.id_detalle = r.id_detalle
  JOIN ORDEN o         ON o.id_orden   = d.id_orden
  JOIN PACIENTE pa     ON pa.id_paciente = o.id_paciente
  JOIN ESTUDIO e       ON e.id_estudio = d.id_estudio
  LEFT JOIN VALOR_RESULTADO v      ON v.id_resultado = r.id_resultado
  LEFT JOIN PARAMETRO_ESTUDIO pe   ON pe.id_parametro = v.id_parametro
 WHERE r.estado = 'Liberado';

-- Bitácora legible (RF-20, U15). SOLO el Gerente tendrá acceso.
CREATE VIEW vw_bitacora AS
SELECT b.id_bitacora, b.fecha_hora, u.nombre_usuario, u.rol, b.accion, o.folio, b.detalle
  FROM BITACORA b
  JOIN USUARIO u      ON u.id_usuario = b.id_usuario
  LEFT JOIN ORDEN o   ON o.id_orden   = b.id_orden;
