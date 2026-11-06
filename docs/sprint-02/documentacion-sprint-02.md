# Sprint 2

## Objetivo del sprint

Integrar la revisión de diagramas de clases UML con el panel de avisos, para que los usuarios puedan identificar problemas de estructura y conexión, consultar sugerencias de OpenAI cuando sea necesario interpretar el significado del modelo y ver los mismos avisos que sus compañeros mientras trabajan en el proyecto.

## Historias de usuario

### HU-08

**Nombre de la historia de usuario:** Detectar problemas de estructura.

**Como:** Usuario que diseña un diagrama de clases.

**Quiero:** Que el sistema revise los nombres, las relaciones y las cantidades permitidas en cada extremo de una relación.

**Para:** Encontrar inconsistencias sin revisar todo el diagrama a mano.

**Criterios de aceptación:**

- Si una cantidad es inválida, como `3..1`, el panel indica qué relación debe revisarse.
- Se genera un aviso si el tipo de relación no es reconocido o si uno de sus extremos hace referencia a una clase que no existe.
- Se señalan los nombres repetidos entre clases o entre atributos de una misma clase. Usar el mismo nombre de atributo en clases distintas no genera ese aviso.
- Cada aviso explica qué se encontró y qué puede revisar el usuario.

**Conversación o reglas:**

- Los nombres se comparan sin distinguir mayúsculas ni acentos.
- La cantidad junto a una clase indica cuántas instancias de esa clase pueden relacionarse con una instancia de la clase del otro extremo.
- Una relación de muchos a muchos puede ser válida. La sugerencia de revisar si hace falta una clase intermedia depende del contexto.
- Estas comprobaciones funcionan sin consultar a OpenAI.

### HU-09

**Nombre de la historia de usuario:** Detectar ciclos de herencia y composición.

**Como:** Usuario que diseña un diagrama de clases.

**Quiero:** Saber si una cadena de herencia o composición vuelve a la clase donde empezó.

**Para:** Encontrar la ruta circular y decidir qué relación revisar.

**Criterios de aceptación:**

- Si una cadena de herencia vuelve a la clase inicial, el panel muestra un error con la ruta completa.
- Si una cadena de composición vuelve a la clase inicial, se muestra una advertencia para revisar el contexto.
- El aviso permite localizar las clases y relaciones de la ruta en el diagrama.
- Una cadena sin ciclos no genera este aviso.

**Conversación o reglas:**

- La herencia y la composición se revisan por separado. Una cadena que mezcla tipos de relación no se trata como un ciclo de uno de esos tipos.
- Un ciclo de composición entre clases requiere revisión, porque por sí solo no demuestra un ciclo entre objetos.

### HU-10

**Nombre de la historia de usuario:** Detectar clases aisladas y grupos desconectados.

**Como:** Usuario que diseña un diagrama de clases.

**Quiero:** Saber qué clases o grupos no tienen ninguna conexión con el resto del diagrama.

**Para:** Comprobar si la separación es intencional o si me faltó dibujar una relación.

**Criterios de aceptación:**

- Si una clase queda separada de las demás, el panel muestra una advertencia que permite localizarla.
- Si varias clases se conectan entre sí pero están separadas del resto, el panel identifica las clases del grupo.
- Un diagrama vacío o con una sola clase no genera avisos de desconexión.
- Si todas las clases están conectadas, no se genera un aviso de desconexión.

**Conversación o reglas:**

- Para comprobar la conexión se consideran las relaciones sin importar el sentido de las flechas. Esta historia no comprueba si se puede navegar de una clase a otra.
- Una separación puede ser intencional; por eso se muestra como advertencia.

### HU-11

**Nombre de la historia de usuario:** Revisar posibles ambigüedades en el diagrama.

**Como:** Usuario que diseña un diagrama de clases.

**Quiero:** Recibir sugerencias sobre atributos que podrían representar lo mismo o relaciones cuyo significado podría ser confuso.

**Para:** Revisar si el diagrama refleja correctamente las reglas de mi proyecto.

**Criterios de aceptación:**

- Cuando hay un caso que requiere interpretar el significado, el sistema envía a OpenAI la información necesaria para revisarlo.
- Cada sugerencia explica qué conviene comprobar e identifica las partes del diagrama involucradas.
- Se descartan las respuestas inválidas o que mencionen elementos que no existen en la revisión.
- Las sugerencias se muestran como recomendaciones y no modifican el diagrama.

**Conversación o reglas:**

- Dos atributos del mismo tipo pueden cumplir funciones distintas. Compartir el tipo no basta para afirmar que son equivalentes.
- La IA señala dudas. Si falta una regla del negocio, el usuario decide si la sugerencia aplica a su proyecto.
- Las inconsistencias que se pueden comprobar con reglas claras se revisan sin IA.

### HU-12

**Nombre de la historia de usuario:** Actualizar los avisos cuando cambia el diagrama.

**Como:** Colaborador de un proyecto.

**Quiero:** Que los avisos se actualicen después de guardar cambios en el contenido del diagrama.

**Para:** Consultar resultados vigentes sin interrumpir la edición ni repetir consultas innecesarias.

**Criterios de aceptación:**

- Después de guardar un cambio relevante, el panel muestra los avisos de la versión guardada.
- Mover una figura sin cambiar el contenido no provoca otra consulta a OpenAI.
- Si ya existe una revisión completa para el mismo contenido y las mismas reglas, se reutiliza.
- Si llega una respuesta de una versión anterior, no se presenta como resultado vigente.
- Si OpenAI falla, se conservan los avisos de las reglas y las conexiones, y el panel indica que la revisión fue parcial.

**Conversación o reglas:**

- Se deja una pausa breve para evitar consultas repetidas cuando hay varios cambios seguidos.
- La clave de OpenAI se usa únicamente desde el servidor.

### HU-13

**Nombre de la historia de usuario:** Compartir avisos entre los colaboradores del proyecto.

**Como:** Usuario con acceso a un proyecto compartido.

**Quiero:** Ver los mismos avisos que mis compañeros mientras trabajamos en el diagrama.

**Para:** Coordinar la revisión usando los resultados de la misma versión guardada.

**Criterios de aceptación:**

- Los usuarios conectados al mismo proyecto reciben los resultados de la misma versión del diagrama.
- Si un usuario vuelve a conectarse, puede recuperar la revisión vigente.
- Los avisos de un proyecto no se entregan a usuarios de otros proyectos sin permiso para consultarlo.
- Los usuarios con acceso de solo lectura pueden consultar los avisos sin obtener permiso para editar el diagrama.

**Conversación o reglas:**

- Los resultados se comparten después de guardar y revisar los cambios.
- Aceptar o rechazar recomendaciones, consultar el historial de decisiones y aplicar correcciones quedan para el sprint 3.

## Sprint Backlog

**Sprint número:** 2  
**Tiempo programado:** 13 días calendario, contando la fecha de inicio y la de fin.  
**Fecha de inicio:** 26/10/2026  
**Fecha fin:** 07/11/2026  

Las horas son estimaciones propuestas. El estado «Implementado» indica que la tarea está disponible en el código y queda sujeta a la revisión del sprint.

| ID | Tareas | Estimación (horas) | Responsable | Estado |
|---|---|---:|---|---|
| HU-08-T01 | Revisar las cantidades permitidas y detectar relaciones con tipos desconocidos o clases ausentes. | 6 | Por asignar | Implementado |
| HU-08-T02 | Detectar nombres repetidos y redactar avisos que indiquen qué revisar. | 5 | Por asignar | Implementado |
| HU-09-T01 | Detectar cadenas circulares de herencia y composición por separado. | 6 | Por asignar | Implementado |
| HU-09-T02 | Mostrar la ruta completa y señalar las clases y relaciones involucradas. | 4 | Por asignar | Implementado |
| HU-10-T01 | Detectar clases aisladas y grupos desconectados sin depender del sentido de las flechas. | 5 | Por asignar | Implementado |
| HU-10-T02 | Mostrar advertencias y aplicar la excepción para diagramas vacíos o con una sola clase. | 3 | Por asignar | Implementado |
| HU-11-T01 | Seleccionar los casos que necesitan interpretación y preparar la información para OpenAI. | 6 | Por asignar | Implementado |
| HU-11-T02 | Integrar la consulta desde el servidor y comprobar que las sugerencias hagan referencia a elementos existentes. | 8 | Por asignar | Implementado |
| HU-12-T01 | Actualizar los avisos después de guardar cambios y reutilizar revisiones completas del mismo contenido. | 7 | Por asignar | Implementado |
| HU-12-T02 | Descartar respuestas antiguas y conservar los resultados disponibles si OpenAI falla. | 5 | Por asignar | Implementado |
| HU-13-T01 | Compartir los resultados de la misma versión entre los usuarios autorizados del proyecto. | 6 | Por asignar | Implementado |
| HU-13-T02 | Recuperar los avisos al volver a conectarse y respetar los permisos de solo lectura. | 5 | Por asignar | Implementado |
| **Total** | | **66** | | |

## Daily Scrum

**Periodo:** 26/10/2026 al 07/11/2026. Borrador para validar con el equipo: los comentarios son ejemplos de seguimiento basados en el backlog y en las comprobaciones del sprint. Los nombres identifican posibles intervenciones; no confirman asistencia ni asignan responsables.

| Día | ¿Qué hicimos para lograr el objetivo del sprint? | ¿Qué haremos para mejorar? | ¿Impedimento? |
|---|---|---|---|
| **26/10** | | | |
| Rojas | Revisamos qué partes del panel del sprint 1 podemos reutilizar. | Definiremos qué avisos pueden salir de reglas y cuáles necesitan interpretación. | — |
| Sandoval | Revisamos el alcance de las seis historias. | Acordaremos el orden de trabajo según sus dependencias. | — |
| **27/10** | | | |
| Arias | Preparamos ejemplos de nombres repetidos y relaciones con cantidades inválidas. | Añadiremos ejemplos correctos para comparar. | — |
| Villegas | Revisamos qué debe mostrar el panel cuando encuentra un problema. | Redactaremos avisos que expliquen qué parte del diagrama revisar. | — |
| **28/10** | | | |
| Rojas | Revisamos ejemplos de cadenas circulares de herencia y composición. | Prepararemos casos separados para cada tipo de relación. | — |
| Aldana | Revisamos cómo señalar las relaciones involucradas en un aviso. | Comprobaremos que el resaltado desaparezca al cambiar de aviso. | — |
| **29/10** | | | |
| Arias | Preparamos diagramas con clases aisladas y grupos separados. | Añadiremos un caso donde todas las clases estén conectadas aunque las flechas apunten en distintos sentidos. | — |
| Sandoval | Revisamos qué debe ocurrir con un diagrama vacío o de una sola clase. | Incorporaremos esas excepciones a los ejemplos. | — |
| **30/10** | | | |
| Villegas | Seleccionamos ejemplos de atributos y relaciones que requieren interpretar su significado. | Distinguiremos las sugerencias de la IA de los avisos de las reglas. | — |
| Rojas | Revisamos qué información es necesaria para consultar a OpenAI. | Enviaremos solo las clases y relaciones pertinentes para cada revisión. | — |
| **31/10** | | | |
| Aldana | Revisamos cuándo se actualiza el panel después de guardar. | Evitaremos que mover una figura vuelva a consultar a OpenAI. | — |
| Arias | Preparamos un ejemplo donde llega una respuesta después de que el diagrama ya cambió. | Comprobaremos que el panel no muestre esa respuesta como vigente. | — |
| **01/11** | | | |
| Sandoval | Revisamos los permisos de los colaboradores y de los usuarios de solo lectura. | Comprobaremos el acceso desde distintos proyectos y al volver a conectarse. | — |
| Villegas | Preparamos un mensaje para cuando la IA no termine su revisión. | Mantendremos visibles los avisos que sí pudieron obtenerse. | — |
| **02/11** | | | |
| Rojas | Integramos la revisión del diagrama guardado con el panel de avisos. | Revisaremos que el resultado corresponda al diagrama visible. | — |
| Arias | Comprobamos casos de estructura, ciclos y desconexiones. | Conservaremos los ejemplos para volver a probarlos cuando cambien las reglas. | — |
| Sandoval | Comprobamos el intercambio de avisos con tres usuarios y la recuperación tras reconectar. | Registraremos la evidencia de cada caso. | — |
| **03/11** | | | |
| Aldana | Revisamos la consulta de avisos desde los tres roles. | Comprobaremos que consultar y resaltar no cambie el diagrama. | — |
| Villegas | Revisamos cómo se muestran las sugerencias de OpenAI. | Ajustaremos los mensajes para que quede claro cuándo la revisión es parcial. | — |
| **04/11** | | | |
| Arias | Revisamos cuándo se puede reutilizar un resultado guardado. | Comprobaremos que se haga una revisión nueva si cambia el contenido. | — |
| Sandoval | Organizamos las comprobaciones por historia de usuario. | Separaremos las comprobaciones realizadas de las pendientes para el sprint 3. | — |
| **05/11** | | | |
| Rojas | Identificamos que faltaban tablas de validación en la base local y aplicamos la migración pendiente. | Dejaremos registrada la preparación necesaria para ejecutar el módulo. | Resuelto: faltaban tablas de validación. |
| Aldana | Ajustamos el panel para que deje de repetir la consulta si el servidor devuelve un error. | Mostraremos un mensaje que indique qué revisar antes de volver a intentar. | Resuelto: se repetían las consultas fallidas. |
| Villegas | Revisamos la lectura de multiplicidades con el ejemplo de Categoría y Producto. | Registraremos qué interpreta el motor y qué depende de la regla del negocio. | — |
| **06/11** | | | |
| Rojas | Consolidamos el objetivo, las historias y las tareas del sprint. | Prepararemos los ejemplos que se podrán mostrar en la revisión. | — |
| Sandoval | Separamos los ajustes adicionales de validación y las pruebas pendientes. | Los registraremos como trabajo del sprint 3. | — |
| **07/11** | | | |
| Equipo (previsto) | Pendiente de registrar lo realizado ese día. | Preparar la revisión del resultado y anotar los comentarios que orienten el sprint 3. | Por registrar. |
