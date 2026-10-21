# Catálogo de validación · versión 1 · Sprint 1

Estado: especificación para revisión del responsable. Este sprint documenta el catálogo; no implementa ninguno de estos motores. Los avisos del panel son mocks.

## Fuentes y separación normativa

Referencia primaria: [OMG UML 2.5.1](https://www.omg.org/spec/UML/2.5.1), [PDF normativo](https://www.omg.org/spec/UML/2.5.1/PDF). Consulta: 21/10/2026.

La restricción `upper_ge_lower` y el límite inferior no negativo están descritos en §7.8.8.8 (MultiplicityElement). Esta es la base normativa de los límites R01. La presencia obligatoria de una etiqueta visible no se deriva de esa restricción: será una política del editor cuando corresponda; la omisión puede representar un valor por defecto y no debe clasificarse indiscriminadamente como error.

Para tipos y generalización consultar Classifiers/Generalization (§9), Properties (§9.5) y Associations (§11.5). No se afirma que el módulo certifique toda la especificación. La conectividad de todos los grupos, el uso de clases intermedias N:M y la equivalencia semántica son decisiones de modelado del producto, no obligaciones universales UML.

La composición describe también restricciones sobre instancias. Un ciclo entre tipos de clases no demuestra por sí solo un ciclo de objetos; la composición recursiva requiere contexto. La clasificación de G01-composición queda explícitamente para revisión antes del motor del Sprint 2; no debe presentarse como violación UML universal.

## Convenciones propuestas

- Un solo ámbito de nombres mientras el editor no represente paquetes.
- Para duplicación exacta de producto: recortar espacios externos, normalizar NFD, eliminar diacríticos y convertir a minúsculas. `Cliente`/`cliente` y `Dirección`/`direccion` se agrupan. No se interpretan sinónimos; no se borran guiones o espacios internos. Revisar esta política con el responsable antes del motor real.
- Duplicación de clases/atributos: error de la política de nombres del producto. Atributos iguales en clases diferentes no son duplicación.
- Error, advertencia y recomendación son niveles del producto, no categorías normativas de UML.
- Cada aviso identifica código, versión de catálogo, origen, referencias y contexto analizado. No atribuir confianza calibrada a un número generado por un LLM.

## Reglas programadas · HU-08

| Código | Entrada y condición | Severidad y excepción | Caso aplicable | Caso negativo/esperado válido |
|---|---|---|---|---|
| R01 | Multiplicidad en extremos de asociaciones: formato `n`, `*` o `n..m`, con inferior entero >=0 y superior >=inferior o `*`. | Error si formato/límites inválidos. Herencia sin multiplicidades no produce aviso. Ausencia de etiquetas se evalúa según política de valores por defecto. | `3..1` o `-1..*`. | `0..*`, `1`, `1..5`; herencia sin etiqueta. |
| R02 | Tipo debe ser asociación, agregación, composición o herencia; extremos deben corresponder al modelo soportado. | Error para tipo desconocido. La conveniencia del tipo según dominio pasa a S03; no se infiere semántica de nombres mediante reglas. | `tipo: xyz`. | Asociación conocida con extremos válidos; asociación reflexiva no es error por sí misma. |
| R03 | Origen o destino de una relación no identifica una clase de la captura. | Error por extremo ausente; no inventar figuras ni abortar las demás reglas. | Relación 1→99 y solo existe 1. | Ambos extremos existen. |
| R04 | Dos extremos permiten muchos y no hay clase intermedia reconocida en el contexto disponible. | Recomendación contextual. No afirmar que UML exige tabla o clase intermedia. Si no puede determinarse si existe una intermedia, expresar esa limitación. | Relación muchos a muchos candidata a revisión por requerir atributos de asociación. | Modelo conceptual N:M intencional; caso sin contexto no es error. |
| R05 | Nombre normalizado repetido en clases del ámbito o atributos de la misma clase. | Error de política. Agrupar afectados; no duplicar avisos por cada par. Vacíos requieren regla propia futura; métodos excluidos. | Dos clases `Cliente`/`cliente`; dos atributos `nombre` en Cliente. | `id` en Cliente y Factura; nombres distintos sin equivalencia exacta. |
| R06 | Resultado de regla determinística requiere explicación y recomendación. | Hereda severidad del resultado. Usar plantilla; no necesita LLM. | R03 incluye extremo faltante y orientación para revisar. | No crear un aviso adicional solo por explicar; no consultar IA para completar una plantilla. |

## Grafo · HU-09/HU-10

| Código | Entrada y condición | Severidad y excepción | Caso aplicable | Caso negativo/esperado válido |
|---|---|---|---|---|
| G01 | Grafo dirigido por tipo; DFS identifica ruta de ciclo de herencia o composición. | Herencia: error según catálogo. Composición: advertencia de revisión de la interpretación a nivel de tipos; la severidad final requiere aprobación. No mezclar tipos para inventar ciclos. | A hereda B, B hereda A; composición cíclica se muestra para revisar contexto. | Herencia acíclica; ciclo de asociaciones no genera error G01. |
| G02 | Conectividad sin dirección; clase sin aristas válidas en diagrama con más de una clase. | Advertencia. Diagramas vacíos/de una clase excluidos. | A relacionada con B y C aislada. | Una clase sola, o todas con conexión. |
| G03 | Más de un componente del grafo sin dirección mediante BFS/DFS. | Advertencia; separación puede ser intencional. Evitar repetir aislamiento ya explicado por G02 sin información adicional. | A-B y C-D. | A-B-C-D conectado. |

No se valida navegabilidad dirigida. Una flecha de herencia no se convierte automáticamente en sentido de navegación de objetos.

## Semántica · HU-11/HU-12

| Código | Comportamiento | Límite/resultado | Caso aplicable | Caso negativo/control |
|---|---|---|---|---|
| S01 | Seleccionar candidatos ambiguos con contexto mínimo de clases y dominio. | No escalar reglas con solución determinística; presupuesto y selección operativa por definir antes de integración. | Dos atributos conceptualmente próximos con contexto relevante. | No consultar el diagrama completo en cada movimiento. |
| S02 | Evaluar atributos posiblemente equivalentes. | Recomendación, con fundamento e incertidumbre; nunca fusionar sin decisión. | `domicilio`/`direccion_envio` a revisar. | Aclaración de que son direcciones distintas: conservar ambas. |
| S03 | Evaluar pertinencia de relaciones según dominio. | Recomendación semántica, no error normativo demostrado. | Herencia que parece confundir posesión y especialización. | Contexto insuficiente: expresar incertidumbre, no inventar regla. |
| S04 | Redactar explicación y recomendación del caso semántico. | Describir fundamento y límites; autoevaluación de certeza no es probabilidad calibrada. | Propuesta comprensible con referencias existentes. | No producir una orden ejecutable ni afirmar certeza absoluta. |
| S05 | Validar esquema, tipos, referencias y versión antes de mostrar respuesta. | Respuesta inválida se descarta; estado parcial conserva reglas disponibles. | JSON válido y referencias de la captura vigente. | JSON roto, ID inventado, respuesta de captura anterior: no mostrar como vigente. |

## Límites pendientes de producto

Aprobar política de nombres, R01-presencia, criterios concretos adicionales de R02, detección contextual de intermedia R04 y tratamiento G01-composición antes de implementar motores. Son decisiones visibles, no funcionalidades simuladas como terminadas. El catálogo describe todas las funciones previstas y sus ejemplos; su aprobación final forma parte de la aceptación del sprint.
