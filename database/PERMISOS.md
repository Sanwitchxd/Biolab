# BioLab – Roles y permisos

Base: **MySQL 8.x**, esquema `biolab`. Ningún rol tiene `DELETE`, `DROP`, `ALTER` ni `GRANT`.
Los registros no se borran: se cancelan (RN-02) o se bloquean (usuarios).

## Matriz de permisos

| Objeto | Gerente | Recepcionista | Químico |
|---|---|---|---|
| **BITACORA / vw_bitacora** | **SELECT (exclusivo)** | — | — |
| USUARIO | SELECT (sin hash), INSERT, UPDATE | — | — |
| ESTUDIO | SELECT, INSERT, UPDATE | SELECT | SELECT (sin `precio`) |
| PARAMETRO_ESTUDIO | SELECT, INSERT, UPDATE | SELECT | SELECT |
| PACIENTE | SELECT | SELECT, INSERT, UPDATE (nombre, teléfono, WhatsApp) | SELECT (id, nombre) |
| ORDEN | SELECT | SELECT, UPDATE (cita, indicaciones, estado, cancelación, entrega); alta con `sp_crear_orden` | SELECT (sin datos de contacto/entrega) |
| DETALLE_ORDEN | SELECT | SELECT; alta con `sp_agregar_estudio_orden` | SELECT (sin `precio_aplicado`) |
| MUESTRA | SELECT | SELECT, INSERT | SELECT, UPDATE (estado, fecha_recepcion) |
| INCIDENCIA_MUESTRA | SELECT | — | SELECT, INSERT |
| RESULTADO | SELECT | vía `vw_informe_resultado` | SELECT, INSERT, UPDATE (validar/liberar/PDF) |
| VALOR_RESULTADO | SELECT | vía `vw_informe_resultado` | SELECT, INSERT, UPDATE (valor) |
| PAGO | SELECT | SELECT, INSERT | — |
| NOTIFICACION | SELECT | SELECT, UPDATE (estado) | — |
| vw_corte_caja | SELECT | — | — |
| vw_saldo_orden | SELECT | SELECT | — |
| vw_informe_resultado | SELECT | SELECT | — |

Procedimientos (`EXECUTE`): `sp_login_usuario` (los tres), `sp_registrar_bitacora` (Recepcionista, Químico),
`sp_crear_orden` y `sp_agregar_estudio_orden` (Recepcionista).

## ¿Cómo se protege la bitácora?

1. Solo `rol_gerente` tiene `SELECT` sobre `BITACORA` y `vw_bitacora`. Recepcionista y Químico reciben *access denied*.
2. Nadie tiene `UPDATE`/`DELETE`; además los triggers `trg_bitacora_bu` / `trg_bitacora_bd` rechazan cualquier modificación (RNF-02).
3. Recepcionista y Químico generan entradas **sin poder leerlas**: los triggers y `sp_registrar_bitacora` se ejecutan con
   los privilegios del propietario (`SQL SECURITY DEFINER`).
4. Se registran automáticamente: creación/cancelación/entrega/cambios de orden, estudios agregados, muestras, incidencias,
   captura/validación/liberación de resultados, pagos, altas y cambios de pacientes, usuarios y catálogo.

## Reglas de negocio aplicadas en la base

| Regla | Dónde se aplica |
|---|---|
| RN-01 Lo clínico no ve lo financiero | Químico sin acceso a `PAGO`, `precio`, `precio_aplicado`; informe = `vw_informe_resultado` |
| RN-02 Cancelación lógica con justificación | CHECK + `trg_orden_bu`; sin `DELETE`; orden cancelada no se modifica |
| RN-03 Validado = congelado | `trg_valor_*`, `trg_resultado_bu`, `trg_paciente_bu` |
| RN-04 Canal según WhatsApp | `trg_orden_au` y `ev_recordatorio_citas` |
| RN-05 Entrega solo sin adeudo | `trg_orden_bu` (saldo = 0) |
| RF-07 Folio `LMT-AAAAMMDD-001` | `sp_crear_orden` (con bloqueo para evitar folios repetidos) |
| RF-01 Recordatorio 17:00 h del día anterior | Evento `ev_recordatorio_citas` |

## Cambios respecto al documento U2-E2 (para su nota de actualización)

* El rol **Administrador** pasa a llamarse **Gerente** (`USUARIO.rol`: Gerente | Recepcionista | Químico).
* `NOTIFICACION.canal` pasa de VARCHAR(20) a **VARCHAR(25)**: "Pantalla de recepción" mide 21 caracteres y no cabía.
* Se agregan CHECK, triggers, vistas y procedimientos; no cambian tablas, columnas ni relaciones del modelo E-R.
* Interpretación de RN-03 para PACIENTE (**actualizada en 05_mejoras.sql**): los datos del paciente no se pueden editar
  una vez que su última orden no cancelada tiene resultados validados, **tampoco después de entregarla**.
  (La versión anterior solo bloqueaba antes de la entrega.)

## Agregado en 05_mejoras.sql (versión 2)

Se ejecuta una vez después de 01–04; los instaladores lo aplican solos a una base existente sin borrar datos.

| Qué | Dónde | Quién |
|---|---|---|
| Sueldo y pagos de nómina (inmutables) | `SUELDO_USUARIO`, `PAGO_NOMINA` | solo Gerente |
| Mensajería interna | `MENSAJE`; se lee con `vw_mis_mensajes` / `vw_contactos` y se escribe con `sp_enviar_mensaje`, `sp_marcar_leidos` | todos; cada usuario solo ve lo suyo (filtro por `fn_actor()`) |
| Cola de WhatsApp | `WHATSAPP_COLA`; la llenan `trg_orden_au_wa`, `ev_recordatorio_citas` y `sp_encolar_whatsapp` | Recepción la atiende; Gerente la consulta |
| Preferencias de aviso en la orden | `ORDEN.acepta_recordatorio`, `acepta_aviso_resultados`, `preparacion_mensaje`, `recordatorio_envio` | Recepción |
| Rangos de referencia y opciones | `PARAMETRO_ESTUDIO.rango_referencia`, `opciones`; `vw_informe_resultado.referencia` | catálogo: Gerente; lectura: todos los roles clínicos |

El aviso automático de «resultado listo» se encola cuando la **orden completa** pasa a Liberada, y solo si el paciente
tiene WhatsApp y aceptó el aviso. Los rangos del catálogo ampliado (`seeds/06_catalogo_ampliado.sql`) son **genéricos
para adultos**: ajústelos al método y reactivos de su laboratorio.

