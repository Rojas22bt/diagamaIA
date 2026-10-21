# Módulo de validación de diagramas de clases UML en tiempo real

## 1. Nombre del módulo

**Agente Inteligente para la Validación de Diagramas de Clases en Tiempo Real**, módulo de la plataforma Diagramador Inteligente.

El módulo revisa los diagramas de clases que los usuarios ya elaboran en la plataforma y les entrega avisos, explicaciones y recomendaciones mientras trabajan. Es un sistema híbrido:

- **Reglas programadas y algoritmos de grafos (BFS y DFS)** revisan la estructura del diagrama. No son inteligencia artificial.
- **Un modelo de deep learning preentrenado (Claude Haiku 5.5)** interpreta el significado de los nombres y redacta las recomendaciones de los casos semánticos. No se entrena ni se ajusta ningún modelo.

---

## 2. Objetivos

### 2.1 Objetivo general

Implementar y desarrollar el Agente Inteligente para la Validación de Diagramas de Clases en Tiempo Real como módulo de la plataforma Diagramador Inteligente, combinando reglas de validación programadas con el modelo de deep learning Claude Haiku 5.5, para detectar inconsistencias estructurales, subgrupos desconectados y posibles duplicaciones de significado en diagramas de clases UML, y ofrecer explicaciones y recomendaciones que faciliten su revisión por parte del equipo, aplicando la metodología Scrum.

### 2.2 Objetivos específicos

1. **Analizar** los requerimientos del módulo y las reglas de diseño UML durante el Sprint 1, **para** elaborar un Product Backlog priorizado y un catálogo de reglas que defina, con criterios reconocidos, qué inconsistencias debe detectar el agente.
2. **Diseñar** el panel de avisos y recomendaciones y el modelo de decisiones durante el Sprint 1, **para** que los usuarios visualicen los avisos con claridad y se conserve la trazabilidad de las decisiones sin duplicar información que la plataforma ya guarda.
3. **Establecer** los criterios que distinguen lo que resuelven las reglas programadas de lo que requiere el análisis semántico del modelo de deep learning, durante el Sprint 2, **para** procesar cada caso con la técnica más adecuada, manteniendo rapidez de respuesta y precisión.
4. **Aplicar** reglas programadas y algoritmos de recorrido de grafos (BFS y DFS) sobre el diagrama durante el Sprint 2, **para** detectar inconsistencias estructurales, ciclos de herencia o composición, clases aisladas y subgrupos desconectados.
5. **Integrar** el análisis semántico del modelo de deep learning y la sincronización por WebSocket en Diagramador Inteligente durante el Sprint 2, **para** que todos los usuarios de una misma sesión reciban en tiempo real los mismos avisos y recomendaciones.
6. **Realizar pruebas** del módulo con diagramas de ejemplo que contengan errores representativos, en cada sprint y con evaluación final en el Sprint 3, **para** verificar la precisión de la detección, el tiempo de respuesta y el cumplimiento de los criterios de aceptación de cada historia de usuario.

---

## 3. Alcance

El módulo se organiza en cinco submódulos. En este proyecto, la **navegabilidad se valida como conectividad**: se comprueba que todas las clases estén conectadas y que desde cualquiera se pueda llegar a las demás. No se valida el sentido de las flechas, porque el diagrama guarda qué clases se relacionan pero no hacia qué extremo se navega.

### 3.1 Submódulos y funciones

| Submódulo | Código | Función | Qué hace y sus límites | Sprint |
|---|---|---|---|---|
| **1. Validación estructural** (reglas programadas) | R01 | Validar multiplicidad | Verifica formato y presencia donde corresponda al tipo de relación. No se exige a la herencia. | 2 |
| | R02 | Validar tipo de relación | Comprueba asociación, agregación, composición y herencia según el catálogo de reglas. No promete validar todo UML. | 2 |
| | R03 | Detectar referencias huérfanas | Encuentra relaciones cuyo origen o destino ya no existe. No se refiere a claves foráneas de la base de datos. | 2 |
| | R04 | Identificar N:M sin clase intermedia | Emite una **recomendación**, no un error: depende del propósito del modelo. | 2 |
| | R05 | Detectar duplicación exacta | Clases con el mismo nombre en el diagrama y atributos repetidos dentro de una misma clase. Atributos iguales en clases distintas (`id`, `nombre`) no son duplicado. | 2 |
| | R06 | Explicar con plantillas | Cada detección de reglas se explica con un texto fijo, sin consultar al modelo. | 2 |
| **2. Análisis de grafo** (BFS y DFS) | G01 | Detectar ciclos de herencia y composición | DFS. Muestra la ruta del ciclo. Los ciclos de asociación no son error. | 2 |
| | G02 | Detectar clases aisladas | BFS sin dirección. Es una **advertencia**. Excepción para diagramas vacíos o de una sola clase. | 2 |
| | G03 | Detectar subgrupos desconectados | BFS sin dirección. Es una **advertencia**: la separación puede ser intencional. | 2 |
| **3. Análisis semántico** (Claude Haiku 5.5) | S01 | Seleccionar casos a consultar | Envía al modelo solo los casos dudosos, con las clases involucradas. | 2 |
| | S02 | Detectar atributos posiblemente equivalentes | Sugiere equivalencias como `domicilio` y `direccion_envio`. Es una sugerencia: pueden tener funciones distintas. | 2 |
| | S03 | Evaluar relaciones ambiguas | Juzga si el tipo de relación tiene sentido según el significado de las clases. | 2 |
| | S04 | Explicar y recomendar | Redacta explicación y recomendación de los casos semánticos, indicando su nivel de certeza. | 2 |
| | S05 | Validar la respuesta del modelo | Comprueba el formato y que los elementos citados existan. Nunca se ejecuta texto libre sobre el diagrama. | 2 |
| **4. Panel de avisos y recomendaciones** | P01 | Listar avisos | Ordena por severidad (error, advertencia, recomendación) y muestra el origen del aviso. | 1 |
| | P02 | Consultar detalle | Muestra explicación, recomendación y elementos afectados. | 1 |
| | P03 | Resaltar elementos afectados | Marca en el diagrama las clases o relaciones involucradas. | 1 |
| | P04 | Mostrar estados | Analizando, sin avisos, análisis parcial, fallo y sin permisos. "Sin avisos" no certifica que el modelo sea correcto. | 1 |
| | P05 | Aceptar o rechazar recomendaciones | Solo creador y editor. Aceptar no aplica el cambio ni lo da por resuelto. | 3 |
| | P06 | Aplicar una corrección soportada | **Opcional.** Vista previa y confirmación, solo con operaciones de un catálogo corto. | 3 |
| **5. Sincronización y bitácora** | B01 | Analizar tras cada cambio | Revisa la última versión del diagrama después de una pausa breve. | 2 |
| | B02 | Sincronizar avisos | Muestra los mismos avisos a todos los usuarios del proyecto y recupera el estado al reconectar. | 2 |
| | B03 | Registrar decisiones | Guarda aceptaciones y rechazos con autor, fecha y versión del diagrama. | 3 |
| | B04 | Consultar historial | Distingue detección, aceptación, rechazo, aplicación y resolución por nuevo análisis. | 3 |

### 3.2 Fuera del alcance

- La validación de otros diagramas UML (secuencia, actividades, casos de uso, estados).
- La validación del sentido de las flechas o navegabilidad dirigida.
- La generación del script SQL y los generadores de código de la plataforma.
- El entrenamiento o ajuste de modelos de inteligencia artificial.
- La corrección automática universal. Solo se admite el catálogo corto de P06, y es opcional.
- Exigir que todos los grupos de clases estén conectados o que toda relación N:M tenga clase intermedia.

---

## 4. Historias de usuario por sprint

Los puntos (PHU) son una **estimación inicial** y se confirman con el equipo en la planificación de cada sprint. Pruebas y corrección de defectos se hacen en cada sprint, no solo al final.

### Sprint 1: modelo de datos y panel visual (22 PHU)

**Meta:** definir los datos y el catálogo de reglas, y dejar el panel funcionando con datos de ejemplo que tienen la misma forma que tendrán los reales.

| ID | Historia de usuario | Prioridad | PHU | Descripción | Tips o herramienta | Ejemplo |
|---|---|---|---|---|---|---|
| HU-01 | Definir el modelo de avisos y de decisiones | Alta | 5 | Yo, como equipo de desarrollo, quiero definir cómo se guardan los avisos y las decisiones de los usuarios, reutilizando `Acciones_Proyecto`, **para** conservar la trazabilidad sin duplicar lo que la plataforma ya guarda. | Diagramar antes de programar (dbdiagram.io) y usar migraciones de Prisma. Identificar los elementos por su identificador estable (`displayId`), no por el nombre. | Tabla de decisiones con aviso, usuario, acción (aceptada o rechazada), fecha y versión del diagrama. |
| HU-02 | Acceder al panel de avisos | Alta | 3 | Yo, como usuario con acceso al proyecto, quiero abrir un panel de avisos y recomendaciones dentro del editor **para** revisar en un solo lugar lo que el sistema detecta. | Panel lateral en React y TypeScript. Diferenciarlo del panel de recomendaciones con IA que ya existe. | Botón "Avisos" que abre el panel sin salir del diagrama. |
| HU-03 | Ver los avisos ordenados por severidad | Alta | 3 | Yo, como usuario, quiero ver la lista de avisos con su severidad (error, advertencia, recomendación) y su origen **para** saber qué revisar primero. | Datos de ejemplo con la forma definitiva. Orden estable ante empates. | Un error "Ciclo de herencia" aparece arriba de una advertencia "Clase aislada". |
| HU-04 | Consultar el detalle de un aviso | Alta | 3 | Yo, como usuario, quiero abrir un aviso y leer su explicación y recomendación **para** entender el problema y cómo revisarlo. | Sección expandible. Texto en lenguaje simple. | Al abrir "Clase aislada: Proveedor" se explica por qué se avisa y qué opciones hay. |
| HU-05 | Resaltar los elementos afectados | Alta | 3 | Yo, como usuario, quiero que al elegir un aviso se resalten en el diagrama las clases o relaciones involucradas **para** ubicarlas sin buscarlas. | Estilos condicionales de JointJS según severidad. | Al elegir un aviso de `Factura`, la clase se marca con borde rojo. |
| HU-06 | Ver los estados del panel | Media | 2 | Yo, como usuario, quiero distinguir si el sistema está analizando, no encontró avisos, tuvo un análisis parcial o falló **para** saber cuánto confiar en lo que veo. | Componente de estado vacío. Texto que aclare que "sin avisos" no garantiza un modelo correcto. | "No se detectaron avisos con las reglas revisadas." |
| HU-07 | Definir el catálogo de reglas y el estándar de código | Alta | 3 | Yo, como equipo de desarrollo, quiero documentar cada regla con su severidad, excepciones y ejemplos válidos e inválidos, y acordar un estándar de código **para** que el equipo programe de forma consistente. | Documento del catálogo en el repositorio. ESLint y Prettier. | R05: dos clases `Cliente` en un diagrama es error. `nombre` en dos clases distintas es válido. |

### Sprint 2: validación, análisis semántico y tiempo real (29 PHU)

**Meta:** el agente detecta, explica y comparte avisos reales entre los usuarios de una sesión.

| ID | Historia de usuario | Prioridad | PHU | Descripción | Tips o herramienta | Ejemplo |
|---|---|---|---|---|---|---|
| HU-08 | Detectar problemas estructurales | Alta | 5 | Yo, como modelador, quiero que el sistema revise multiplicidades, tipos de relación, referencias huérfanas y duplicados exactos **para** corregir inconsistencias objetivas sin revisar a mano. | Una función por regla, fácil de probar. Normalizar nombres (minúsculas, sin acentos). Explicar con plantillas, sin el modelo. | Una N:M sin clase intermedia genera una recomendación, no un error. |
| HU-09 | Detectar ciclos de herencia y composición | Alta | 3 | Yo, como modelador, quiero que el sistema encuentre ciclos de herencia o composición **para** corregir dependencias imposibles. | DFS con estados "nueva, en camino, terminada". Mostrar la ruta. | Vehículo hereda de Máquina, Máquina de Equipo y Equipo de Vehículo: se muestra la ruta completa. |
| HU-10 | Detectar clases aisladas y subgrupos desconectados | Alta | 3 | Yo, como modelador, quiero ver qué clases o grupos no están conectados con el resto **para** decidir si es intencional. | BFS sin dirección sobre un grafo armado en memoria. Severidad de advertencia. Excepción para diagramas pequeños. | Proveedor y Categoría forman un grupo separado: "No tienen conexión con el resto del diagrama". |
| HU-11 | Revisar ambigüedades semánticas | Alta | 8 | Yo, como modelador, quiero sugerencias sobre atributos posiblemente equivalentes y relaciones dudosas **para** revisar el significado de mi modelo. | Claude Haiku 5.5 por API, consultado desde el servidor. Mensaje de sistema fijo y 3 a 5 ejemplos. Respuesta en JSON validada, con nivel de certeza. Registrar modelo y versión. | `domicilio` y `direccion_envio` se sugieren como posible duplicado, aclarando que pueden tener funciones distintas. |
| HU-12 | Analizar cambios y controlar las consultas al modelo | Alta | 5 | Yo, como colaborador, quiero que el análisis se actualice sin consultas innecesarias **para** mantener fluida la edición. | Pausa configurable (~0.5 s). Caché de resultados. Tiempo de espera y reintentos. Si falla la IA se conservan los resultados de las reglas. Credencial solo en el servidor. | Si el modelo tarda y el usuario vuelve a editar, la respuesta vieja se descarta. |
| HU-13 | Compartir avisos en tiempo real | Alta | 5 | Yo, como colaborador, quiero ver los mismos avisos que mis compañeros **para** coordinar la revisión. | Socket.IO por proyecto. Recuperar el estado al reconectar. Aislar proyectos entre sí. | María entra a la sesión y ve los mismos avisos que Juan. |

### Sprint 3: decisiones, trazabilidad y evaluación (24 PHU)

**Meta:** registrar las decisiones de los usuarios y evaluar todo el módulo.

| ID | Historia de usuario | Prioridad | PHU | Descripción | Tips o herramienta | Ejemplo |
|---|---|---|---|---|---|---|
| HU-14 | Aceptar o rechazar recomendaciones | Alta | 3 | Yo, como creador o editor, quiero aceptar o rechazar una recomendación **para** dejar constancia de la decisión del equipo. | Permisos comprobados en el servidor. Aceptar no aplica ni da por resuelto. Los rechazos también se guardan. | Juan (editor) rechaza un aviso. María, con rol de vista, no ve los botones. |
| HU-15 | Consultar el historial de decisiones | Media | 3 | Yo, como usuario del proyecto, quiero ver el historial de decisiones **para** saber cómo evolucionó la validación. | Reutilizar `Acciones_Proyecto` más la tabla de decisiones. No duplicar eventos si no hubo cambios. | Un aviso muestra: detectado, rechazado por María, detectado de nuevo tras un cambio. |
| HU-16 | Aplicar una corrección soportada (opcional) | Baja | 5 | Yo, como creador o editor, quiero revisar y aplicar una corrección sugerida **para** modificar el diagrama de forma controlada. | Vista previa y confirmación. Solo operaciones de un catálogo corto, nunca texto libre del modelo. Rechazar aplicaciones desactualizadas. | Tras confirmar, se unen dos atributos equivalentes y el sistema vuelve a analizar. |
| HU-17 | Probar las reglas y los recorridos de grafo | Alta | 3 | Yo, como equipo de pruebas, quiero ejecutar casos válidos, inválidos y excepciones **para** verificar que las detecciones sean correctas y sin falsas alarmas. | Pruebas unitarias (por ejemplo Jest). Incluir diagrama vacío y de una clase. | 15 diagramas de prueba, cada uno con un error conocido de antemano. |
| HU-18 | Evaluar el análisis semántico y medir tiempos | Alta | 5 | Yo, como equipo de desarrollo, quiero medir la calidad y la velocidad del modelo **para** conocer su aporte real y sus límites. | Casos etiquetados a mano. Medir precisión, exhaustividad y falsos positivos. Comparar con y sin el modelo. Latencia en percentil 95. | Se compara qué equivalencias detecta el modelo frente a las que marcó el equipo. |
| HU-19 | Verificar la sincronización y que lo existente siga funcionando | Alta | 3 | Yo, como usuario, quiero que carga, guardado y colaboración sigan funcionando **para** confiar en que el módulo no dañó la plataforma. | Pruebas con 3 usuarios y reconexión. Revisar generación de proyectos con diagramas existentes. | Un diagrama creado antes del módulo carga y se guarda sin errores. |
| HU-20 | Documentar el módulo y preparar la demostración | Media | 2 | Yo, como equipo de proyecto, quiero documentar el módulo y preparar la demostración **para** presentarlo y mantenerlo. | Documento técnico y guion de la demo. | Documento con arquitectura, capturas del panel y ejemplos de avisos. |

---

## 5. Conclusión

Se realizará un módulo integrado de validación de diagramas de clases. Su núcleo es la comprobación estructural con reglas programadas y la comprobación de conectividad con algoritmos de grafos (BFS y DFS), ambas rápidas y sin inteligencia artificial. Sobre ese núcleo, el modelo de deep learning Claude Haiku 5.5 evalúa solo los casos que dependen del significado y redacta explicaciones y recomendaciones. Su aporte se medirá en el Sprint 3, sin suponer de antemano que todas sus sugerencias mejoran el resultado.

El resultado esperado es que los usuarios sepan qué condición requiere revisión, dónde está, por qué se señala y qué alternativa se propone, con avisos compartidos en tiempo real y decisiones registradas. El agente es asistencial: avisa, explica y recomienda, y la decisión de modificar el diagrama es siempre del usuario.

---

## 6. Frontera del módulo

### Entradas

- La versión actual del diagrama del proyecto: clases, atributos, métodos y relaciones, con sus identificadores.
- Multiplicidades y tipos de relación guardados en `diagrama_json`.
- Eventos de edición y decisiones de usuarios con permisos sobre el proyecto.

### Responsabilidades propias

1. Comprobar la estructura con el catálogo de reglas aprobado.
2. Armar el grafo del diagrama en memoria y analizar ciclos, clases aisladas y subgrupos desconectados.
3. Seleccionar los casos ambiguos, consultar al modelo y validar su respuesta antes de mostrarla.
4. Consolidar los resultados sin duplicados y asociarlos a la versión analizada.
5. Mostrar avisos, explicaciones y recomendaciones, diferenciando errores comprobados de advertencias y sugerencias semánticas.
6. Sincronizar los resultados y registrar las decisiones de los usuarios.

### Salidas

- Avisos con regla o categoría, severidad, elementos afectados, explicación, recomendación y versión del diagrama.
- Estado del análisis: en proceso, completo, parcial o fallido.
- Decisiones e historial asociados al proyecto y a sus usuarios.
- Cambios al diagrama solo con confirmación del usuario y solo para operaciones del catálogo corto (opcional).

### Lo que la plataforma ya aporta y el módulo reutiliza

El editor sigue encargándose de crear y editar diagramas. La plataforma conserva autenticación, proyectos, invitaciones, roles (creador, editor, vista), persistencia, la bitácora `Acciones_Proyecto` y el transporte colaborativo. El módulo se apoya en eso y agrega solo los datos, interfaces y eventos que necesita. Debe diferenciarse del panel de recomendaciones con IA que ya existe, para no duplicar paneles ni eventos.

### Límites de la validación

El módulo verifica solo las reglas y recorridos definidos en el catálogo. No deduce que toda conexión posible sea obligatoria ni garantiza que el modelo sea correcto para el dominio. Una ausencia de avisos no certifica corrección. El modelo de deep learning aporta interpretación, no sustituye las comprobaciones de las reglas ni decide por el usuario. Si falta información o contexto, el módulo lo indica en vez de sacar conclusiones sin sustento.

### Metas de calidad propuestas (a aprobar)

- Todos los casos de prueba aprobados del catálogo de reglas deben pasar.
- Reglas y grafos: hasta 1 segundo en el percentil 95 para 100 clases y 200 relaciones.
- Sincronización: hasta 1 segundo en el percentil 95 con 3 usuarios.
- Calidad semántica: umbral de precisión y exhaustividad por definir con el conjunto etiquetado.

### Pendiente antes de iniciar

- Aprobar el catálogo de reglas con sus severidades (HU-07).
- Fijar presupuesto, tiempo de espera y reintentos de las consultas al modelo.
- Definir la duración del sprint y confirmar los PHU con el equipo.
- Confirmar con el equipo si HU-16 (aplicar corrección) entra o queda como mejora futura.
