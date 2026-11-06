# Referencia para las reglas de base de datos

Calle Terrazas, E. (2024). *Fundamentos y diseño de base de datos: Diseño conceptual, diseño lógico y diseño físico* (1.ª ed.). Santa Cruz, Bolivia.

La unidad 2, secciones 2.3 y 2.3.1 (pp. impresas 16–17, páginas 19–20 del PDF), explica la multiplicidad y las asociaciones. En el ejemplo 3, Cliente–NotaVenta, el 1 se coloca junto a Cliente y el 1..* junto a NotaVenta. Cada cliente se relaciona con una o más notas de venta, y cada nota con exactamente un cliente.

El motor debe conservar esa lectura: el intervalo de un extremo cuenta las instancias de ese extremo para una instancia del otro. Los valores de un intervalo expresan mínimo y máximo; no determinan navegabilidad. Una relación muchos a muchos es válida en el modelo conceptual (ejemplo 5, Alumno–Materia). Su conversión al modelo relacional se evalúa por separado.

La tabla de la p. 16 también muestra intervalos separados por comas. El motor actual solo admite un número fijo, un intervalo simple o un asterisco. Registrar esta diferencia para decidir cómo manejar esa sintaxis sin confundirla con la multiplicidad estándar de UML 2.5.

Usar reglas programadas para comprobaciones verificables y la IA para sugerencias que dependan del contexto. Evaluar las reglas y sugerencias con ejemplos y excepciones.
