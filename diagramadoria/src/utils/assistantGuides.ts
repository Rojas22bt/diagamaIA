// Centralized manual guides for the assistant, based on the platform's UX described by the user.
// Given a free-form question in Spanish, return actionable, step-by-step guidance.

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    // remove common punctuation (including Spanish inverted marks)
    .replace(/[¿?¡!.,;:\-_/\\\[\]{}()"'`~@#$%^&*+=<>|]/g, ' ')
    .replace(/\s+/g, ' ') // collapse whitespace
    .trim();
}

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some(k => text.includes(normalize(k)));
}

// Reusable, topic-specific manuals (kept focused and not mixed)
export function manualCreateProject(): string {
  return [
    'Manual: Crear un proyecto',
    '1) Ve a la página principal donde se listan los proyectos.',
    '2) En la esquina inferior derecha, haz clic en el ícono con el signo "+".',
    '3) Se abrirá un formulario: escribe el título del nuevo proyecto.',
    '4) Haz clic en "Guardar".',
    '5) Verás el proyecto creado en la lista y podrás ingresar a él.'
  ].join('\n');
}

export function manualInvitations(): string {
  return [
    'Manual: Ver invitaciones y notificaciones',
    '1) En el navbar, haz clic en el apartado "Invitaciones".',
    '2) Ahí verás todas las notificaciones recibidas para colaborar en proyectos.',
    '3) Acepta o rechaza según corresponda.'
  ].join('\n');
}

export function manualCreateClass(): string {
  return [
    'Manual: Crear una clase',
    'Opción A (Sidebar izquierda):',
    '1) Dentro del proyecto, ubica el sidebar izquierdo.',
    '2) Haz clic en "Crear nueva clase".',
    '3) Asigna un nombre en PascalCase (p. ej., Cliente) y configura atributos/métodos.',
    '4) Guarda los cambios para verla en el diagrama.',
    '',
    'Opción B (Asistente IA – ícono del robot a la derecha):',
    '1) Haz clic en el icono del robot para abrir el asistente IA.',
    '2) Escribe o graba por audio: por ejemplo "crear clase Cliente con atributos nombre:String, edad:Int".',
    '3) El asistente procesará tu intención y propondrá la acción correspondiente.',
    '4) Confirma/ejecuta para crear la clase.'
  ].join('\n');
}

export function manualCreateRelation(): string {
  return [
    'Manual: Crear una relación',
    '1) Selecciona la clase origen en el diagrama.',
    '2) Usa la herramienta de relaciones y arrastra hacia la clase destino.',
    '3) Elige el tipo (asociación, herencia, agregación o composición).',
    '4) Define las cardinalidades (1..1, 1..*, 0..1, 0..*, *..*).',
    '5) Opcional: agrega etiqueta/verbo a la relación.',
    '6) Guarda los cambios.'
  ].join('\n');
}

export function manualDeleteRelation(): string {
  return [
    'Manual: Eliminar una relación',
    '1) Selecciona la relación en el diagrama (línea entre clases).',
    '2) Usa la opción de eliminar/borrar relación en el panel o con la tecla suprimir.',
    '3) Confirma los cambios si se solicita.'
  ].join('\n');
}

export function manualCollaborators(): string {
  return [
    'Manual: Ver colaboradores del proyecto',
    '1) Dentro del proyecto, en la parte derecha hay un ícono con dos personas.',
    '2) Haz clic para ver los colaboradores del proyecto.'
  ].join('\n');
}

export function manualActivities(): string {
  return [
    'Manual: Ver actividades del diagrama',
    '1) En la parte derecha, haz clic en el ícono de un librito.',
    '2) Se listan todas las actividades realizadas por los usuarios en el diagrama.'
  ].join('\n');
}

export function manualExportImport(): string {
  return [
    'Manual: Exportar/Importar JSON',
    '1) En el sidebar, en la parte inferior, tienes botones para exportar e importar.',
    '2) Exportar: descarga el diagrama en formato JSON.',
    '3) Importar: selecciona un archivo JSON compatible para cargarlo al proyecto.'
  ].join('\n');
}

export function manualGenerateBackend(): string {
  return [
    'Manual: Generar backend (ZIP)',
    '1) En el sidebar, hay un apartado para generar el backend en formato ZIP.',
    '2) Al hacer clic, se abrirá un formulario con opciones de configuración.',
    '3) Ajusta los parámetros según sea necesario y confirma la generación.',
    '4) Descarga el ZIP resultante.'
  ].join('\n');
}

export function manualRecommendations(): string {
  return [
    'Manual: Recomendaciones (sugerencias)',
    '1) En la parte superior del proyecto verás recomendaciones relacionadas al diagrama.',
    '2) Incluyen clases sugeridas y recomendaciones de atributos.',
    '3) Revisa y aplica las sugerencias que te sirvan para mejorar el modelo.'
  ].join('\n');
}

export function manualTables(): string {
  return [
    'Manual: Tablas',
    '1) Puedes apoyarte del asistente IA (ícono del robot) describiendo la tabla que necesitas.',
    '2) Alternativamente, crea clases que representen entidades/tablás y luego genera el backend según tu modelo.'
  ].join('\n');
}

export function buildManualGuide(question: string): string {
  const q = normalize(question || '');

  // Crear proyecto (home, botón +, formulario, guardar)
  if (includesAny(q, ['crear proyecto', 'nuevo proyecto', 'proyecto nuevo', 'agregar proyecto', '+ proyecto'])) {
    return manualCreateProject();
  }

  // Invitaciones / notificaciones de colaborador (navbar invitaciones)
  if (includesAny(q, ['invitacion', 'invitaciones', 'notificacion', 'notificaciones'])) {
    return manualInvitations();
  }

  // Crear clase (sidebar izquierda o asistente IA/robosito)
  if (includesAny(q, [
    'crear clase', 'crear una clase', 'nueva clase', 'agregar clase',
    'crear clases', 'como crear clase', 'como crear una clase', 'como crear clases'
  ])) {
    return manualCreateClass();
  }

  // Crear relación (menciona también que el asistente IA puede ayudar)
  if (includesAny(q, [
    'crear relacion', 'nueva relacion', 'agregar relacion', 'relacionar clases', 'crear relaciones'
  ])) {
    return manualCreateRelation();
  }

  if (includesAny(q, ['eliminar relacion', 'borrar relacion', 'quitar relacion'])) {
    return manualDeleteRelation();
  }

  // Colaboradores (icono dos personas, derecha)
  if (includesAny(q, ['colaborador', 'colaboradores', 'ver colaboradores', 'equipo'])) {
    return manualCollaborators();
  }

  // Actividades (icono librito, derecha)
  if (includesAny(q, ['actividad', 'actividades', 'historial', 'bitacora'])) {
    return manualActivities();
  }

  // Exportar/Importar JSON (sidebar abajo)
  if (includesAny(q, ['exportar json', 'exportar diagrama', 'importar json', 'importar diagrama'])) {
    return manualExportImport();
  }

  // Generar backend ZIP (abre formulario de configuración)
  if (includesAny(q, ['generar backend', 'crear backend', 'backend zip', 'descargar backend', 'codigo backend'])) {
    return manualGenerateBackend();
  }

  // Recomendaciones (parte superior: clases sugeridas y atributos)
  if (includesAny(q, ['recomendacion', 'recomendaciones', 'clases sugeridas', 'atributos sugeridos'])) {
    return manualRecommendations();
  }

  // Tablas (mencionadas en la descripción del usuario junto a relaciones)
  if (includesAny(q, ['tabla', 'tablas'])) {
    return manualTables();
  }

  // Fallback general para diagrama UML y uso de IA
  return [
    'No detecté un tema específico. Dime exactamente qué necesitas y te doy sólo esos pasos.',
    'Ejemplos: "crear una clase", "crear relación", "ver invitaciones", "generar backend".'
  ].join('\n');
}

// Given an AI JSON (intent), return the most precise manual. Fallback to keyword inference.
export function buildManualGuideForAiAction(aiJson: any, question: string): string {
  if (!aiJson || typeof aiJson !== 'object') return buildManualGuide(question);
  switch (aiJson.type) {
    case 'create_class':
      return manualCreateClass();
    case 'create_relation':
      return manualCreateRelation();
    case 'delete_relation':
      return manualDeleteRelation();
    default:
      return buildManualGuide(question);
  }
}

export default buildManualGuide;
