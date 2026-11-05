-- =====================================================================
-- BioLab - 05_catalogo_ejemplo.sql  (OPCIONAL, datos de EJEMPLO)
-- Precios y parámetros ilustrativos para pruebas; el gerente debe ajustarlos
-- o eliminarlos (desactivar con activo = 0) antes de operar.
-- =====================================================================
USE biolab;

INSERT INTO ESTUDIO (clave, nombre, precio, es_externo) VALUES
 ('GLU', 'Glucosa en ayuno',                 80.00, 0),
 ('BH',  'Biometría hemática',              150.00, 0),
 ('EXT01','Estudio especial (lab. de referencia)', 500.00, 1);

INSERT INTO PARAMETRO_ESTUDIO (id_estudio, nombre, unidad)
SELECT id_estudio, 'Glucosa', 'mg/dL' FROM ESTUDIO WHERE clave = 'GLU';

-- Los parámetros de la biometría hemática y de los demás estudios los agrega 06_catalogo_ampliado.sql
