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

INSERT INTO PARAMETRO_ESTUDIO (id_estudio, nombre, unidad)
SELECT e.id_estudio, p.n, p.u FROM ESTUDIO e
 JOIN (SELECT 'Hemoglobina' n, 'g/dL' u UNION ALL SELECT 'Hematocrito','%'
       UNION ALL SELECT 'Leucocitos','10^3/µL' UNION ALL SELECT 'Plaquetas','10^3/µL') p
 WHERE e.clave = 'BH';
