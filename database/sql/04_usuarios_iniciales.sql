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
