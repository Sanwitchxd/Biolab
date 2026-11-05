-- =====================================================================
-- BioLab - 06_catalogo_ampliado.sql  (OPCIONAL, datos de EJEMPLO)
-- Catálogo amplio de estudios clínicos con sus parámetros, unidades y valores de
-- referencia GENERALES para adultos. Ajuste precios y rangos al método y equipo de su
-- laboratorio antes de operar (los rangos varían según edad, sexo y reactivo).
-- Es IDEMPOTENTE: solo agrega lo que falta y no pisa precios ni rangos ya editados.
-- Requiere haber ejecutado schema/05_mejoras.sql. Lo carga "npm run cargar-catalogo".
-- =====================================================================
USE biolab;

INSERT IGNORE INTO ESTUDIO (clave, nombre, precio, es_externo) VALUES
 ('GLU', 'Glucosa en ayuno', 80.00, 0),
 ('BH', 'Biometría hemática completa', 150.00, 0),
 ('QS6', 'Química sanguínea de 6 elementos', 260.00, 0),
 ('PLIP', 'Perfil de lípidos', 280.00, 0),
 ('COL', 'Colesterol total', 90.00, 0),
 ('TRIG', 'Triglicéridos', 90.00, 0),
 ('CREA', 'Creatinina sérica', 90.00, 0),
 ('ACUR', 'Ácido úrico', 90.00, 0),
 ('PREN', 'Perfil renal', 320.00, 0),
 ('PHEP', 'Perfil hepático', 420.00, 0),
 ('ELEC', 'Electrolitos séricos', 300.00, 0),
 ('PTIR', 'Perfil tiroideo', 480.00, 0),
 ('HBA1C', 'Hemoglobina glucosilada (HbA1c)', 260.00, 0),
 ('CTG', 'Curva de tolerancia a la glucosa (3 tomas)', 320.00, 0),
 ('COAG', 'Tiempos de coagulación (TP, TTP, INR)', 280.00, 0),
 ('VSG', 'Velocidad de sedimentación globular', 110.00, 0),
 ('PCR', 'Proteína C reactiva', 190.00, 0),
 ('PHIE', 'Perfil de hierro', 420.00, 0),
 ('VITD', 'Vitamina D (25-OH)', 520.00, 0),
 ('B12', 'Vitamina B12', 380.00, 0),
 ('PSA', 'Antígeno prostático específico (PSA)', 380.00, 0),
 ('EGO', 'Examen general de orina', 120.00, 0),
 ('COPRO', 'Coproparasitoscópico (3 muestras)', 210.00, 0),
 ('GSRH', 'Grupo sanguíneo y factor Rh', 120.00, 0),
 ('PEMB', 'Prueba de embarazo (hCG cualitativa)', 130.00, 0),
 ('VDRL', 'VDRL (sífilis)', 150.00, 0),
 ('HBSAG', 'Antígeno de superficie de hepatitis B (HBsAg)', 230.00, 0),
 ('VIH', 'Prueba de VIH 1/2 (4ª generación)', 320.00, 0),
 ('UROC', 'Urocultivo', 380.00, 0),
 ('EXT01', 'Estudio especial (lab. de referencia)', 500.00, 1),
 ('EXT02', 'Panel de alergias (lab. de referencia)', 1200.00, 1),
 ('EXT03', 'Cultivo especializado (lab. de referencia)', 650.00, 1);

-- Parámetros que faltan (respeta el orden indicado)
INSERT INTO PARAMETRO_ESTUDIO (id_estudio, nombre, unidad, rango_referencia, opciones)
SELECT e.id_estudio, t.nombre, t.unidad, t.rango, t.opciones
  FROM (
  SELECT 1 AS orden, 'GLU' AS clave, 'Glucosa' AS nombre, 'mg/dL' AS unidad, '70 - 100' AS rango, NULL AS opciones
  UNION ALL SELECT 2 AS orden, 'BH' AS clave, 'Hemoglobina' AS nombre, 'g/dL' AS unidad, '12.0 - 17.5' AS rango, NULL AS opciones
  UNION ALL SELECT 3 AS orden, 'BH' AS clave, 'Hematocrito' AS nombre, '%' AS unidad, '36 - 52' AS rango, NULL AS opciones
  UNION ALL SELECT 4 AS orden, 'BH' AS clave, 'Eritrocitos' AS nombre, '10^6/µL' AS unidad, '4.0 - 6.0' AS rango, NULL AS opciones
  UNION ALL SELECT 5 AS orden, 'BH' AS clave, 'VCM' AS nombre, 'fL' AS unidad, '80 - 100' AS rango, NULL AS opciones
  UNION ALL SELECT 6 AS orden, 'BH' AS clave, 'HCM' AS nombre, 'pg' AS unidad, '27 - 33' AS rango, NULL AS opciones
  UNION ALL SELECT 7 AS orden, 'BH' AS clave, 'CMHC' AS nombre, 'g/dL' AS unidad, '32 - 36' AS rango, NULL AS opciones
  UNION ALL SELECT 8 AS orden, 'BH' AS clave, 'Leucocitos' AS nombre, '10^3/µL' AS unidad, '4.5 - 11.0' AS rango, NULL AS opciones
  UNION ALL SELECT 9 AS orden, 'BH' AS clave, 'Neutrófilos' AS nombre, '%' AS unidad, '40 - 70' AS rango, NULL AS opciones
  UNION ALL SELECT 10 AS orden, 'BH' AS clave, 'Linfocitos' AS nombre, '%' AS unidad, '20 - 45' AS rango, NULL AS opciones
  UNION ALL SELECT 11 AS orden, 'BH' AS clave, 'Monocitos' AS nombre, '%' AS unidad, '2 - 10' AS rango, NULL AS opciones
  UNION ALL SELECT 12 AS orden, 'BH' AS clave, 'Eosinófilos' AS nombre, '%' AS unidad, '0 - 6' AS rango, NULL AS opciones
  UNION ALL SELECT 13 AS orden, 'BH' AS clave, 'Basófilos' AS nombre, '%' AS unidad, '0 - 2' AS rango, NULL AS opciones
  UNION ALL SELECT 14 AS orden, 'BH' AS clave, 'Plaquetas' AS nombre, '10^3/µL' AS unidad, '150 - 450' AS rango, NULL AS opciones
  UNION ALL SELECT 15 AS orden, 'QS6' AS clave, 'Glucosa' AS nombre, 'mg/dL' AS unidad, '70 - 100' AS rango, NULL AS opciones
  UNION ALL SELECT 16 AS orden, 'QS6' AS clave, 'Urea' AS nombre, 'mg/dL' AS unidad, '15 - 45' AS rango, NULL AS opciones
  UNION ALL SELECT 17 AS orden, 'QS6' AS clave, 'Nitrógeno ureico (BUN)' AS nombre, 'mg/dL' AS unidad, '7 - 20' AS rango, NULL AS opciones
  UNION ALL SELECT 18 AS orden, 'QS6' AS clave, 'Creatinina' AS nombre, 'mg/dL' AS unidad, '0.6 - 1.3' AS rango, NULL AS opciones
  UNION ALL SELECT 19 AS orden, 'QS6' AS clave, 'Ácido úrico' AS nombre, 'mg/dL' AS unidad, '3.5 - 7.2' AS rango, NULL AS opciones
  UNION ALL SELECT 20 AS orden, 'QS6' AS clave, 'Colesterol total' AS nombre, 'mg/dL' AS unidad, '< 200' AS rango, NULL AS opciones
  UNION ALL SELECT 21 AS orden, 'PLIP' AS clave, 'Colesterol total' AS nombre, 'mg/dL' AS unidad, '< 200' AS rango, NULL AS opciones
  UNION ALL SELECT 22 AS orden, 'PLIP' AS clave, 'Colesterol HDL' AS nombre, 'mg/dL' AS unidad, '> 40' AS rango, NULL AS opciones
  UNION ALL SELECT 23 AS orden, 'PLIP' AS clave, 'Colesterol LDL' AS nombre, 'mg/dL' AS unidad, '< 100' AS rango, NULL AS opciones
  UNION ALL SELECT 24 AS orden, 'PLIP' AS clave, 'Colesterol VLDL' AS nombre, 'mg/dL' AS unidad, '5 - 40' AS rango, NULL AS opciones
  UNION ALL SELECT 25 AS orden, 'PLIP' AS clave, 'Triglicéridos' AS nombre, 'mg/dL' AS unidad, '< 150' AS rango, NULL AS opciones
  UNION ALL SELECT 26 AS orden, 'PLIP' AS clave, 'Índice aterogénico' AS nombre, NULL AS unidad, '< 4.5' AS rango, NULL AS opciones
  UNION ALL SELECT 27 AS orden, 'COL' AS clave, 'Colesterol total' AS nombre, 'mg/dL' AS unidad, '< 200' AS rango, NULL AS opciones
  UNION ALL SELECT 28 AS orden, 'TRIG' AS clave, 'Triglicéridos' AS nombre, 'mg/dL' AS unidad, '< 150' AS rango, NULL AS opciones
  UNION ALL SELECT 29 AS orden, 'CREA' AS clave, 'Creatinina' AS nombre, 'mg/dL' AS unidad, '0.6 - 1.3' AS rango, NULL AS opciones
  UNION ALL SELECT 30 AS orden, 'ACUR' AS clave, 'Ácido úrico' AS nombre, 'mg/dL' AS unidad, '3.5 - 7.2' AS rango, NULL AS opciones
  UNION ALL SELECT 31 AS orden, 'PREN' AS clave, 'Urea' AS nombre, 'mg/dL' AS unidad, '15 - 45' AS rango, NULL AS opciones
  UNION ALL SELECT 32 AS orden, 'PREN' AS clave, 'Nitrógeno ureico (BUN)' AS nombre, 'mg/dL' AS unidad, '7 - 20' AS rango, NULL AS opciones
  UNION ALL SELECT 33 AS orden, 'PREN' AS clave, 'Creatinina' AS nombre, 'mg/dL' AS unidad, '0.6 - 1.3' AS rango, NULL AS opciones
  UNION ALL SELECT 34 AS orden, 'PREN' AS clave, 'Ácido úrico' AS nombre, 'mg/dL' AS unidad, '3.5 - 7.2' AS rango, NULL AS opciones
  UNION ALL SELECT 35 AS orden, 'PREN' AS clave, 'Sodio' AS nombre, 'mEq/L' AS unidad, '135 - 145' AS rango, NULL AS opciones
  UNION ALL SELECT 36 AS orden, 'PREN' AS clave, 'Potasio' AS nombre, 'mEq/L' AS unidad, '3.5 - 5.0' AS rango, NULL AS opciones
  UNION ALL SELECT 37 AS orden, 'PREN' AS clave, 'Cloro' AS nombre, 'mEq/L' AS unidad, '98 - 107' AS rango, NULL AS opciones
  UNION ALL SELECT 38 AS orden, 'PHEP' AS clave, 'Bilirrubina total' AS nombre, 'mg/dL' AS unidad, '0.1 - 1.2' AS rango, NULL AS opciones
  UNION ALL SELECT 39 AS orden, 'PHEP' AS clave, 'Bilirrubina directa' AS nombre, 'mg/dL' AS unidad, '0.0 - 0.3' AS rango, NULL AS opciones
  UNION ALL SELECT 40 AS orden, 'PHEP' AS clave, 'Bilirrubina indirecta' AS nombre, 'mg/dL' AS unidad, '0.1 - 0.9' AS rango, NULL AS opciones
  UNION ALL SELECT 41 AS orden, 'PHEP' AS clave, 'TGO (AST)' AS nombre, 'U/L' AS unidad, '10 - 40' AS rango, NULL AS opciones
  UNION ALL SELECT 42 AS orden, 'PHEP' AS clave, 'TGP (ALT)' AS nombre, 'U/L' AS unidad, '7 - 56' AS rango, NULL AS opciones
  UNION ALL SELECT 43 AS orden, 'PHEP' AS clave, 'Fosfatasa alcalina' AS nombre, 'U/L' AS unidad, '44 - 147' AS rango, NULL AS opciones
  UNION ALL SELECT 44 AS orden, 'PHEP' AS clave, 'GGT' AS nombre, 'U/L' AS unidad, '9 - 48' AS rango, NULL AS opciones
  UNION ALL SELECT 45 AS orden, 'PHEP' AS clave, 'Proteínas totales' AS nombre, 'g/dL' AS unidad, '6.0 - 8.3' AS rango, NULL AS opciones
  UNION ALL SELECT 46 AS orden, 'PHEP' AS clave, 'Albúmina' AS nombre, 'g/dL' AS unidad, '3.5 - 5.0' AS rango, NULL AS opciones
  UNION ALL SELECT 47 AS orden, 'PHEP' AS clave, 'Globulinas' AS nombre, 'g/dL' AS unidad, '2.0 - 3.5' AS rango, NULL AS opciones
  UNION ALL SELECT 48 AS orden, 'ELEC' AS clave, 'Sodio' AS nombre, 'mEq/L' AS unidad, '135 - 145' AS rango, NULL AS opciones
  UNION ALL SELECT 49 AS orden, 'ELEC' AS clave, 'Potasio' AS nombre, 'mEq/L' AS unidad, '3.5 - 5.0' AS rango, NULL AS opciones
  UNION ALL SELECT 50 AS orden, 'ELEC' AS clave, 'Cloro' AS nombre, 'mEq/L' AS unidad, '98 - 107' AS rango, NULL AS opciones
  UNION ALL SELECT 51 AS orden, 'ELEC' AS clave, 'Calcio' AS nombre, 'mg/dL' AS unidad, '8.6 - 10.2' AS rango, NULL AS opciones
  UNION ALL SELECT 52 AS orden, 'ELEC' AS clave, 'Fósforo' AS nombre, 'mg/dL' AS unidad, '2.5 - 4.5' AS rango, NULL AS opciones
  UNION ALL SELECT 53 AS orden, 'ELEC' AS clave, 'Magnesio' AS nombre, 'mg/dL' AS unidad, '1.7 - 2.2' AS rango, NULL AS opciones
  UNION ALL SELECT 54 AS orden, 'PTIR' AS clave, 'TSH' AS nombre, 'µUI/mL' AS unidad, '0.4 - 4.0' AS rango, NULL AS opciones
  UNION ALL SELECT 55 AS orden, 'PTIR' AS clave, 'T4 libre' AS nombre, 'ng/dL' AS unidad, '0.8 - 1.8' AS rango, NULL AS opciones
  UNION ALL SELECT 56 AS orden, 'PTIR' AS clave, 'T3 total' AS nombre, 'ng/dL' AS unidad, '80 - 200' AS rango, NULL AS opciones
  UNION ALL SELECT 57 AS orden, 'PTIR' AS clave, 'T4 total' AS nombre, 'µg/dL' AS unidad, '5.0 - 12.0' AS rango, NULL AS opciones
  UNION ALL SELECT 58 AS orden, 'HBA1C' AS clave, 'HbA1c' AS nombre, '%' AS unidad, '4.0 - 5.6' AS rango, NULL AS opciones
  UNION ALL SELECT 59 AS orden, 'HBA1C' AS clave, 'Glucosa promedio estimada' AS nombre, 'mg/dL' AS unidad, '68 - 114' AS rango, NULL AS opciones
  UNION ALL SELECT 60 AS orden, 'CTG' AS clave, 'Glucosa basal' AS nombre, 'mg/dL' AS unidad, '70 - 100' AS rango, NULL AS opciones
  UNION ALL SELECT 61 AS orden, 'CTG' AS clave, 'Glucosa a los 60 min' AS nombre, 'mg/dL' AS unidad, '< 180' AS rango, NULL AS opciones
  UNION ALL SELECT 62 AS orden, 'CTG' AS clave, 'Glucosa a los 120 min' AS nombre, 'mg/dL' AS unidad, '< 140' AS rango, NULL AS opciones
  UNION ALL SELECT 63 AS orden, 'COAG' AS clave, 'Tiempo de protrombina (TP)' AS nombre, 'seg' AS unidad, '11.0 - 13.5' AS rango, NULL AS opciones
  UNION ALL SELECT 64 AS orden, 'COAG' AS clave, 'INR' AS nombre, NULL AS unidad, '0.8 - 1.2' AS rango, NULL AS opciones
  UNION ALL SELECT 65 AS orden, 'COAG' AS clave, 'Tiempo de tromboplastina (TTP)' AS nombre, 'seg' AS unidad, '25 - 35' AS rango, NULL AS opciones
  UNION ALL SELECT 66 AS orden, 'COAG' AS clave, 'Fibrinógeno' AS nombre, 'mg/dL' AS unidad, '200 - 400' AS rango, NULL AS opciones
  UNION ALL SELECT 67 AS orden, 'VSG' AS clave, 'VSG' AS nombre, 'mm/h' AS unidad, '0 - 20' AS rango, NULL AS opciones
  UNION ALL SELECT 68 AS orden, 'PCR' AS clave, 'Proteína C reactiva' AS nombre, 'mg/L' AS unidad, '< 5' AS rango, NULL AS opciones
  UNION ALL SELECT 69 AS orden, 'PHIE' AS clave, 'Hierro sérico' AS nombre, 'µg/dL' AS unidad, '60 - 170' AS rango, NULL AS opciones
  UNION ALL SELECT 70 AS orden, 'PHIE' AS clave, 'Capacidad total de fijación (TIBC)' AS nombre, 'µg/dL' AS unidad, '250 - 450' AS rango, NULL AS opciones
  UNION ALL SELECT 71 AS orden, 'PHIE' AS clave, 'Saturación de transferrina' AS nombre, '%' AS unidad, '20 - 50' AS rango, NULL AS opciones
  UNION ALL SELECT 72 AS orden, 'PHIE' AS clave, 'Ferritina' AS nombre, 'ng/mL' AS unidad, '20 - 250' AS rango, NULL AS opciones
  UNION ALL SELECT 73 AS orden, 'VITD' AS clave, 'Vitamina D 25-OH' AS nombre, 'ng/mL' AS unidad, '30 - 100' AS rango, NULL AS opciones
  UNION ALL SELECT 74 AS orden, 'B12' AS clave, 'Vitamina B12' AS nombre, 'pg/mL' AS unidad, '200 - 900' AS rango, NULL AS opciones
  UNION ALL SELECT 75 AS orden, 'PSA' AS clave, 'PSA total' AS nombre, 'ng/mL' AS unidad, '< 4.0' AS rango, NULL AS opciones
  UNION ALL SELECT 76 AS orden, 'EGO' AS clave, 'Color' AS nombre, NULL AS unidad, 'Amarillo claro,Amarillo' AS rango, 'Amarillo claro,Amarillo,Amarillo oscuro,Ámbar,Rojizo' AS opciones
  UNION ALL SELECT 77 AS orden, 'EGO' AS clave, 'Aspecto' AS nombre, NULL AS unidad, 'Claro' AS rango, 'Claro,Ligeramente turbio,Turbio' AS opciones
  UNION ALL SELECT 78 AS orden, 'EGO' AS clave, 'Densidad' AS nombre, NULL AS unidad, '1.005 - 1.030' AS rango, NULL AS opciones
  UNION ALL SELECT 79 AS orden, 'EGO' AS clave, 'pH' AS nombre, NULL AS unidad, '5.0 - 8.0' AS rango, NULL AS opciones
  UNION ALL SELECT 80 AS orden, 'EGO' AS clave, 'Proteínas' AS nombre, NULL AS unidad, 'Negativo' AS rango, 'Negativo,Trazas,+,++,+++' AS opciones
  UNION ALL SELECT 81 AS orden, 'EGO' AS clave, 'Glucosa en orina' AS nombre, NULL AS unidad, 'Negativo' AS rango, 'Negativo,Trazas,+,++,+++' AS opciones
  UNION ALL SELECT 82 AS orden, 'EGO' AS clave, 'Cetonas' AS nombre, NULL AS unidad, 'Negativo' AS rango, 'Negativo,Trazas,+,++,+++' AS opciones
  UNION ALL SELECT 83 AS orden, 'EGO' AS clave, 'Bilirrubina en orina' AS nombre, NULL AS unidad, 'Negativo' AS rango, 'Negativo,Positivo' AS opciones
  UNION ALL SELECT 84 AS orden, 'EGO' AS clave, 'Urobilinógeno' AS nombre, NULL AS unidad, 'Normal' AS rango, 'Normal,Aumentado' AS opciones
  UNION ALL SELECT 85 AS orden, 'EGO' AS clave, 'Nitritos' AS nombre, NULL AS unidad, 'Negativo' AS rango, 'Negativo,Positivo' AS opciones
  UNION ALL SELECT 86 AS orden, 'EGO' AS clave, 'Sangre (hemoglobina)' AS nombre, NULL AS unidad, 'Negativo' AS rango, 'Negativo,Trazas,+,++,+++' AS opciones
  UNION ALL SELECT 87 AS orden, 'EGO' AS clave, 'Esterasa leucocitaria' AS nombre, NULL AS unidad, 'Negativo' AS rango, 'Negativo,Trazas,+,++,+++' AS opciones
  UNION ALL SELECT 88 AS orden, 'EGO' AS clave, 'Leucocitos por campo' AS nombre, '/campo' AS unidad, '0 - 5' AS rango, NULL AS opciones
  UNION ALL SELECT 89 AS orden, 'EGO' AS clave, 'Eritrocitos por campo' AS nombre, '/campo' AS unidad, '0 - 2' AS rango, NULL AS opciones
  UNION ALL SELECT 90 AS orden, 'EGO' AS clave, 'Células epiteliales' AS nombre, NULL AS unidad, 'Escasos' AS rango, 'Ausentes,Escasos,Moderados,Abundantes' AS opciones
  UNION ALL SELECT 91 AS orden, 'EGO' AS clave, 'Bacterias' AS nombre, NULL AS unidad, 'Ausentes,Escasos' AS rango, 'Ausentes,Escasos,Moderados,Abundantes' AS opciones
  UNION ALL SELECT 92 AS orden, 'EGO' AS clave, 'Cristales' AS nombre, NULL AS unidad, 'Ausentes' AS rango, 'Ausentes,Oxalato de calcio,Ácido úrico,Fosfatos amorfos,Uratos amorfos' AS opciones
  UNION ALL SELECT 93 AS orden, 'EGO' AS clave, 'Cilindros' AS nombre, NULL AS unidad, 'Ausentes' AS rango, 'Ausentes,Hialinos,Granulosos,Eritrocitarios,Leucocitarios' AS opciones
  UNION ALL SELECT 94 AS orden, 'EGO' AS clave, 'Moco' AS nombre, NULL AS unidad, 'Ausente,Escaso' AS rango, 'Ausente,Escaso,Moderado,Abundante' AS opciones
  UNION ALL SELECT 95 AS orden, 'COPRO' AS clave, 'Color' AS nombre, NULL AS unidad, 'Café' AS rango, 'Café,Amarillo,Verdoso,Rojizo,Negro' AS opciones
  UNION ALL SELECT 96 AS orden, 'COPRO' AS clave, 'Consistencia' AS nombre, NULL AS unidad, 'Formada,Semiformada' AS rango, 'Formada,Semiformada,Pastosa,Blanda,Líquida' AS opciones
  UNION ALL SELECT 97 AS orden, 'COPRO' AS clave, 'Moco' AS nombre, NULL AS unidad, 'Ausente' AS rango, 'Ausente,Escaso,Moderado,Abundante' AS opciones
  UNION ALL SELECT 98 AS orden, 'COPRO' AS clave, 'Sangre oculta' AS nombre, NULL AS unidad, 'Negativo' AS rango, 'Negativo,Positivo' AS opciones
  UNION ALL SELECT 99 AS orden, 'COPRO' AS clave, 'Leucocitos' AS nombre, NULL AS unidad, 'Ausentes' AS rango, 'Ausentes,Escasos,Moderados,Abundantes' AS opciones
  UNION ALL SELECT 100 AS orden, 'COPRO' AS clave, 'Levaduras' AS nombre, NULL AS unidad, 'Ausentes' AS rango, 'Ausentes,Escasos,Moderados,Abundantes' AS opciones
  UNION ALL SELECT 101 AS orden, 'COPRO' AS clave, 'Parásitos observados' AS nombre, NULL AS unidad, 'Ninguno' AS rango, NULL AS opciones
  UNION ALL SELECT 102 AS orden, 'GSRH' AS clave, 'Grupo sanguíneo' AS nombre, NULL AS unidad, NULL AS rango, 'A,B,AB,O' AS opciones
  UNION ALL SELECT 103 AS orden, 'GSRH' AS clave, 'Factor Rh' AS nombre, NULL AS unidad, NULL AS rango, 'Positivo,Negativo' AS opciones
  UNION ALL SELECT 104 AS orden, 'PEMB' AS clave, 'hCG cualitativa' AS nombre, NULL AS unidad, 'Negativo' AS rango, 'Negativo,Positivo' AS opciones
  UNION ALL SELECT 105 AS orden, 'VDRL' AS clave, 'VDRL' AS nombre, NULL AS unidad, 'No reactivo' AS rango, 'No reactivo,Reactivo' AS opciones
  UNION ALL SELECT 106 AS orden, 'HBSAG' AS clave, 'HBsAg' AS nombre, NULL AS unidad, 'No reactivo' AS rango, 'No reactivo,Reactivo' AS opciones
  UNION ALL SELECT 107 AS orden, 'VIH' AS clave, 'VIH 1/2' AS nombre, NULL AS unidad, 'No reactivo' AS rango, 'No reactivo,Reactivo' AS opciones
  UNION ALL SELECT 108 AS orden, 'UROC' AS clave, 'Desarrollo bacteriano' AS nombre, NULL AS unidad, 'Sin desarrollo' AS rango, 'Sin desarrollo,Con desarrollo' AS opciones
  UNION ALL SELECT 109 AS orden, 'UROC' AS clave, 'Recuento de colonias' AS nombre, 'UFC/mL' AS unidad, '< 10000' AS rango, NULL AS opciones
  UNION ALL SELECT 110 AS orden, 'UROC' AS clave, 'Microorganismo aislado' AS nombre, NULL AS unidad, 'Ninguno' AS rango, NULL AS opciones
  UNION ALL SELECT 111 AS orden, 'UROC' AS clave, 'Antibiograma' AS nombre, NULL AS unidad, 'No aplica' AS rango, NULL AS opciones
  ) t JOIN ESTUDIO e ON e.clave = t.clave
 WHERE NOT EXISTS (SELECT 1 FROM PARAMETRO_ESTUDIO p WHERE p.id_estudio = e.id_estudio AND p.nombre = t.nombre)
 ORDER BY t.orden;

-- Referencias y opciones de parámetros que ya existían sin ellas
UPDATE PARAMETRO_ESTUDIO p
  JOIN ESTUDIO e ON e.id_estudio = p.id_estudio
  JOIN (
  SELECT 1 AS orden, 'GLU' AS clave, 'Glucosa' AS nombre, 'mg/dL' AS unidad, '70 - 100' AS rango, NULL AS opciones
  UNION ALL SELECT 2 AS orden, 'BH' AS clave, 'Hemoglobina' AS nombre, 'g/dL' AS unidad, '12.0 - 17.5' AS rango, NULL AS opciones
  UNION ALL SELECT 3 AS orden, 'BH' AS clave, 'Hematocrito' AS nombre, '%' AS unidad, '36 - 52' AS rango, NULL AS opciones
  UNION ALL SELECT 4 AS orden, 'BH' AS clave, 'Eritrocitos' AS nombre, '10^6/µL' AS unidad, '4.0 - 6.0' AS rango, NULL AS opciones
  UNION ALL SELECT 5 AS orden, 'BH' AS clave, 'VCM' AS nombre, 'fL' AS unidad, '80 - 100' AS rango, NULL AS opciones
  UNION ALL SELECT 6 AS orden, 'BH' AS clave, 'HCM' AS nombre, 'pg' AS unidad, '27 - 33' AS rango, NULL AS opciones
  UNION ALL SELECT 7 AS orden, 'BH' AS clave, 'CMHC' AS nombre, 'g/dL' AS unidad, '32 - 36' AS rango, NULL AS opciones
  UNION ALL SELECT 8 AS orden, 'BH' AS clave, 'Leucocitos' AS nombre, '10^3/µL' AS unidad, '4.5 - 11.0' AS rango, NULL AS opciones
  UNION ALL SELECT 9 AS orden, 'BH' AS clave, 'Neutrófilos' AS nombre, '%' AS unidad, '40 - 70' AS rango, NULL AS opciones
  UNION ALL SELECT 10 AS orden, 'BH' AS clave, 'Linfocitos' AS nombre, '%' AS unidad, '20 - 45' AS rango, NULL AS opciones
  UNION ALL SELECT 11 AS orden, 'BH' AS clave, 'Monocitos' AS nombre, '%' AS unidad, '2 - 10' AS rango, NULL AS opciones
  UNION ALL SELECT 12 AS orden, 'BH' AS clave, 'Eosinófilos' AS nombre, '%' AS unidad, '0 - 6' AS rango, NULL AS opciones
  UNION ALL SELECT 13 AS orden, 'BH' AS clave, 'Basófilos' AS nombre, '%' AS unidad, '0 - 2' AS rango, NULL AS opciones
  UNION ALL SELECT 14 AS orden, 'BH' AS clave, 'Plaquetas' AS nombre, '10^3/µL' AS unidad, '150 - 450' AS rango, NULL AS opciones
  UNION ALL SELECT 15 AS orden, 'QS6' AS clave, 'Glucosa' AS nombre, 'mg/dL' AS unidad, '70 - 100' AS rango, NULL AS opciones
  UNION ALL SELECT 16 AS orden, 'QS6' AS clave, 'Urea' AS nombre, 'mg/dL' AS unidad, '15 - 45' AS rango, NULL AS opciones
  UNION ALL SELECT 17 AS orden, 'QS6' AS clave, 'Nitrógeno ureico (BUN)' AS nombre, 'mg/dL' AS unidad, '7 - 20' AS rango, NULL AS opciones
  UNION ALL SELECT 18 AS orden, 'QS6' AS clave, 'Creatinina' AS nombre, 'mg/dL' AS unidad, '0.6 - 1.3' AS rango, NULL AS opciones
  UNION ALL SELECT 19 AS orden, 'QS6' AS clave, 'Ácido úrico' AS nombre, 'mg/dL' AS unidad, '3.5 - 7.2' AS rango, NULL AS opciones
  UNION ALL SELECT 20 AS orden, 'QS6' AS clave, 'Colesterol total' AS nombre, 'mg/dL' AS unidad, '< 200' AS rango, NULL AS opciones
  UNION ALL SELECT 21 AS orden, 'PLIP' AS clave, 'Colesterol total' AS nombre, 'mg/dL' AS unidad, '< 200' AS rango, NULL AS opciones
  UNION ALL SELECT 22 AS orden, 'PLIP' AS clave, 'Colesterol HDL' AS nombre, 'mg/dL' AS unidad, '> 40' AS rango, NULL AS opciones
  UNION ALL SELECT 23 AS orden, 'PLIP' AS clave, 'Colesterol LDL' AS nombre, 'mg/dL' AS unidad, '< 100' AS rango, NULL AS opciones
  UNION ALL SELECT 24 AS orden, 'PLIP' AS clave, 'Colesterol VLDL' AS nombre, 'mg/dL' AS unidad, '5 - 40' AS rango, NULL AS opciones
  UNION ALL SELECT 25 AS orden, 'PLIP' AS clave, 'Triglicéridos' AS nombre, 'mg/dL' AS unidad, '< 150' AS rango, NULL AS opciones
  UNION ALL SELECT 26 AS orden, 'PLIP' AS clave, 'Índice aterogénico' AS nombre, NULL AS unidad, '< 4.5' AS rango, NULL AS opciones
  UNION ALL SELECT 27 AS orden, 'COL' AS clave, 'Colesterol total' AS nombre, 'mg/dL' AS unidad, '< 200' AS rango, NULL AS opciones
  UNION ALL SELECT 28 AS orden, 'TRIG' AS clave, 'Triglicéridos' AS nombre, 'mg/dL' AS unidad, '< 150' AS rango, NULL AS opciones
  UNION ALL SELECT 29 AS orden, 'CREA' AS clave, 'Creatinina' AS nombre, 'mg/dL' AS unidad, '0.6 - 1.3' AS rango, NULL AS opciones
  UNION ALL SELECT 30 AS orden, 'ACUR' AS clave, 'Ácido úrico' AS nombre, 'mg/dL' AS unidad, '3.5 - 7.2' AS rango, NULL AS opciones
  UNION ALL SELECT 31 AS orden, 'PREN' AS clave, 'Urea' AS nombre, 'mg/dL' AS unidad, '15 - 45' AS rango, NULL AS opciones
  UNION ALL SELECT 32 AS orden, 'PREN' AS clave, 'Nitrógeno ureico (BUN)' AS nombre, 'mg/dL' AS unidad, '7 - 20' AS rango, NULL AS opciones
  UNION ALL SELECT 33 AS orden, 'PREN' AS clave, 'Creatinina' AS nombre, 'mg/dL' AS unidad, '0.6 - 1.3' AS rango, NULL AS opciones
  UNION ALL SELECT 34 AS orden, 'PREN' AS clave, 'Ácido úrico' AS nombre, 'mg/dL' AS unidad, '3.5 - 7.2' AS rango, NULL AS opciones
  UNION ALL SELECT 35 AS orden, 'PREN' AS clave, 'Sodio' AS nombre, 'mEq/L' AS unidad, '135 - 145' AS rango, NULL AS opciones
  UNION ALL SELECT 36 AS orden, 'PREN' AS clave, 'Potasio' AS nombre, 'mEq/L' AS unidad, '3.5 - 5.0' AS rango, NULL AS opciones
  UNION ALL SELECT 37 AS orden, 'PREN' AS clave, 'Cloro' AS nombre, 'mEq/L' AS unidad, '98 - 107' AS rango, NULL AS opciones
  UNION ALL SELECT 38 AS orden, 'PHEP' AS clave, 'Bilirrubina total' AS nombre, 'mg/dL' AS unidad, '0.1 - 1.2' AS rango, NULL AS opciones
  UNION ALL SELECT 39 AS orden, 'PHEP' AS clave, 'Bilirrubina directa' AS nombre, 'mg/dL' AS unidad, '0.0 - 0.3' AS rango, NULL AS opciones
  UNION ALL SELECT 40 AS orden, 'PHEP' AS clave, 'Bilirrubina indirecta' AS nombre, 'mg/dL' AS unidad, '0.1 - 0.9' AS rango, NULL AS opciones
  UNION ALL SELECT 41 AS orden, 'PHEP' AS clave, 'TGO (AST)' AS nombre, 'U/L' AS unidad, '10 - 40' AS rango, NULL AS opciones
  UNION ALL SELECT 42 AS orden, 'PHEP' AS clave, 'TGP (ALT)' AS nombre, 'U/L' AS unidad, '7 - 56' AS rango, NULL AS opciones
  UNION ALL SELECT 43 AS orden, 'PHEP' AS clave, 'Fosfatasa alcalina' AS nombre, 'U/L' AS unidad, '44 - 147' AS rango, NULL AS opciones
  UNION ALL SELECT 44 AS orden, 'PHEP' AS clave, 'GGT' AS nombre, 'U/L' AS unidad, '9 - 48' AS rango, NULL AS opciones
  UNION ALL SELECT 45 AS orden, 'PHEP' AS clave, 'Proteínas totales' AS nombre, 'g/dL' AS unidad, '6.0 - 8.3' AS rango, NULL AS opciones
  UNION ALL SELECT 46 AS orden, 'PHEP' AS clave, 'Albúmina' AS nombre, 'g/dL' AS unidad, '3.5 - 5.0' AS rango, NULL AS opciones
  UNION ALL SELECT 47 AS orden, 'PHEP' AS clave, 'Globulinas' AS nombre, 'g/dL' AS unidad, '2.0 - 3.5' AS rango, NULL AS opciones
  UNION ALL SELECT 48 AS orden, 'ELEC' AS clave, 'Sodio' AS nombre, 'mEq/L' AS unidad, '135 - 145' AS rango, NULL AS opciones
  UNION ALL SELECT 49 AS orden, 'ELEC' AS clave, 'Potasio' AS nombre, 'mEq/L' AS unidad, '3.5 - 5.0' AS rango, NULL AS opciones
  UNION ALL SELECT 50 AS orden, 'ELEC' AS clave, 'Cloro' AS nombre, 'mEq/L' AS unidad, '98 - 107' AS rango, NULL AS opciones
  UNION ALL SELECT 51 AS orden, 'ELEC' AS clave, 'Calcio' AS nombre, 'mg/dL' AS unidad, '8.6 - 10.2' AS rango, NULL AS opciones
  UNION ALL SELECT 52 AS orden, 'ELEC' AS clave, 'Fósforo' AS nombre, 'mg/dL' AS unidad, '2.5 - 4.5' AS rango, NULL AS opciones
  UNION ALL SELECT 53 AS orden, 'ELEC' AS clave, 'Magnesio' AS nombre, 'mg/dL' AS unidad, '1.7 - 2.2' AS rango, NULL AS opciones
  UNION ALL SELECT 54 AS orden, 'PTIR' AS clave, 'TSH' AS nombre, 'µUI/mL' AS unidad, '0.4 - 4.0' AS rango, NULL AS opciones
  UNION ALL SELECT 55 AS orden, 'PTIR' AS clave, 'T4 libre' AS nombre, 'ng/dL' AS unidad, '0.8 - 1.8' AS rango, NULL AS opciones
  UNION ALL SELECT 56 AS orden, 'PTIR' AS clave, 'T3 total' AS nombre, 'ng/dL' AS unidad, '80 - 200' AS rango, NULL AS opciones
  UNION ALL SELECT 57 AS orden, 'PTIR' AS clave, 'T4 total' AS nombre, 'µg/dL' AS unidad, '5.0 - 12.0' AS rango, NULL AS opciones
  UNION ALL SELECT 58 AS orden, 'HBA1C' AS clave, 'HbA1c' AS nombre, '%' AS unidad, '4.0 - 5.6' AS rango, NULL AS opciones
  UNION ALL SELECT 59 AS orden, 'HBA1C' AS clave, 'Glucosa promedio estimada' AS nombre, 'mg/dL' AS unidad, '68 - 114' AS rango, NULL AS opciones
  UNION ALL SELECT 60 AS orden, 'CTG' AS clave, 'Glucosa basal' AS nombre, 'mg/dL' AS unidad, '70 - 100' AS rango, NULL AS opciones
  UNION ALL SELECT 61 AS orden, 'CTG' AS clave, 'Glucosa a los 60 min' AS nombre, 'mg/dL' AS unidad, '< 180' AS rango, NULL AS opciones
  UNION ALL SELECT 62 AS orden, 'CTG' AS clave, 'Glucosa a los 120 min' AS nombre, 'mg/dL' AS unidad, '< 140' AS rango, NULL AS opciones
  UNION ALL SELECT 63 AS orden, 'COAG' AS clave, 'Tiempo de protrombina (TP)' AS nombre, 'seg' AS unidad, '11.0 - 13.5' AS rango, NULL AS opciones
  UNION ALL SELECT 64 AS orden, 'COAG' AS clave, 'INR' AS nombre, NULL AS unidad, '0.8 - 1.2' AS rango, NULL AS opciones
  UNION ALL SELECT 65 AS orden, 'COAG' AS clave, 'Tiempo de tromboplastina (TTP)' AS nombre, 'seg' AS unidad, '25 - 35' AS rango, NULL AS opciones
  UNION ALL SELECT 66 AS orden, 'COAG' AS clave, 'Fibrinógeno' AS nombre, 'mg/dL' AS unidad, '200 - 400' AS rango, NULL AS opciones
  UNION ALL SELECT 67 AS orden, 'VSG' AS clave, 'VSG' AS nombre, 'mm/h' AS unidad, '0 - 20' AS rango, NULL AS opciones
  UNION ALL SELECT 68 AS orden, 'PCR' AS clave, 'Proteína C reactiva' AS nombre, 'mg/L' AS unidad, '< 5' AS rango, NULL AS opciones
  UNION ALL SELECT 69 AS orden, 'PHIE' AS clave, 'Hierro sérico' AS nombre, 'µg/dL' AS unidad, '60 - 170' AS rango, NULL AS opciones
  UNION ALL SELECT 70 AS orden, 'PHIE' AS clave, 'Capacidad total de fijación (TIBC)' AS nombre, 'µg/dL' AS unidad, '250 - 450' AS rango, NULL AS opciones
  UNION ALL SELECT 71 AS orden, 'PHIE' AS clave, 'Saturación de transferrina' AS nombre, '%' AS unidad, '20 - 50' AS rango, NULL AS opciones
  UNION ALL SELECT 72 AS orden, 'PHIE' AS clave, 'Ferritina' AS nombre, 'ng/mL' AS unidad, '20 - 250' AS rango, NULL AS opciones
  UNION ALL SELECT 73 AS orden, 'VITD' AS clave, 'Vitamina D 25-OH' AS nombre, 'ng/mL' AS unidad, '30 - 100' AS rango, NULL AS opciones
  UNION ALL SELECT 74 AS orden, 'B12' AS clave, 'Vitamina B12' AS nombre, 'pg/mL' AS unidad, '200 - 900' AS rango, NULL AS opciones
  UNION ALL SELECT 75 AS orden, 'PSA' AS clave, 'PSA total' AS nombre, 'ng/mL' AS unidad, '< 4.0' AS rango, NULL AS opciones
  UNION ALL SELECT 76 AS orden, 'EGO' AS clave, 'Color' AS nombre, NULL AS unidad, 'Amarillo claro,Amarillo' AS rango, 'Amarillo claro,Amarillo,Amarillo oscuro,Ámbar,Rojizo' AS opciones
  UNION ALL SELECT 77 AS orden, 'EGO' AS clave, 'Aspecto' AS nombre, NULL AS unidad, 'Claro' AS rango, 'Claro,Ligeramente turbio,Turbio' AS opciones
  UNION ALL SELECT 78 AS orden, 'EGO' AS clave, 'Densidad' AS nombre, NULL AS unidad, '1.005 - 1.030' AS rango, NULL AS opciones
  UNION ALL SELECT 79 AS orden, 'EGO' AS clave, 'pH' AS nombre, NULL AS unidad, '5.0 - 8.0' AS rango, NULL AS opciones
  UNION ALL SELECT 80 AS orden, 'EGO' AS clave, 'Proteínas' AS nombre, NULL AS unidad, 'Negativo' AS rango, 'Negativo,Trazas,+,++,+++' AS opciones
  UNION ALL SELECT 81 AS orden, 'EGO' AS clave, 'Glucosa en orina' AS nombre, NULL AS unidad, 'Negativo' AS rango, 'Negativo,Trazas,+,++,+++' AS opciones
  UNION ALL SELECT 82 AS orden, 'EGO' AS clave, 'Cetonas' AS nombre, NULL AS unidad, 'Negativo' AS rango, 'Negativo,Trazas,+,++,+++' AS opciones
  UNION ALL SELECT 83 AS orden, 'EGO' AS clave, 'Bilirrubina en orina' AS nombre, NULL AS unidad, 'Negativo' AS rango, 'Negativo,Positivo' AS opciones
  UNION ALL SELECT 84 AS orden, 'EGO' AS clave, 'Urobilinógeno' AS nombre, NULL AS unidad, 'Normal' AS rango, 'Normal,Aumentado' AS opciones
  UNION ALL SELECT 85 AS orden, 'EGO' AS clave, 'Nitritos' AS nombre, NULL AS unidad, 'Negativo' AS rango, 'Negativo,Positivo' AS opciones
  UNION ALL SELECT 86 AS orden, 'EGO' AS clave, 'Sangre (hemoglobina)' AS nombre, NULL AS unidad, 'Negativo' AS rango, 'Negativo,Trazas,+,++,+++' AS opciones
  UNION ALL SELECT 87 AS orden, 'EGO' AS clave, 'Esterasa leucocitaria' AS nombre, NULL AS unidad, 'Negativo' AS rango, 'Negativo,Trazas,+,++,+++' AS opciones
  UNION ALL SELECT 88 AS orden, 'EGO' AS clave, 'Leucocitos por campo' AS nombre, '/campo' AS unidad, '0 - 5' AS rango, NULL AS opciones
  UNION ALL SELECT 89 AS orden, 'EGO' AS clave, 'Eritrocitos por campo' AS nombre, '/campo' AS unidad, '0 - 2' AS rango, NULL AS opciones
  UNION ALL SELECT 90 AS orden, 'EGO' AS clave, 'Células epiteliales' AS nombre, NULL AS unidad, 'Escasos' AS rango, 'Ausentes,Escasos,Moderados,Abundantes' AS opciones
  UNION ALL SELECT 91 AS orden, 'EGO' AS clave, 'Bacterias' AS nombre, NULL AS unidad, 'Ausentes,Escasos' AS rango, 'Ausentes,Escasos,Moderados,Abundantes' AS opciones
  UNION ALL SELECT 92 AS orden, 'EGO' AS clave, 'Cristales' AS nombre, NULL AS unidad, 'Ausentes' AS rango, 'Ausentes,Oxalato de calcio,Ácido úrico,Fosfatos amorfos,Uratos amorfos' AS opciones
  UNION ALL SELECT 93 AS orden, 'EGO' AS clave, 'Cilindros' AS nombre, NULL AS unidad, 'Ausentes' AS rango, 'Ausentes,Hialinos,Granulosos,Eritrocitarios,Leucocitarios' AS opciones
  UNION ALL SELECT 94 AS orden, 'EGO' AS clave, 'Moco' AS nombre, NULL AS unidad, 'Ausente,Escaso' AS rango, 'Ausente,Escaso,Moderado,Abundante' AS opciones
  UNION ALL SELECT 95 AS orden, 'COPRO' AS clave, 'Color' AS nombre, NULL AS unidad, 'Café' AS rango, 'Café,Amarillo,Verdoso,Rojizo,Negro' AS opciones
  UNION ALL SELECT 96 AS orden, 'COPRO' AS clave, 'Consistencia' AS nombre, NULL AS unidad, 'Formada,Semiformada' AS rango, 'Formada,Semiformada,Pastosa,Blanda,Líquida' AS opciones
  UNION ALL SELECT 97 AS orden, 'COPRO' AS clave, 'Moco' AS nombre, NULL AS unidad, 'Ausente' AS rango, 'Ausente,Escaso,Moderado,Abundante' AS opciones
  UNION ALL SELECT 98 AS orden, 'COPRO' AS clave, 'Sangre oculta' AS nombre, NULL AS unidad, 'Negativo' AS rango, 'Negativo,Positivo' AS opciones
  UNION ALL SELECT 99 AS orden, 'COPRO' AS clave, 'Leucocitos' AS nombre, NULL AS unidad, 'Ausentes' AS rango, 'Ausentes,Escasos,Moderados,Abundantes' AS opciones
  UNION ALL SELECT 100 AS orden, 'COPRO' AS clave, 'Levaduras' AS nombre, NULL AS unidad, 'Ausentes' AS rango, 'Ausentes,Escasos,Moderados,Abundantes' AS opciones
  UNION ALL SELECT 101 AS orden, 'COPRO' AS clave, 'Parásitos observados' AS nombre, NULL AS unidad, 'Ninguno' AS rango, NULL AS opciones
  UNION ALL SELECT 102 AS orden, 'GSRH' AS clave, 'Grupo sanguíneo' AS nombre, NULL AS unidad, NULL AS rango, 'A,B,AB,O' AS opciones
  UNION ALL SELECT 103 AS orden, 'GSRH' AS clave, 'Factor Rh' AS nombre, NULL AS unidad, NULL AS rango, 'Positivo,Negativo' AS opciones
  UNION ALL SELECT 104 AS orden, 'PEMB' AS clave, 'hCG cualitativa' AS nombre, NULL AS unidad, 'Negativo' AS rango, 'Negativo,Positivo' AS opciones
  UNION ALL SELECT 105 AS orden, 'VDRL' AS clave, 'VDRL' AS nombre, NULL AS unidad, 'No reactivo' AS rango, 'No reactivo,Reactivo' AS opciones
  UNION ALL SELECT 106 AS orden, 'HBSAG' AS clave, 'HBsAg' AS nombre, NULL AS unidad, 'No reactivo' AS rango, 'No reactivo,Reactivo' AS opciones
  UNION ALL SELECT 107 AS orden, 'VIH' AS clave, 'VIH 1/2' AS nombre, NULL AS unidad, 'No reactivo' AS rango, 'No reactivo,Reactivo' AS opciones
  UNION ALL SELECT 108 AS orden, 'UROC' AS clave, 'Desarrollo bacteriano' AS nombre, NULL AS unidad, 'Sin desarrollo' AS rango, 'Sin desarrollo,Con desarrollo' AS opciones
  UNION ALL SELECT 109 AS orden, 'UROC' AS clave, 'Recuento de colonias' AS nombre, 'UFC/mL' AS unidad, '< 10000' AS rango, NULL AS opciones
  UNION ALL SELECT 110 AS orden, 'UROC' AS clave, 'Microorganismo aislado' AS nombre, NULL AS unidad, 'Ninguno' AS rango, NULL AS opciones
  UNION ALL SELECT 111 AS orden, 'UROC' AS clave, 'Antibiograma' AS nombre, NULL AS unidad, 'No aplica' AS rango, NULL AS opciones
  ) t ON t.clave = e.clave AND t.nombre = p.nombre
   SET p.rango_referencia = COALESCE(p.rango_referencia, t.rango),
       p.opciones         = COALESCE(p.opciones, t.opciones);
