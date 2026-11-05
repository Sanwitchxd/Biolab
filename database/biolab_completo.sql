-- =====================================================================
-- BioLab - Laboratorio de análisis clínicos
-- 01_esquema.sql : base de datos y tablas (modelo relacional U2-E2)
-- Motor objetivo: MySQL 8.0 / 8.4 LTS (InnoDB, utf8mb4)
-- Para reinstalar desde cero:  DROP DATABASE biolab;
-- =====================================================================

CREATE DATABASE IF NOT EXISTS biolab
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE biolab;

-- ---------------------------------------------------------------------
-- USUARIO  (RF-05, RF-06) - se bloquea, no se elimina
-- NOTA: el rol "Administrador" del documento U2-E2 se reemplaza por "Gerente".
-- ---------------------------------------------------------------------
CREATE TABLE USUARIO (
  id_usuario       INT AUTO_INCREMENT PRIMARY KEY,
  nombre_completo  VARCHAR(100) NOT NULL,
  nombre_usuario   VARCHAR(30)  NOT NULL,
  contrasena_hash  VARCHAR(255) NOT NULL COMMENT 'bcrypt; nunca texto plano',
  rol              VARCHAR(20)  NOT NULL,
  estado           VARCHAR(10)  NOT NULL DEFAULT 'Activo',
  CONSTRAINT uq_usuario_nombre UNIQUE (nombre_usuario),
  CONSTRAINT ck_usuario_rol    CHECK (rol IN ('Gerente','Recepcionista','Químico')),
  CONSTRAINT ck_usuario_estado CHECK (estado IN ('Activo','Bloqueado'))
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- PACIENTE (RF-13, RF-16, RN-04)
-- ---------------------------------------------------------------------
CREATE TABLE PACIENTE (
  id_paciente      INT AUTO_INCREMENT PRIMARY KEY,
  nombre_completo  VARCHAR(100) NOT NULL,
  telefono         VARCHAR(15)  NULL,
  tiene_whatsapp   BOOLEAN      NOT NULL DEFAULT FALSE,
  fecha_registro   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- ESTUDIO / PARAMETRO_ESTUDIO (RF-09, RF-11, RF-12, RF-21)
-- ---------------------------------------------------------------------
CREATE TABLE ESTUDIO (
  id_estudio   INT AUTO_INCREMENT PRIMARY KEY,
  clave        VARCHAR(20)   NOT NULL,
  nombre       VARCHAR(100)  NOT NULL,
  precio       DECIMAL(10,2) NOT NULL,
  es_externo   BOOLEAN       NOT NULL DEFAULT FALSE,
  activo       BOOLEAN       NOT NULL DEFAULT TRUE,
  CONSTRAINT uq_estudio_clave  UNIQUE (clave),
  CONSTRAINT ck_estudio_precio CHECK (precio >= 0)
) ENGINE=InnoDB;

CREATE TABLE PARAMETRO_ESTUDIO (
  id_parametro INT AUTO_INCREMENT PRIMARY KEY,
  id_estudio   INT          NOT NULL,
  nombre       VARCHAR(80)  NOT NULL,
  unidad       VARCHAR(20)  NULL,
  CONSTRAINT fk_param_estudio FOREIGN KEY (id_estudio) REFERENCES ESTUDIO (id_estudio)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- ORDEN (RF-01, RF-07, RF-14, RF-16) - cancelación lógica (RN-02)
-- ---------------------------------------------------------------------
CREATE TABLE ORDEN (
  id_orden            INT AUTO_INCREMENT PRIMARY KEY,
  folio               VARCHAR(20)  NOT NULL COMMENT 'LMT-AAAAMMDD-001',
  id_paciente         INT          NOT NULL,
  id_usuario_registra INT          NOT NULL,
  fecha_registro      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_cita          DATETIME     NULL,
  indicaciones        TEXT         NULL,
  estado              VARCHAR(15)  NOT NULL DEFAULT 'Registrada',
  motivo_cancelacion  VARCHAR(255) NULL,
  id_usuario_entrega  INT          NULL,
  fecha_entrega       DATETIME     NULL,
  CONSTRAINT uq_orden_folio UNIQUE (folio),
  CONSTRAINT fk_orden_paciente FOREIGN KEY (id_paciente)         REFERENCES PACIENTE (id_paciente),
  CONSTRAINT fk_orden_registra FOREIGN KEY (id_usuario_registra) REFERENCES USUARIO  (id_usuario),
  CONSTRAINT fk_orden_entrega  FOREIGN KEY (id_usuario_entrega)  REFERENCES USUARIO  (id_usuario),
  CONSTRAINT ck_orden_estado CHECK (estado IN
     ('Registrada','En proceso','Validada','Liberada','Entregada','Cancelada')),
  CONSTRAINT ck_orden_cancel CHECK (estado <> 'Cancelada'
     OR (motivo_cancelacion IS NOT NULL AND CHAR_LENGTH(TRIM(motivo_cancelacion)) > 0))
) ENGINE=InnoDB;

-- N:M ORDEN - ESTUDIO
CREATE TABLE DETALLE_ORDEN (
  id_detalle      INT AUTO_INCREMENT PRIMARY KEY,
  id_orden        INT           NOT NULL,
  id_estudio      INT           NOT NULL,
  precio_aplicado DECIMAL(10,2) NOT NULL COMMENT 'precio cobrado al momento de la orden',
  CONSTRAINT uq_detalle UNIQUE (id_orden, id_estudio),
  CONSTRAINT fk_detalle_orden   FOREIGN KEY (id_orden)   REFERENCES ORDEN   (id_orden),
  CONSTRAINT fk_detalle_estudio FOREIGN KEY (id_estudio) REFERENCES ESTUDIO (id_estudio),
  CONSTRAINT ck_detalle_precio CHECK (precio_aplicado >= 0)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- MUESTRA / INCIDENCIA_MUESTRA (RF-04, RF-08)
-- ---------------------------------------------------------------------
CREATE TABLE MUESTRA (
  id_muestra      INT AUTO_INCREMENT PRIMARY KEY,
  id_orden        INT         NOT NULL,
  fecha_recepcion DATETIME    NULL,
  estado          VARCHAR(15) NOT NULL DEFAULT 'Pendiente',
  CONSTRAINT fk_muestra_orden FOREIGN KEY (id_orden) REFERENCES ORDEN (id_orden),
  CONSTRAINT ck_muestra_estado CHECK (estado IN
     ('Pendiente','Recibida','Con incidencia','Procesada'))
) ENGINE=InnoDB;

CREATE TABLE INCIDENCIA_MUESTRA (
  id_incidencia INT AUTO_INCREMENT PRIMARY KEY,
  id_muestra    INT          NOT NULL,
  id_usuario    INT          NOT NULL,
  tipo          VARCHAR(20)  NOT NULL,
  descripcion   VARCHAR(255) NULL,
  fecha_hora    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_inc_muestra FOREIGN KEY (id_muestra) REFERENCES MUESTRA (id_muestra),
  CONSTRAINT fk_inc_usuario FOREIGN KEY (id_usuario) REFERENCES USUARIO (id_usuario),
  CONSTRAINT ck_inc_tipo CHECK (tipo IN ('Hemolizada','Dañada','Otra'))
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- RESULTADO / VALOR_RESULTADO (RF-10, RF-11, RF-12, RF-17, RF-18)
-- ---------------------------------------------------------------------
CREATE TABLE RESULTADO (
  id_resultado       INT AUTO_INCREMENT PRIMARY KEY,
  id_detalle         INT          NOT NULL,
  estado             VARCHAR(12)  NOT NULL DEFAULT 'Capturado',
  id_usuario_captura INT          NOT NULL,
  fecha_captura      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  id_usuario_valida  INT          NULL,
  fecha_validacion   DATETIME     NULL,
  fecha_liberacion   DATETIME     NULL,
  ruta_pdf_externo   VARCHAR(255) NULL,
  CONSTRAINT uq_resultado_detalle UNIQUE (id_detalle),
  CONSTRAINT fk_res_detalle FOREIGN KEY (id_detalle)         REFERENCES DETALLE_ORDEN (id_detalle),
  CONSTRAINT fk_res_captura FOREIGN KEY (id_usuario_captura) REFERENCES USUARIO (id_usuario),
  CONSTRAINT fk_res_valida  FOREIGN KEY (id_usuario_valida)  REFERENCES USUARIO (id_usuario),
  CONSTRAINT ck_res_estado CHECK (estado IN ('Capturado','Validado','Liberado'))
) ENGINE=InnoDB;

CREATE TABLE VALOR_RESULTADO (
  id_valor     INT AUTO_INCREMENT PRIMARY KEY,
  id_resultado INT         NOT NULL,
  id_parametro INT         NOT NULL,
  valor        VARCHAR(50) NOT NULL,
  CONSTRAINT uq_valor UNIQUE (id_resultado, id_parametro),
  CONSTRAINT fk_valor_resultado FOREIGN KEY (id_resultado) REFERENCES RESULTADO (id_resultado),
  CONSTRAINT fk_valor_parametro FOREIGN KEY (id_parametro) REFERENCES PARAMETRO_ESTUDIO (id_parametro)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- PAGO (RF-09, RF-15, RF-19) - el saldo se calcula, no se guarda
-- ---------------------------------------------------------------------
CREATE TABLE PAGO (
  id_pago     INT AUTO_INCREMENT PRIMARY KEY,
  id_orden    INT           NOT NULL,
  id_usuario  INT           NOT NULL,
  monto       DECIMAL(10,2) NOT NULL,
  metodo_pago VARCHAR(15)   NOT NULL,
  tipo        VARCHAR(15)   NOT NULL,
  fecha_hora  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pago_orden   FOREIGN KEY (id_orden)   REFERENCES ORDEN   (id_orden),
  CONSTRAINT fk_pago_usuario FOREIGN KEY (id_usuario) REFERENCES USUARIO (id_usuario),
  CONSTRAINT ck_pago_monto  CHECK (monto > 0),
  CONSTRAINT ck_pago_metodo CHECK (metodo_pago IN ('Efectivo','Tarjeta','Transferencia')),
  CONSTRAINT ck_pago_tipo   CHECK (tipo IN ('Anticipo','Abono','Liquidación'))
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- NOTIFICACION (RF-01, RF-02, RF-03, RN-04)
-- ---------------------------------------------------------------------
CREATE TABLE NOTIFICACION (
  id_notificacion INT AUTO_INCREMENT PRIMARY KEY,
  id_orden        INT         NOT NULL,
  tipo            VARCHAR(25) NOT NULL,
  canal           VARCHAR(25) NOT NULL COMMENT 'VARCHAR(25): "Pantalla de recepción" mide 21 caracteres',
  estado          VARCHAR(12) NOT NULL DEFAULT 'Pendiente',
  fecha_hora      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notif_orden FOREIGN KEY (id_orden) REFERENCES ORDEN (id_orden),
  CONSTRAINT ck_notif_tipo   CHECK (tipo   IN ('Recordatorio','Resultado listo','Alerta de retoma')),
  CONSTRAINT ck_notif_canal  CHECK (canal  IN ('WhatsApp','Pantalla de recepción','Físico en sucursal')),
  CONSTRAINT ck_notif_estado CHECK (estado IN ('Pendiente','Enviada','Fallida','Atendida'))
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- BITACORA (RF-06, RF-20, RNF-02) - inmutable y solo visible al Gerente
-- ---------------------------------------------------------------------
CREATE TABLE BITACORA (
  id_bitacora INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario  INT          NOT NULL,
  id_orden    INT          NULL,
  accion      VARCHAR(50)  NOT NULL,
  detalle     VARCHAR(255) NULL,
  fecha_hora  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_bit_usuario FOREIGN KEY (id_usuario) REFERENCES USUARIO (id_usuario),
  CONSTRAINT fk_bit_orden   FOREIGN KEY (id_orden)   REFERENCES ORDEN   (id_orden),
  INDEX ix_bit_fecha (fecha_hora),
  INDEX ix_bit_accion (accion)
) ENGINE=InnoDB;
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
-- =====================================================================
-- BioLab - 04_usuarios_iniciales.sql
-- Usuarios de la APLICACIÓN (tabla USUARIO). Contraseñas con bcrypt (cost 12).
-- Cambie las contraseñas tras el primer inicio de sesión.
-- =====================================================================
USE biolab;

INSERT INTO USUARIO (nombre_completo, nombre_usuario, contrasena_hash, rol, estado) VALUES
 ('Gerente BioLab',       'gerente01',   '$2b$12$wfnmmcCRsT0xG7k/YSaUCO6A4PsKBmZTPc6xme1mEYV/Ti5YE3.6O',   'Gerente',       'Activo'),
 ('Recepcionista BioLab', 'recepcion01', '$2b$12$l/ZmC6md8tVTqFXWU1Z5zuSGVOwn8QyRqDcd6KY2cdJyi7KM2ZO6u', 'Recepcionista', 'Activo'),
 ('Químico BioLab',       'quimico01',   '$2b$12$ofhafGpPQm6xsxNFuG9Tq.EOPMF3PObHYNU4DhxlMyyDyf9671ko2',   'Químico',       'Activo');

INSERT INTO BITACORA (id_usuario, accion, detalle)
SELECT id_usuario, 'INSTALACION', 'Base de datos BioLab creada' FROM USUARIO WHERE nombre_usuario = 'gerente01';
