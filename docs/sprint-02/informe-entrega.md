# Sprint 2 · Validación real, OpenAI y colaboración

Implementación realizada el 02/11/2026. Este documento registra comprobaciones técnicas, no una aceptación funcional firmada ni las fechas de un sprint ya celebrado.

## Resultado por historia

| Historia | Implementación | Comprobación |
|---|---|---|
| HU-08 | Multiplicidades, tipos soportados, extremos ausentes, N:M contextual y nombres duplicados. Explicaciones mediante plantillas, sin IA. | Casos válidos, inválidos, excepciones y agrupación de duplicados. |
| HU-09 | DFS iterativo por tipo, ruta completa del ciclo y referencias a sus clases/relaciones. | Ciclo de herencia, composición, autorrelación y separación entre tipos. |
| HU-10 | Componentes mediante BFS sin dirección. Aislamiento y desconexión como advertencias. | Diagramas vacíos, de una clase, grupos separados y conectividad inversa. |
| HU-11 | OpenAI Responses desde el servidor, respuesta estructurada y validación de referencias. | Transporte simulado: esquema estricto, rechazo, respuesta incompleta y referencias inexistentes. Consulta real con clase ficticia: PASS, una sugerencia válida. |
| HU-12 | Pausa configurable, identidad por contenido, caché en memoria y resultados completos persistidos; cancelación y descarte de respuestas antiguas. | Solicitudes concurrentes comparten análisis, mover figuras no repite consulta, fallo conserva reglas. |
| HU-13 | Evento `validation-result`, recuperación al entrar/reconectar y permisos comprobados antes de enviar resultados. | Tres clientes reales, igualdad de capturas, reconexión, proyectos separados, acceso revocado y bloqueo de escritura para vista. |

## Configuración y uso

Se requiere Node.js 22 o posterior. El servidor carga `backendia/.env`; las variables ya configuradas en el entorno tienen precedencia. Usar `backendia/.env.example` como referencia, conservando la conexión y el secreto existentes:

```dotenv
OPENAI_API_KEY=tu_clave
OPENAI_MODEL=gpt-4.1-mini
VALIDATION_DEBOUNCE_MS=500
```

La clave de este módulo permanece en el backend. No se utiliza una variable `VITE_` para validar diagramas. No se guardan ni imprimen credenciales. La integración utiliza `fetch` nativo, sin añadir dependencias de producción.

Desde `backendia`, ejecutar `npm run build` y `npm start`, o `npm run dev`. La base debe tener las migraciones existentes del sprint 1; se verificaron en una base desechable, sin aplicar cambios a la base real del usuario. No fue necesaria una migración nueva para el sprint 2.

Desde `diagramadoria`, ejecutar `npm run dev`. En el editor, abrir **Avisos UML**. Los resultados corresponden al último diagrama guardado. Las modificaciones se guardan por el flujo de colaboración existente; el botón **Guardar Proyecto** también permite guardar. Un usuario de solo lectura consulta resultados sin poder modificar el proyecto.

## Flujo y organización

- `backendia/src/validation/diagram.ts`: entrada validada y representación de contenido sin posiciones, tamaños ni métodos.
- `rules.ts` y `graph.ts`: funciones puras para reglas y recorridos iterativos.
- `semantic.ts`: selección acotada de candidatos, instrucciones fijas con cuatro ejemplos, Responses API, tiempo límite y verificación de salida.
- `coordinator.ts`: coordinación por proyecto, cancelación, caché y estados parciales.
- `service.ts`: persistencia con Prisma y publicación a usuarios autorizados.
- `GET /api/projects/:id/validation`: consulta autenticada sobre el diagrama almacenado; nunca acepta otro diagrama desde el navegador.
- `useLiveValidation.ts`: consulta inicial, eventos y recuperación HTTP cuando falta un resultado vigente. No presenta ni resalta resultados de otra captura.

Cada aviso conserva proyecto, captura, versión de reglas, origen, explicación y referencias. La configuración de caché incluye el modelo y la versión de instrucciones. No se crea otra copia persistida del diagrama.

Los avisos se guardan por lotes; las comprobaciones de grafos son iterativas para evitar desbordamientos por recursión. Los resultados completos se reutilizan después de reiniciar el backend. Los resultados parciales pueden volver a intentarse después de un minuto al consultar de nuevo.

Se corrigieron dos puntos del flujo existente necesarios para esta integración: los mensajes de cambios parciales ya no reemplazan el diagrama completo guardado, y las escrituras HTTP/Socket.IO rechazan usuarios de solo lectura. Las relaciones nuevas conservan su identificador entre el lienzo, el modelo y el mensaje compartido. El guardado admite eliminar la última clase.

## Políticas aplicadas y límites

- Nombres: espacios externos recortados, comparación sin mayúsculas ni acentos; no se interpretan sinónimos. Atributos repetidos se comparan dentro de su clase.
- Multiplicidad omitida: valor predeterminado uno. La herencia no exige etiquetas de multiplicidad.
- N:M: recomendación contextual. El editor no representa explícitamente clases de asociación; no se afirma que una intermedia esté ausente ni que UML la exija.
- Ciclo de herencia: error. Composición entre tipos: advertencia para revisar contexto, no prueba de un ciclo entre objetos.
- Conectividad: sin dirección; no se valida navegabilidad. Vacío y clase única no producen advertencias de desconexión.
- Selección semántica: clases con dos o más atributos distintos, relaciones de herencia/agregación/composición y asociaciones con verbo. Máximo 20 clases candidatas iniciales, 20 relaciones, 20 atributos por clase y aproximadamente 24 000 caracteres de clases, más relaciones. Cuando se recorta contexto se informa análisis parcial. No se promete revisar todo el significado del dominio.
- Máximo 12 sugerencias por respuesta, cuatro solicitudes semánticas simultáneas por proceso y dos intentos ante 429/5xx. Cada intento tiene un límite de 12 segundos. Un fallo conserva reglas y grafos.
- Límite del motor: 500 clases, 2000 relaciones, 100 atributos por clase y 200 caracteres por campo. Los límites de transporte existentes también aplican. Diagramas antiguos en formato de figuras deben guardarse desde el editor como modelo estructurado antes de revisarse.
- La certeza declarada por OpenAI no es una probabilidad medida. Las sugerencias nunca ejecutan instrucciones ni cambios.
- Caché y coordinación para una instancia del backend: 100 proyectos en memoria. Un despliegue con varias réplicas necesita coordinación y distribución de eventos compartidas; no se incluye en este incremento.
- La política de nombres y la severidad de composición quedan visibles para revisión funcional. Se implementó la propuesta conservadora del catálogo del sprint 1.

Aceptar/rechazar recomendaciones, consultar historial de decisiones y aplicar correcciones siguen fuera de este sprint. La precisión semántica no se acredita con una consulta de conectividad: su evaluación con casos etiquetados corresponde al sprint 3.

## Verificación

1. Backend: `npm run build` y `npm test` con `VALIDATION_TEST_DATABASE_URL` apuntando a PostgreSQL local y nombre `sprint01_*`. La suite usa puertos 55492/55493 y bloquea bases fuera de ese ámbito. Los casos de base de datos se ejecutan en serie para no compartir permisos temporales simultáneamente.
2. Sin base de datos: `npm run test:validation:unit`.
3. Integración real de OpenAI: `npm run check:openai`. Usa exclusivamente una clase ficticia, realiza una consulta facturable y valida las referencias de la respuesta.
4. Frontend: `npm run build`, `npm run lint:validation` y `npm run test:validation`.
5. Interfaz: `npm run test:validation:ui`, con Playwright disponible en el entorno o indicado mediante `PLAYWRIGHT_MODULE`. Inicia Vite en el puerto 5174 y Chrome sin ventana; `VALIDATION_UI_URL` permite usar un servidor ya iniciado.

Resultado técnico: 17 pruebas backend, cuatro contratos frontend y prueba de los seis estados de interfaz para creador/editor/vista. La interfaz usa React/JointJS reales y respuestas HTTP controladas creadas con los motores reales; la colaboración se prueba aparte con PostgreSQL y Socket.IO reales. Capturas en `evidence/`.

Medición local orientativa de reglas y grafos: alrededor de 5–9 ms para 500 clases y 2000 relaciones, sin incluir base de datos, red ni OpenAI. No es una medición de latencia de producción. La compilación frontend conserva el aviso previo de tamaño del paquete principal.

Referencias de integración consultadas: [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses) y [GPT-4.1 mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini).
