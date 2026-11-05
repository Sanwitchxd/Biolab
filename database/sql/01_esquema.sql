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
