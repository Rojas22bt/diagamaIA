# Entrega técnica Sprint 1 · 21/10/2026

## Resultado y límites

Implementación disponible para revisión: panel integrado con mocks, resaltado temporal, eliminación de recomendaciones antiguas del editor, modelos Prisma y migración comprobada en PostgreSQL aislado. No se implementaron los motores del Sprint 2 ni los flujos de decisiones del Sprint 3. La base real del proyecto no fue modificada.

La aceptación funcional y del catálogo corresponde al responsable del proyecto. El cierre formal al 100 % requiere aceptación del responsable. La regresión se comprobó también con el backend real y tres clientes Socket.IO, además de los roles simulados del test visual.

## Evidencias

| Verificación | Resultado | Evidencia reproducible |
|---|---|---|
| TypeScript frontend | Correcto. | `tsc -b` en diagramadoria. |
| Build producción frontend | Correcto. Aviso de tamaño de bundle, también presente antes del cambio. | `vite build`; 12 108 módulos transformados, sin errores. |
| TypeScript backend | Correcto. | `tsc` en backendia. |
| ESLint del módulo nuevo | Sin errores ni desactivaciones de reglas. | `eslint src/features/validation`. No representa lint limpio de todo el código heredado. |
| Prisma validate/generate | Correctos. | Esquema y cliente Prisma 6.16.2. |
| Deploy de migraciones en base vacía aislada | Correcto. | Las cinco migraciones del repositorio aplicadas a sprint01_validation. |
| Upgrade desde esquema anterior con proyecto existente | Conserva título y JSON; crea solo tres tablas de módulo. | `evidence/migration-preservation.txt`; fixtures SQL de seed/comprobación. |
| Contratos y proveedor mock | 4 pruebas aprobadas. | `evidence/contracts.txt`, `diagramadoria/tests/validation-contracts.test.ts`. |
| ORM | Prueba integrada aprobada: CRUD, unicidad, FK, rollback, conservación del diagrama, anonimización y cascade por proyecto. | `evidence/orm.txt`, `backendia/tests/validation-audit.test.ts`. |
| UI real con HTTP de proyecto mock | Creador/editor/vista: 3 avisos, 6 estados, cero errores JS y cero escrituras HTTP del panel. | `evidence/ui-results.json`, `diagramadoria/tests/validation-ui.mjs`. |
| Regresión API/Socket.IO real | Guardado, lectura por tres roles, entrega de cambios a dos receptores, reconexión y HTTP 401/403 correctos. | `evidence/regression.txt`, `backendia/tests/project-regression.test.mjs`. |
| Generadores existentes | Descarga de ZIP Spring Boot (31 235 bytes) y Flutter (21 192 bytes). No se compilaron los proyectos generados. | `evidence/ui-results.json`. |
| Resaltado y conservación | Probados clase, relación, atributo en contenedor, referencia ausente, limpieza, Escape, exportación intacta, reemplazo de captura y cero llamadas de actualización de diagrama. | Prueba UI; capturas por rol. |

El test UI utiliza React, editor y JointJS reales y simula respuestas de la API. El servidor Socket.IO no se ejercitó; se instrumentó el método de envío para verificar que el panel no lo llama. Las pruebas ORM sí usan PostgreSQL real desechable, no mocks.

## Trazabilidad por historia

| Historia | Criterios y evidencia | Estado técnico |
|---|---|---|
| HU-01 | CA01–04: arquitectura/diccionario/relaciones/identidad; CA05: tipos, adaptador y pruebas; CA06–08: esquema, SQL de migración, upgrade y prueba ORM. | Implementada y verificada técnicamente; revisar diseño/retención. |
| HU-02 | CA01–04: botón, apertura/cierre, roles y banner; UI con proyecto simulado. | Implementada; acceso existente comprobado en regresión backend. |
| HU-03 | CA01–04: lista, orden, identidades y tres orígenes; pruebas de contrato y navegador. | Implementada y verificada. |
| HU-04 | CA01–04: detalle por selección, texto React sin HTML crudo y ausencia de acciones. | Implementada y verificada. |
| HU-05 | CA01–05: hook DOM y prueba UI; exportación sin cambios, referencia ausente, importación y rol vista. | Implementada y verificada. |
| HU-06 | CA01–05: selector de escenarios, textos de estado y sin escritura/envíos del panel. | Implementada y verificada. |
| HU-07 | CA01–07: catálogo completo, fuentes normativas y políticas diferenciadas; estándar y lint nuevo. | Documentada; aprobación de políticas pendiente del responsable. |

## Relación con T01–T14 del plan

T01–T14 tienen respaldo técnico en esquema, arquitectura, catálogo, contratos, navegador, ORM, compilaciones y regresión. T13 combina editor real con HTTP mock para presentación/exportación/generadores y backend real con PostgreSQL para guardado, carga y tres colaboradores Socket.IO. No se presenta como una sola sesión extremo a extremo con tres navegadores; ese ensayo integral queda como validación adicional posible, no como prueba ya realizada. Las revisiones documentales y de políticas requieren aceptación humana.

## Decisiones y riesgos visibles para la revisión

- La normalización propuesta del catálogo sigue el nuevo documento: minúsculas y sin acentos; debe confirmarse antes de implementar R05 real.
- El ciclo de composición a nivel de clases no demuestra por sí solo un ciclo de objetos; su tratamiento figura como advertencia de revisión y requiere acuerdo antes del Sprint 2.
- `displayId` no es una identidad histórica inmutable; el mock protege la selección por identidad de objeto y captura. La persistencia real de resultados requerirá el adaptador del motor.
- La política propuesta elimina datos del módulo al borrar proyecto y conserva acciones anonimizadas al borrar usuario. Retención temporal por acordar antes de producción.
- No hay endpoints de acciones; los servicios futuros deberán verificar permisos, pertenencia a proyecto y revisión del aviso antes de escribir. La FK del actor no sustituye esos controles.
- La persistencia usa enums Prisma en mayúsculas y claves enteras de proyecto; el contrato visual usa etiquetas técnicas minúsculas y proyecto textual. El servicio futuro mapeará explícitamente ambos formatos y la huella a `snapshotId`; los mocks no son una API Prisma directa.

## Cómo revisar

1. Abrir un proyecto con clases/relaciones y pulsar «Avisos UML». Puede importarse `fixtures/diagram.json` en un proyecto de demostración, nunca en un proyecto que se quiera conservar sin copia.
2. Recorrer lista, detalle y resaltado. Los avisos siempre están identificados como ejemplos.
3. Cambiar escenarios, probar cierre y rol vista.
4. Revisar `arquitectura-y-estandar.md`, `catalogo-reglas.md` y las capturas.
5. Para ORM seguir los comandos de arquitectura contra una base local desechable. La migración no fue aplicada a la base del usuario ni a producción.

Estado de aceptación: pendiente de revisión del responsable. Los PHU originales no se han reestimado automáticamente.
