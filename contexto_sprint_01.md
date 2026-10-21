# Contexto y plan del Sprint 01: modelo de datos y panel visual

## 1. Referencia y estado

Referencia principal: `modulo_agente_validacion_uml.md`, específicamente sus objetivos 1 y 2, funciones P01–P04 e historias HU-01–HU-07. Este documento sustituye el plan anterior del Sprint 1; no modifica el archivo de referencia.

Estado: implementación técnica realizada el 21/10/2026, con aceptación pendiente. Consultar `docs/sprint-01/informe-entrega.md` para pruebas y límites de la verificación. Estimación inicial: 22 PHU, pendiente de confirmar con el equipo. Duración, responsables y capacidad todavía no acordados.

El incremento de este sprint es un panel integrado al editor con datos de ejemplo controlados, más el diseño e implementación de las tablas del módulo en Prisma, su migración comprobada en una base de pruebas, contratos, catálogo de reglas y estándar de código. No se entregan motores de detección reales, consultas al LLM ni sincronización de avisos. La ampliación de HU-01 requiere reestimar sus puntos; los 22 PHU del archivo de referencia dejan de representar un compromiso confirmado.

## 2. Objetivo del sprint

Implementar el modelo de persistencia de resultados y acciones del módulo mediante Prisma y desarrollar el panel integrado al editor con datos de ejemplo de estructura contractual definida, para preparar la trazabilidad de la validación y permitir que el usuario consulte, interprete y localice avisos antes de incorporar los motores reales.

| Objetivo de referencia | Resultado del Sprint 1 |
|---|---|
| Objetivo específico 1: analizar requerimientos y reglas UML para elaborar backlog y catálogo. | HU-01–HU-07 refinadas y trazables; catálogo con severidad, excepciones, fuentes y ejemplos. |
| Objetivo específico 2: diseñar panel y modelo de decisiones para claridad y trazabilidad. | Panel integrado, estados y resaltado; diseño lógico/físico de datos y contratos documentados. |

Cumplir este objetivo no demuestra todavía que el agente detecta inconsistencias. Demuestra que su presentación y sus contratos están preparados y verificados.

## 3. Frontera del incremento

| Submódulo de referencia | Incluido | No incluido |
|---|---|---|
| 1. Validación estructural | Documentar R01–R06 en el catálogo. | Ejecutar reglas reales o analizar diagramas. |
| 2. Análisis de grafo | Documentar G01–G03 y sus casos. | Implementar DFS/BFS, ciclos o conectividad. |
| 3. Análisis semántico | Definir estructura de avisos semánticos y límites S01–S05. | API de Claude, prompts operativos, selección de casos o evaluación del modelo. |
| 4. Panel | P01–P04: listado, detalle, resaltado y estados mediante ejemplos controlados. | P05/P06: decisiones y correcciones. |
| 5. Sincronización y bitácora | Tablas Prisma, migración y pruebas ORM de resultados y acciones del módulo, vinculados al proyecto existente. | Análisis automático, endpoints de decisiones, historial funcional para el usuario y WebSocket de avisos. |

### Delimitación de HU-01

Por aclaración del responsable del proyecto, HU-01 comprende diseño lógico, modelos Prisma, migración y comprobación de escritura/lectura y restricciones mediante el ORM en una base de pruebas. No incluye todavía endpoints, registro de decisiones desde el panel ni historial operativo para usuarios. Aplicar la migración a producción no forma parte de este plan.

El proyecto y su diagrama ya se guardan en la plataforma. `Proyecto.diagrama_json` seguirá siendo la fuente del diagrama. No se crearán tablas de clases UML, atributos, relaciones o multiplicidades ni copias del proceso del proyecto. Las reglas, los grafos y el LLM leerán el modelo existente; los grafos se construirán en memoria. Solo se persistirán resultados y trazabilidad propios del módulo.

### Uso de datos de ejemplo

- Usar un proveedor de datos de demostración separado del panel, con contratos tipados y validados.
- Mostrar claramente «Datos de ejemplo: no se está analizando el diagrama».
- No guardar avisos ficticios en la base de datos ni registrarlos en `Acciones_Proyecto`.
- No mezclar ejemplos con resultados de las recomendaciones IA existentes.
- Usar un diagrama de demostración controlado cuyos elementos correspondan a los avisos. Nunca sobrescribir un proyecto del usuario para preparar la demostración.
- Los estados analizando, parcial y fallo se simulan únicamente mediante un mecanismo de prueba identificable; no aparentan un servicio real.

La conectividad se documenta sin dirección. Se detectarán desconexiones como advertencias en el catálogo; no se convierte la conexión de todas las clases en requisito obligatorio.

## 4. Contratos y diseño de información

### Contrato de aviso propuesto

| Campo | Propósito |
|---|---|
| Identificador del aviso | Selección y orden estable, independiente de su texto. |
| Proyecto y versión/captura | Determinar a qué contexto pertenece; en demostración, identificados como ejemplo. |
| Código y versión de regla | Vincular catálogo y resultado. |
| Severidad | Error, advertencia o recomendación. |
| Origen | Reglas, grafo o semántico. |
| Resumen, explicación y recomendación | Presentar el contenido al usuario. |
| Referencias afectadas | Clase, relación o atributo, con identificador y contexto suficientes. |
| Estado y fecha | Representar el ciclo del aviso; fechas ficticias identificadas en ejemplos. |

Los ejemplos deben cumplir el mismo contrato que consumirá el panel con datos reales. El contrato se versiona y queda revisado en este sprint; ajustes posteriores requieren actualización explícita, sin prometer que nunca cambiará.

### Entidades mínimas a implementar en Prisma

- Análisis de validación: proyecto existente, huella o versión del contenido analizado, estado, motor, fecha y versión de reglas/modelo cuando corresponda. No almacena otra copia completa del diagrama.
- Aviso de validación: análisis, clave de detección, código, severidad, origen, referencias afectadas, explicación y recomendación. La recomendación puede ser parte del aviso; no se exige otra tabla sin necesidad funcional.
- Acción de validación: aviso, usuario/participación existente, tipo de acción, fecha y versión analizada. Prepara aceptación, rechazo y, si se incorpora, aplicación; no registra cada movimiento o edición del editor.
- Vinculación con `Proyecto`, `Usuario`/`Detalle_Proyecto` y `Acciones_Proyecto`, con claves, restricciones y política de borrado documentadas. Antes de crear almacenamiento redundante, decidir si la acción especializada extiende un evento existente o constituye el único registro de esa decisión. No duplicar una misma acción sin vínculo y finalidad explícitos.

Los nombres físicos y campos finales se concretarán en las tareas de HU-01. Las referencias a clases/relaciones pueden conservarse como identificadores en el aviso; no son tablas nuevas del dominio UML. La resolución automática se representa como evolución del aviso/análisis, sin atribuir una acción humana ficticia.

Debe distinguirse aceptación, rechazo, aplicación y resolución: aceptar no aplica un cambio ni demuestra resolución. El estado de una decisión no reemplaza el estado de un aviso.

### Identidad y versiones

El editor actual puede normalizar `displayId`; no se lo considerará identidad histórica inmutable sin verificar su ciclo de vida. HU-01 debe documentar una estrategia de referencia estable y su compatibilidad con los identificadores existentes. Para el resaltado del sprint se utiliza un adaptador sobre la captura de demostración vigente. No se refactoriza globalmente la identidad del editor.

La asociación de resultados con versiones/capturas se diseña ahora; el control concurrente y la generación operativa de versiones no se implementan aquí.

## 5. Historias comprometidas y criterios de aceptación

Se mantienen los identificadores y puntos del archivo de referencia. Las tareas técnicas apoyan estas historias y no se contabilizan como nuevas historias.

### HU-01. Definir el modelo de avisos y de decisiones — Alta — 5 PHU

Como equipo de desarrollo, quiero definir cómo representar avisos y decisiones y su relación con la auditoría existente para conservar trazabilidad sin duplicar información.

- CA01: entregar diagrama de entidades, diccionario de campos, relaciones, nulabilidad, índices y restricciones propuestas.
- CA02: documentar cómo se vinculan proyecto, usuario, aviso, recomendación, análisis y `Acciones_Proyecto`; explicar qué dato tiene una sola fuente de verdad.
- CA03: definir aceptación, rechazo, aplicación y resolución por separado, con ejemplos de transición.
- CA04: documentar estrategia de identificadores y versión/captura, incluyendo el riesgo de normalización de `displayId`.
- CA05: entregar contratos tipados para panel, estados y referencias afectadas, con ejemplos válidos y respuestas inválidas rechazadas por el adaptador.
- CA06: implementar los modelos Prisma y generar la migración; aplicarla y verificarla en una base de pruebas con datos previos, sin eliminar ni reestructurar el diagrama existente.
- CA07: demostrar escritura/lectura ORM, relaciones, unicidad y política de borrado con datos de prueba aislados; las referencias inválidas se rechazan según las restricciones definidas.
- CA08: comprobar que no se crean tablas UML ni copias del diagrama, y que la trazabilidad especializada no duplica acciones ya registradas sin vínculo justificado.

Realización: inspeccionar esquema y auditoría actuales, diseñar la extensión mínima, implementar modelos y migración y comprobarlos mediante Prisma en una base de pruebas. El diseño por sí solo ya no acredita esta historia; tampoco lo hace un panel aislado. Los registros de prueba no deben mezclarse con datos reales.

### HU-02. Acceder al panel de avisos — Alta — 3 PHU

Como usuario con acceso al proyecto, quiero abrir el panel dentro del editor para revisar los avisos sin salir del diagrama.

- CA01: abrir y cerrar mediante un control visible e identificable, separado funcionalmente de las recomendaciones IA existentes.
- CA02: conservar el contenido y los cambios del diagrama al abrir/cerrar; no navegar fuera del proyecto.
- CA03: creador, editor y vista pueden consultar cuando tienen acceso; no introducir rutas ni servicios que permitan acceso cruzado a proyectos.
- CA04: identificar el modo de demostración y cargar ejemplos únicamente mediante su proveedor separado.

Realización: componente de panel desacoplado y punto de entrada mínimo en el editor. Reutilizar el control de acceso existente, sin rediseñar autenticación.

### HU-03. Ver avisos ordenados por severidad — Alta — 3 PHU

Como usuario, quiero ver severidad y origen para decidir qué revisar primero.

- CA01: mostrar resumen, severidad y origen para cada aviso de ejemplo.
- CA02: ordenar error, advertencia y recomendación; desempatar por código e identificador de aviso.
- CA03: mantener orden reproducible ante recarga de los mismos ejemplos y representar identificadores únicos sin filas duplicadas.
- CA04: demostrar avisos de reglas, grafos y semántica; todos deben estar identificados como ejemplos, no detecciones reales.

Realización: presentación a partir del contrato de HU-01, con ordenación independiente del componente visual.

### HU-04. Consultar detalle — Alta — 3 PHU

Como usuario, quiero leer explicación y recomendación para comprender el aviso y las opciones de revisión.

- CA01: seleccionar un aviso muestra código, explicación, recomendación, origen y elementos afectados correspondientes.
- CA02: cambiar de selección actualiza todo el detalle sin conservar texto del aviso anterior.
- CA03: mostrar contenido como texto seguro; no ejecutar HTML o instrucciones procedentes de los ejemplos o de una futura respuesta del LLM.
- CA04: no mostrar botones de aceptar, rechazar o aplicar como funcionalidad disponible.

Realización: detalle expandible o sección del panel; textos simples y consistentes con el catálogo.

### HU-05. Resaltar elementos afectados — Alta — 3 PHU

Como usuario, quiero localizar las clases y relaciones del aviso para encontrarlas en el diagrama.

- CA01: seleccionar avisos de ejemplo resalta las clases y relaciones existentes referenciadas en la captura de demostración.
- CA02: los atributos se ubican en su clase contenedora y se identifican en el detalle; no se promete selección individual si el editor no la representa.
- CA03: referencias ausentes se indican en el detalle sin inventar figuras ni provocar fallos.
- CA04: cambiar de aviso o cerrar el panel restaura el estilo anterior, sin modificar atributos, posiciones ni relaciones.
- CA05: el resaltado funciona para rol vista sin habilitar edición; no persiste ni se transmite como cambio colaborativo del modelo.

Realización: adaptador de referencias a vistas JointJS y capa visual temporal. Evitar cambios en atributos serializados del grafo que activen guardado o Socket.IO.

### HU-06. Ver estados del panel — Media — 2 PHU

Como usuario, quiero distinguir el estado del análisis para interpretar lo que muestra el panel.

- CA01: representar analizando, sin avisos, parcial, fallo y sin permisos mediante escenarios controlados.
- CA02: el estado vacío indica que no se detectaron avisos con las reglas revisadas y no certifica corrección total.
- CA03: el estado parcial conserva resultados disponibles e identifica qué parte no se completó; fallo no se representa como ausencia de problemas.
- CA04: mantener visible que la información es de ejemplo, incluso durante la simulación de carga o fallo.
- CA05: cambiar de estado no modifica el diagrama ni dispara análisis, guardados o consultas al LLM.

Realización: máquina de estados o representación tipada explícita, con escenarios de demostración seleccionables fuera del flujo normal de edición.

### HU-07. Definir catálogo de reglas y estándar de código — Alta — 3 PHU

Como equipo, quiero documentar las reglas y las convenciones para implementar consistentemente el módulo.

- CA01: catalogar R01–R06, G01–G03 y S01–S05 con propósito, entradas, condiciones, severidad cuando aplique, excepciones y límites.
- CA02: distinguir reglas UML, políticas propias y recomendaciones contextuales; registrar fuentes concretas verificadas para las afirmaciones normativas.
- CA03: definir normalización de nombres y severidad de duplicados. La propuesta del nuevo archivo es comparación en minúsculas y sin acentos, pero debe aprobarse y documentarse su efecto; no heredar silenciosamente la política del plan anterior.
- CA04: documentar al menos un caso aplicable y uno negativo o de excepción por validación; para selección, explicación y validación de respuestas semánticas, registrar escenarios de comportamiento esperado.
- CA05: distinguir conectividad sin dirección de navegabilidad dirigida y mantener desconexiones como advertencias y N:M como recomendación contextual.
- CA06: acordar estándar de tipos, organización, errores y formato para el código nuevo; comprobar las herramientas existentes antes de introducir otras. No imponer una reformateación del repositorio completo.
- CA07: vincular cada función del catálogo con sus historias globales; marcar claramente que su motor aún no está implementado.

Realización: documento versionado en el repositorio y revisión técnica/funcional. Los ejemplos del panel deben corresponder al catálogo aprobado, no definirlo implícitamente.

## 6. Decisiones necesarias para iniciar tareas dependientes

| ID | Decisión | Propuesta/condición |
|---|---|---|
| D01 | Delimitación del incremento. | Tablas y migración incluidas por indicación del usuario; sin motores reales, endpoints de decisiones ni llamadas IA. |
| D02 | Identidad y vínculo con auditoría. | Revisar `displayId`, acordar referencias por captura y diseñar identidad histórica. |
| D03 | Severidades y normalización. | Resolver ejemplos de duplicados y comparación de nombres antes de cerrar catálogo/fixtures. |
| D04 | Mecanismo de demostración. | Proveedor separado, indicador permanente y diagrama de prueba que no sobrescriba proyectos. |
| D05 | Diseño visual y comportamiento de resaltado. | Panel con acceso para los tres roles y capa temporal sin eventos de modificación. |
| D06 | Capacidad y calendario. | Confirmar 22 PHU, duración, responsables y dependencias. |

Se registrará decisión, responsable y fecha; todavía no se consideran aprobadas por existir en este archivo. Las políticas de presupuesto y proveedor del LLM no bloquean el panel de ejemplos, salvo el diseño de contratos que resulte afectado.

## 7. Plan de realización

| Orden | Trabajo | Entregable verificable | Historia/dependencia |
|---|---|---|---|
| 1 | Confirmar D01–D06 y revisar diferencias con archivo base. | Alcance comprometido, responsables y estimación confirmada. | Entrada del sprint. |
| 2 | Revisar esquema, identidad, estilos JointJS y eventos de guardado. | Diagnóstico de integración y estado inicial de compilación. | HU-01, HU-05. |
| 3 | Diseñar datos y contratos; implementar modelos Prisma y migración; acordar catálogo y convenciones. | Diagrama, diccionario, migración aplicada en pruebas, verificaciones ORM y catálogo. | HU-01, HU-07. |
| 4 | Preparar proveedor de ejemplos y captura de demostración. | Fixtures validados y escenarios identificados. | HU-01, HU-07. |
| 5 | Integrar apertura, listado, detalle y estados. | Panel funcional con ejemplos reales del contrato. | HU-02, HU-03, HU-04, HU-06. |
| 6 | Integrar selección y resaltado temporal. | Localización de clases y relaciones sin efectos sobre el modelo. | HU-05; requiere 4–5. |
| 7 | Verificar criterios, permisos de consulta y ausencia de efectos secundarios. | Pruebas y evidencia por criterio; correcciones. | Todas las historias. |
| 8 | Demostrar incremento y revisar expediente. | Acta de aceptación y estado final por historia. | Cierre. |

Puntos de integración previstos: componentes de validación, tipos y proveedor de ejemplos en frontend; acceso mínimo en `ConnectedDiagramPage.tsx`; modelos en `backendia/prisma/schema.prisma` y migraciones del módulo. No se programan motores de validación ni endpoints funcionales de decisiones en este sprint.

Los documentos y fixtures deberán tener ubicación acordada durante la definición de tareas. Este plan no declara que esos entregables ya existen.

## 8. Matriz de verificación

Todos los criterios de la sección 5 deben tener evidencia; la matriz siguiente agrupa escenarios y no sustituye criterios individuales.

| Prueba | Escenario y resultado esperado | Historias |
|---|---|---|
| T01 | Revisar entidades y auditoría; validar/generar Prisma, aplicar migración en base de pruebas con datos previos y demostrar escritura/lectura, restricciones y política de borrado. Comprobar conservación del diagrama y ausencia de tablas UML redundantes. | HU-01 |
| T02 | Revisar identidad/versiones y validar ejemplos contra contrato, incluyendo referencias inválidas. | HU-01 |
| T03 | Abrir/cerrar panel y volver a editar; contenido y cambios conservados, modo ejemplo explícito. | HU-02 |
| T04 | Mostrar las tres severidades y orígenes; comprobar orden estable y ausencia de filas duplicadas. | HU-03 |
| T05 | Cambiar entre avisos; verificar correspondencia de detalle y presentación segura del texto. | HU-04 |
| T06 | Resaltar clase, varias clases, relación y clase de atributo; limpiar selección restaurando estilo original. | HU-05 |
| T07 | Seleccionar referencia ausente y cambiar el diagrama de demostración; no destacar un elemento incorrecto ni fallar. | HU-05 |
| T08 | Probar consulta con creador/editor/vista; sin controles de decisión o corrección ni edición habilitada por el panel. | HU-02, HU-04, HU-05 |
| T09 | Simular analizando, vacío, parcial, fallo y sin permisos; verificar mensajes y distintivo de demostración. | HU-06 |
| T10 | Comparar JSON del diagrama antes/después y observar eventos de guardado/Socket.IO al usar el panel. | HU-02, HU-05, HU-06 |
| T11 | Verificar catálogo completo, fuentes, normalización, severidades, excepciones y trazabilidad. | HU-07 |
| T12 | Compilar frontend y ejecutar comprobaciones pertinentes del código nuevo; distinguir fallos previos del repositorio. | Todas |
| T13 | Cargar, editar, guardar y reabrir proyecto existente; comprobar colaboración y recomendaciones previas tras integrar panel. | Regresión |
| T14 | Verificar proveedor de ejemplos separado y ausencia de peticiones LLM, escrituras de avisos ficticios o nuevos servicios de análisis. | Frontera del sprint |

Para T10 aislar la interacción del panel de las ediciones normales: no basta con ver que existen eventos del editor; se debe demostrar que el resaltado y la consulta no originan actualizaciones del modelo.

Cada evidencia incluye caso, pasos o comando, datos, entorno, versión del código, resultado esperado/obtenido y ubicación del registro o captura. Las capturas prueban presentación; las aserciones y observación de eventos prueban contratos y ausencia de efectos secundarios.

## 9. Demostración de cierre

1. Explicar que se demuestra interfaz y diseño, no detección real.
2. Mostrar modelo de datos, vínculo con auditoría y estrategia de identidad/versiones.
3. Mostrar catálogo y correspondencia de los ejemplos con sus reglas.
4. Abrir panel en diagrama de demostración, recorrer listado, detalle y resaltado de clases y relaciones.
5. Mostrar referencia ausente sin inventar figuras, restauración visual y conservación del diagrama.
6. Recorrer estados simulados manteniendo visible su condición de ejemplo.
7. Demostrar consulta con rol vista sin habilitar edición ni decisiones.
8. Presentar evidencia de contrato, compilación, ausencia de cambios o eventos del modelo y regresión.

El uso de fixtures acredita el panel, pero no la persistencia: esta exige migración aplicada y pruebas reales mediante Prisma. No acredita reglas, grafos, LLM ni sincronización todavía no implementados.

## 10. Definición de terminado y cálculo del 100 %

### Condiciones obligatorias

- HU-01–HU-07 cumplen todos sus criterios con evidencia revisada.
- T01–T14 están ejecutadas y aprobadas sobre la misma versión entregada.
- Modelos Prisma, migración y pruebas ORM están completos; contratos, catálogo y estándar están revisados. Los datos existentes del proyecto y del diagrama se conservan.
- Panel integrado al editor, no solamente una imagen o maqueta externa.
- Los ejemplos y estados simulados están identificados; no hay afirmaciones de análisis real.
- No quedan defectos abiertos que incumplan los criterios, alteren el diagrama o impidan la demostración.
- Cambios del sprint compilables y sin regresiones bloqueantes atribuibles al incremento. Los problemas previos se registran al inicio; si bloquean la evidencia exigida, se resuelven o el cierre permanece pendiente.
- Responsable del proyecto acepta expresamente el incremento.

Por historia: criterios aprobados con evidencia / criterios comprometidos × 100. Pendientes, fallidos y no ejecutados no cuentan como aprobados. El sprint llega al 100 % solo si todas las historias y condiciones obligatorias están cumplidas; PHU consumidos o tareas iniciadas no demuestran finalización.

No se eliminan criterios fallidos para declarar cierre. Cualquier cambio del compromiso debe quedar aprobado y versionado antes de recalcularlo.

### Expediente de evidencia

Acta de alcance y decisiones; diseño de datos y contratos; catálogo y estándar; fixtures; código identificado por commit o referencia reproducible; matriz criterio/evidencia; resultados T01–T14; guion y capturas de demo; defectos y limitaciones; acta de aceptación.

### Estado de entrega técnica · 21/10/2026

| Elemento | Estado | Evidencia |
|---|---|---|
| D01–D06 | Alcance autorizado; decisiones finales de catálogo, retención y aceptación pendientes. | Informe de entrega y arquitectura. |
| HU-01 (5 PHU iniciales) | Implementada/documentada; pendiente de aceptación. | Informe de entrega y pruebas asociadas. |
| HU-02 (3 PHU iniciales) | Implementada/documentada; pendiente de aceptación. | Informe de entrega y pruebas asociadas. |
| HU-03 (3 PHU iniciales) | Implementada/documentada; pendiente de aceptación. | Informe de entrega y pruebas asociadas. |
| HU-04 (3 PHU iniciales) | Implementada/documentada; pendiente de aceptación. | Informe de entrega y pruebas asociadas. |
| HU-05 (3 PHU iniciales) | Implementada/documentada; pendiente de aceptación. | Informe de entrega y pruebas asociadas. |
| HU-06 (2 PHU iniciales) | Implementada/documentada; pendiente de aceptación. | Informe de entrega y pruebas asociadas. |
| HU-07 (3 PHU iniciales) | Implementada/documentada; pendiente de aceptación. | Informe de entrega y pruebas asociadas. |
| T01–T14 | Verificaciones técnicas ejecutadas, incluida regresión real API/Socket.IO; revisiones humanas pendientes. | `docs/sprint-01/informe-entrega.md`. |
| Aceptación | Pendiente | Sin acta. |

## 11. Frontera y conclusión del Sprint 1

El Sprint 1 cubre la definición de información y reglas y la presentación visual de avisos mediante un panel integrado con datos de ejemplo. Su resultado verificable es que el usuario puede consultar, interpretar y localizar esos avisos y distinguir sus estados, mientras el equipo dispone de contratos y diseño revisados.

Se implementan las tablas propias del módulo y su migración verificada en pruebas; no tablas de multiplicidades, clases o relaciones UML ni otro almacenamiento del diagrama. No se implementan todavía detecciones estructurales, recorridos de grafos, conectividad real, LLM, disparo automático, sincronización de avisos, decisiones desde el panel, consulta funcional de historial ni correcciones. Tener las tablas no equivale a tener esos flujos operativos.

Este documento conserva las siete historias de referencia y amplía HU-01 con la implementación ORM autorizada por el responsable. Sus puntos y el total deben reestimarse. El módulo completo validará en tiempo real mediante reglas y grafos, recurrirá al LLM en casos semánticos y recomendará; el Sprint 1 prepara su persistencia y presentación. Su cierre exigirá evidencia y aceptación de este incremento, sin confundirlo con la finalización del agente completo.
