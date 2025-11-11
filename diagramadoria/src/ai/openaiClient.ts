// Tipos para diagrama UML (importados de ConnectedDiagramPage)
export type UMLAttribute = { name: string; type: string };
export type UMLMethod = { name: string; returns: string };
export type UMLClassNode = {
  id: string;
  displayId: number;
  name: string;
  position: { x: number; y: number };
  size?: { width: number; height: number };
  attributes: UMLAttribute[];
  methods: UMLMethod[];
};
export type UMLRelationType = 'asociacion' | 'herencia' | 'agregacion' | 'composicion';
export type UMLRelation = {
  id: string;
  fromDisplayId: number;
  toDisplayId: number;
  type: UMLRelationType;
  originCard?: string;
  destCard?: string;
  verb?: string;
};
export type DiagramModel = {
  version: 1;
  nextDisplayId: number;
  classes: UMLClassNode[];
  relations: UMLRelation[];
};
// Aplica una acción sugerida al modelo de diagrama UML
export function applyActionToDiagram(action: ActionSuggestion, diagram: DiagramModel): DiagramModel {
  let updated = { ...diagram, classes: [...diagram.classes], relations: [...diagram.relations] };

  const findClassByRef = (ref: { targetNumber?: number; targetName?: string } | undefined): UMLClassNode | undefined => {
    if (!ref) return undefined;
    if (typeof ref.targetNumber === 'number') {
      return updated.classes.find(c => c.displayId === ref.targetNumber);
    }
    if (ref.targetName) {
      const name = ref.targetName.toLowerCase();
      return updated.classes.find(c => c.name.toLowerCase() === name);
    }
    return undefined;
  };

  const resolveDisplayIdByName = (name?: string): number | undefined => {
    if (!name) return undefined;
    const cls = updated.classes.find(c => c.name.toLowerCase() === name.toLowerCase());
    return cls?.displayId;
  };

  switch (action.type) {
    case 'create_class': {
      // Evitar duplicados por nombre (case-insensitive)
      const exists = updated.classes.some(c => c.name.toLowerCase() === action.name.toLowerCase());
      if (!exists) {
        const newId = 'c-' + (updated.nextDisplayId || updated.classes.length + 1);
        updated.classes.push({
          id: newId,
          displayId: updated.nextDisplayId || updated.classes.length + 1,
          name: action.name,
          position: { x: 100, y: 100 + 60 * updated.classes.length },
          attributes: (action.attributes || []).map(a => ({
            name: a.name,
            type: a.type
          })),
          methods: (action.methods || []).map(m => ({
            name: m.name,
            returns: m.returns
          }))
        });
        updated.nextDisplayId = (updated.nextDisplayId || updated.classes.length + 1) + 1;
      }
      break;
    }
    case 'create_relation': {
      // Resolver extremos por número o nombre
      const originId = action.originNumber ?? resolveDisplayIdByName(action.originName);
      const destId = action.destNumber ?? resolveDisplayIdByName(action.destName);
      const from = updated.classes.find(c => c.displayId === (originId as number));
      const to = updated.classes.find(c => c.displayId === (destId as number));
      if (from && to && typeof originId === 'number' && typeof destId === 'number') {
        // Evitar duplicados
        const exists = updated.relations.some(r =>
          r.fromDisplayId === originId &&
          r.toDisplayId === destId &&
          r.type === action.relationType
        );
        if (!exists) {
          updated.relations.push({
            id: 'r-' + (updated.relations.length + 1),
            fromDisplayId: originId,
            toDisplayId: destId,
            type: action.relationType || 'asociacion',
            originCard: action.originCard,
            destCard: action.destCard,
            verb: action.verb
          });
        }
      }
      break;
    }
    case 'update_relation': {
      const originId = action.originNumber ?? resolveDisplayIdByName(action.originName);
      const destId = action.destNumber ?? resolveDisplayIdByName(action.destName);
      if (typeof originId === 'number' && typeof destId === 'number') {
        updated.relations = updated.relations.map(r => {
          if (r.fromDisplayId === originId && r.toDisplayId === destId) {
            return {
              ...r,
              type: action.relationType ?? r.type,
              originCard: action.originCard ?? r.originCard,
              destCard: action.destCard ?? r.destCard,
              verb: action.verb ?? r.verb,
            };
          }
          return r;
        });
      }
      break;
    }
    case 'delete_relation': {
      const originId = action.originNumber ?? resolveDisplayIdByName((action as any).originName);
      const destId = action.destNumber ?? resolveDisplayIdByName((action as any).destName);
      updated.relations = updated.relations.filter(r => !(r.fromDisplayId === originId && r.toDisplayId === destId));
      break;
    }
    case 'delete_class': {
      const cls = findClassByRef({ targetNumber: action.targetNumber, targetName: action.targetName });
      if (cls) {
        updated.classes = updated.classes.filter(c => c.displayId !== cls.displayId);
        updated.relations = updated.relations.filter(r => r.fromDisplayId !== cls.displayId && r.toDisplayId !== cls.displayId);
      }
      break;
    }
    case 'rename_class': {
      const cls = findClassByRef({ targetNumber: action.targetNumber, targetName: action.targetName });
      if (cls) {
        cls.name = action.newName;
      }
      break;
    }
    case 'move_class': {
      const cls = findClassByRef({ targetNumber: action.targetNumber, targetName: action.targetName });
      if (cls) {
        cls.position = { x: action.x, y: action.y };
      }
      break;
    }
    case 'add_attribute': {
      const cls = findClassByRef({ targetNumber: action.targetNumber, targetName: action.targetName });
      if (cls) {
        const exists = cls.attributes.some(a => a.name.toLowerCase() === action.attribute.name.toLowerCase());
        if (!exists) cls.attributes = [...cls.attributes, { name: action.attribute.name, type: normalizeAttrType(action.attribute.type, action.attribute.name) }];
      }
      break;
    }
    case 'update_attribute': {
      const cls = findClassByRef({ targetNumber: action.targetNumber, targetName: action.targetName });
      if (cls) {
        cls.attributes = cls.attributes.map(a => {
          if (a.name.toLowerCase() === action.fromName.toLowerCase()) {
            return {
              name: action.toName ? action.toName : a.name,
              type: action.dataType ? normalizeAttrType(action.dataType, action.toName || a.name) : a.type,
            };
          }
          return a;
        });
      }
      break;
    }
    case 'delete_attribute': {
      const cls = findClassByRef({ targetNumber: action.targetNumber, targetName: action.targetName });
      if (cls) {
        cls.attributes = cls.attributes.filter(a => a.name.toLowerCase() !== action.name.toLowerCase());
      }
      break;
    }
    case 'add_method': {
      const cls = findClassByRef({ targetNumber: action.targetNumber, targetName: action.targetName });
      if (cls) {
        const exists = cls.methods.some(m => m.name.toLowerCase() === action.method.name.toLowerCase());
        if (!exists) cls.methods = [...cls.methods, { name: action.method.name, returns: action.method.returns }];
      }
      break;
    }
    case 'update_method': {
      const cls = findClassByRef({ targetNumber: action.targetNumber, targetName: action.targetName });
      if (cls) {
        cls.methods = cls.methods.map(m => {
          if (m.name.toLowerCase() === action.fromName.toLowerCase()) {
            return { name: action.toName ? action.toName : m.name, returns: action.returns ? action.returns : m.returns };
          }
          return m;
        });
      }
      break;
    }
    case 'delete_method': {
      const cls = findClassByRef({ targetNumber: action.targetNumber, targetName: action.targetName });
      if (cls) {
        cls.methods = cls.methods.filter(m => m.name.toLowerCase() !== action.name.toLowerCase());
      }
      break;
    }
    // Puedes añadir más casos: eliminar clase, actualizar atributos, etc.
    default:
      break;
  }
  return updated;
}

// Aplica una lista de acciones devolviendo cambios y errores
export function applyActionsToDiagram(actions: ActionSuggestion[], diagram: DiagramModel): { diagram: DiagramModel; changes: string[]; errors: string[] } {
  let d = { ...diagram, classes: [...diagram.classes], relations: [...diagram.relations] };
  const changes: string[] = [];
  const errors: string[] = [];
  actions.forEach(a => {
    const before = JSON.stringify(d);
    const next = applyActionToDiagram(a, d);
    const after = JSON.stringify(next);
    if (before !== after) {
      changes.push(describeAction(a));
      d = next;
    } else {
      errors.push(`Sin cambios para acción: ${describeAction(a)}`);
    }
  });
  return { diagram: d, changes, errors };
}

function describeAction(a: ActionSuggestion): string {
  switch (a.type) {
    case 'create_class': return `Crear clase ${a.name}`;
    case 'delete_class': return `Eliminar clase ${a.targetName ?? a.targetNumber}`;
    case 'rename_class': return `Renombrar clase ${a.targetName ?? a.targetNumber} a ${a.newName}`;
    case 'move_class': return `Mover clase ${a.targetName ?? a.targetNumber} a (${a.x}, ${a.y})`;
    case 'add_attribute': return `Agregar atributo ${a.attribute.name} a ${a.targetName ?? a.targetNumber}`;
    case 'update_attribute': return `Actualizar atributo ${a.fromName} en ${a.targetName ?? a.targetNumber}`;
    case 'delete_attribute': return `Eliminar atributo ${a.name} de ${a.targetName ?? a.targetNumber}`;
    case 'add_method': return `Agregar método ${a.method.name} a ${a.targetName ?? a.targetNumber}`;
    case 'update_method': return `Actualizar método ${a.fromName} en ${a.targetName ?? a.targetNumber}`;
    case 'delete_method': return `Eliminar método ${a.name} de ${a.targetName ?? a.targetNumber}`;
    case 'create_relation': return `Crear relación ${a.relationType ?? 'asociacion'} entre ${a.originName ?? a.originNumber} -> ${a.destName ?? a.destNumber}`;
    case 'update_relation': return `Actualizar relación entre ${a.originName ?? a.originNumber} -> ${a.destName ?? a.destNumber}`;
    case 'delete_relation': return `Eliminar relación entre ${a.originName ?? a.originNumber} -> ${a.destName ?? a.destNumber}`;
    default: return 'Acción no-op';
  }
}
// Minimal OpenAI client wrapper using fetch and Vite env
// IMPORTANT: This calls OpenAI from the browser; only do this if you trust the environment.
// For production, proxy via your backend to keep the API key server-side.

export type ActionSuggestion =
  // Clases
  | { type: 'create_class'; name: string; attributes?: Array<{ name: string; type: string }>; methods?: Array<{ name: string; returns: string }> }
  | { type: 'delete_class'; targetNumber?: number; targetName?: string }
  | { type: 'rename_class'; targetNumber?: number; targetName?: string; newName: string }
  | { type: 'move_class'; targetNumber?: number; targetName?: string; x: number; y: number }
  // Atributos
  | { type: 'add_attribute'; targetNumber?: number; targetName?: string; attribute: { name: string; type: string } }
  | { type: 'update_attribute'; targetNumber?: number; targetName?: string; fromName: string; toName?: string; dataType?: string }
  | { type: 'delete_attribute'; targetNumber?: number; targetName?: string; name: string }
  // Métodos
  | { type: 'add_method'; targetNumber?: number; targetName?: string; method: { name: string; returns: string } }
  | { type: 'update_method'; targetNumber?: number; targetName?: string; fromName: string; toName?: string; returns?: string }
  | { type: 'delete_method'; targetNumber?: number; targetName?: string; name: string }
  // Relaciones
  | { type: 'create_relation'; originNumber?: number; destNumber?: number; originName?: string; destName?: string; relationType?: 'asociacion' | 'herencia' | 'agregacion' | 'composicion'; originCard?: string; destCard?: string; verb?: string }
  | { type: 'update_relation'; originNumber?: number; destNumber?: number; originName?: string; destName?: string; relationType?: 'asociacion' | 'herencia' | 'agregacion' | 'composicion'; originCard?: string; destCard?: string; verb?: string }
  | { type: 'delete_relation'; originNumber?: number; destNumber?: number; originName?: string; destName?: string }
  // No-op
  | { type: 'noop' }

export type AttributeSuggestion = {
  displayId: number;
  className: string;
  attributes: Array<{ name: string; type: string; reason?: string }>;
};

export type ClassSuggestion = {
  name: string;
  attributes?: Array<{ name: string; type: string; reason?: string }>;
  reason?: string;
};

export type RelationSuggestion = {
  originName: string;
  destName: string;
  relationType?: 'asociacion' | 'herencia' | 'agregacion' | 'composicion';
  originCard?: string; // default to 1..1 for asociacion if missing
  destCard?: string;   // default to 1..1 for asociacion if missing
  verb?: string;
  reason?: string;
};

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY as string | undefined;

if (!OPENAI_API_KEY) {
  // eslint-disable-next-line no-console
  console.warn('VITE_OPENAI_API_KEY is not set. AI features will be disabled.');
}

// --- Robust JSON extraction helpers ---
// Some models occasionally wrap JSON in prose or Markdown fences, or even output
// multiple JSON objects. These helpers try to reliably extract the FIRST
// complete JSON value (object or array) from a text blob.
function extractFencedCode(text: string): string | undefined {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fence) return fence[1].trim();
  return undefined;
}

function extractFirstJsonString(text: string): string | undefined {
  const trimmed = text.trim();
  // Prefer fenced code blocks
  const fenced = extractFencedCode(trimmed);
  if (fenced) return fenced;

  // Find the first '{' or '[' then parse with bracket matching
  const startIdx = trimmed.search(/[\[{]/);
  if (startIdx < 0) return undefined;

  let i = startIdx;
  const stack: string[] = [];
  let inStr = false;
  let esc = false;
  for (; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (inStr) {
      if (esc) {
        esc = false;
      } else if (ch === '\\') {
        esc = true;
      } else if (ch === '"') {
        inStr = false;
      }
      continue;
    }
    if (ch === '"') {
      inStr = true;
      continue;
    }
    if (ch === '{' || ch === '[') {
      stack.push(ch);
    } else if (ch === '}' || ch === ']') {
      const last = stack.pop();
      if ((ch === '}' && last !== '{') || (ch === ']' && last !== '[')) {
        // Unbalanced, abort
        break;
      }
      if (stack.length === 0) {
        // Found a full JSON value substring
        const candidate = trimmed.slice(startIdx, i + 1);
        return candidate.trim();
      }
    }
  }
  return undefined;
}

function tryParseFirstJson<T = any>(text: string): T | undefined {
  const s = extractFirstJsonString(text);
  if (!s) return undefined;
  try {
    return JSON.parse(s) as T;
  } catch {
    return undefined;
  }
}

// Very small prompt to extract intents. In production, move this logic server-side and improve schema validation.
const SYSTEM_PROMPT = `Eres un asistente que transforma instrucciones en español sobre diagramas UML
(clases, atributos, métodos y relaciones) a una sola acción JSON. Responde SOLO con JSON válido.

Robustez requerida:
- Acepta errores ortográficos o de audio comunes (ASR). Interpreta "tabla", "entidad", "modelo" como clase.
- Si dan atributos sin tipo, INFIERE el tipo más probable: usa Int, Float, String, Bool, Date o DateTime.
  - id, numero, nro, código -> Int
  - edad, cantidad -> Int
  - altura, peso, precio, total, monto, saldo, distancia -> Float
  - fecha -> Date; fechaHora/timestamp -> DateTime
  - activo, habilitado, disponible, esActivo -> Bool
  - nombre, apellido, color, descripcion, email, telefono, direccion -> String
  - Si no puedes inferir, usa String.
- Normaliza relación a: asociacion | herencia | agregacion | composicion.
- Cardinalidades preferidas: 0..1, 1..1, 1..*, 0..*, *.
  - Si la relación es "asociacion" y NO se especifica cardinalidad, usa 1..1 por defecto en ambos extremos.

Tipos de acción:
- { "type": "create_class", "name": string, "attributes"?: [{"name": string, "type": "Int|Float|String|Bool|Date|DateTime"}], "methods"?: [{"name": string, "returns": string}] }
- { "type": "delete_class", "targetNumber"?: number, "targetName"?: string }
- { "type": "rename_class", "targetNumber"?: number, "targetName"?: string, "newName": string }
- { "type": "move_class", "targetNumber"?: number, "targetName"?: string, "x": number, "y": number }
- { "type": "add_attribute", "targetNumber"?: number, "targetName"?: string, "attribute": {"name": string, "type": "Int|Float|String|Bool|Date|DateTime"} }
- { "type": "update_attribute", "targetNumber"?: number, "targetName"?: string, "fromName": string, "toName"?: string, "dataType"?: "Int|Float|String|Bool|Date|DateTime" }
- { "type": "delete_attribute", "targetNumber"?: number, "targetName"?: string, "name": string }
- { "type": "add_method", "targetNumber"?: number, "targetName"?: string, "method": {"name": string, "returns": string} }
- { "type": "update_method", "targetNumber"?: number, "targetName"?: string, "fromName": string, "toName"?: string, "returns"?: string }
- { "type": "delete_method", "targetNumber"?: number, "targetName"?: string, "name": string }
- { "type": "create_relation", "originNumber"?: number, "destNumber"?: number, "originName"?: string, "destName"?: string, "relationType": "asociacion"|"herencia"|"agregacion"|"composicion", "originCard"?: string, "destCard"?: string, "verb"?: string }
- { "type": "update_relation", "originNumber"?: number, "destNumber"?: number, "originName"?: string, "destName"?: string, "relationType"?: "asociacion"|"herencia"|"agregacion"|"composicion", "originCard"?: string, "destCard"?: string, "verb"?: string }
- { "type": "delete_relation", "originNumber"?: number, "destNumber"?: number, "originName"?: string, "destName"?: string }
Si no entiendes, usa {"type": "noop"}.

Ejemplos:
Usuario: crea clase Cliente con atributos nombre, edad y métodos comprar():void
JSON: {"type":"create_class","name":"Cliente","attributes":[{"name":"nombre","type":"String"},{"name":"edad","type":"Int"}],"methods":[{"name":"comprar","returns":"void"}]}
Usuario: nueva tabla Casa atributos: id, color, altura
JSON: {"type":"create_class","name":"Casa","attributes":[{"name":"id","type":"Int"},{"name":"color","type":"String"},{"name":"altura","type":"Float"}]}
Usuario: relaciona 1 con 2 como herencia 1..* a 1..1
JSON: {"type":"create_relation","originNumber":1,"destNumber":2,"relationType":"herencia","originCard":"1..*","destCard":"1..1"}
`;

function removeAccents(str: string) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function guessTypeForField(rawName: string): 'Int' | 'Float' | 'String' | 'Bool' | 'Date' | 'DateTime' {
  const n = removeAccents(rawName).toLowerCase().replace(/[^a-z0-9]/g, '');
  if (n === 'id' || /(^|_)(id|codigo|cod|nro|numero)(_|$)/.test(n)) return 'Int';
  if (/edad|cantidad|stock|anios|anos/.test(n)) return 'Int';
  if (/altura|peso|precio|total|monto|saldo|importe|distancia|area|tasa/.test(n)) return 'Float';
  if (/fechahora|timestamp|datetime/.test(n)) return 'DateTime';
  if (/fecha/.test(n)) return 'Date';
  if (/^(es|esta)/.test(n) || /activo|habilitado|disponible|eliminado/.test(n)) return 'Bool';
  return 'String';
}

function normalizeAttrType(t?: string, name?: string): string {
  if (!t || !t.trim()) return guessTypeForField(name || '');
  const s = removeAccents(t).toLowerCase().trim();
  if ([
    'int', 'integer', 'entero', 'numero', 'num', 'nro', 'smallint', 'bigint'
  ].includes(s)) return 'Int';
  if ([
    'float', 'decimal', 'double', 'numeric', 'real'
  ].includes(s)) return 'Float';
  if ([
    'bool', 'boolean', 'logico'
  ].includes(s)) return 'Bool';
  if ([
    'date', 'fecha'
  ].includes(s)) return 'Date';
  if ([
    'datetime', 'timestamp', 'fechahora'
  ].includes(s)) return 'DateTime';
  // default
  return 'String';
}

function normalizeRelationType(rt?: string): 'asociacion' | 'herencia' | 'agregacion' | 'composicion' | undefined {
  if (!rt) return undefined;
  const s = removeAccents(rt).toLowerCase();
  if (s.includes('herenc') || s.includes('extends')) return 'herencia';
  if (s.includes('compos')) return 'composicion';
  if (s.includes('agreg')) return 'agregacion';
  return 'asociacion';
}

function normalizeCardinality(c?: string): string | undefined {
  if (!c) return undefined;
  const s = removeAccents(c).toLowerCase().trim();
  if (/(uno a uno|1 a 1|1-1)/.test(s)) return '1..1';
  if (/(uno a muchos|1 a muchos|1 a \*|1-\*)/.test(s)) return '1..*';
  if (/(muchos a uno|\* a 1|\*-1)/.test(s)) return '*..1';
  if (/(muchos a muchos|\* a \*|\*-\*)/.test(s)) return '*..*';
  if (/0\.\.1|0 a 1/.test(s)) return '0..1';
  if (/0\.\.\*|0 a \*/.test(s)) return '0..*';
  return c; // as-is if already 1..*, etc.
}

function normalizeSuggestion(s: ActionSuggestion): ActionSuggestion {
  if (s.type === 'create_class') {
    const attrs = (s.attributes || []).map(a => ({
      name: a.name,
      type: normalizeAttrType(a.type, a.name)
    }));
    return { ...s, attributes: attrs };
  }
  if (s.type === 'create_relation') {
    const relationType = normalizeRelationType(s.relationType);
    let originCard = normalizeCardinality(s.originCard) || s.originCard;
    let destCard = normalizeCardinality(s.destCard) || s.destCard;
    // Default 1..1 for association if not specified
    if (relationType === 'asociacion') {
      if (!originCard) originCard = '1..1';
      if (!destCard) destCard = '1..1';
    }
    return {
      ...s,
      relationType,
      originCard,
      destCard,
      verb: s.verb && s.verb.trim() ? s.verb : undefined,
    };
  }
  return s;
}

export async function suggestActionFromText(userText: string): Promise<ActionSuggestion> {
  if (!OPENAI_API_KEY) return { type: 'noop' };

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userText },
        ],
        temperature: 0.2,
        // Ask the model to return valid JSON only when possible
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.error('OpenAI API error', await res.text());
      return { type: 'noop' };
    }
    const data = await res.json();
    const content: string | undefined = data?.choices?.[0]?.message?.content;
    if (!content) return { type: 'noop' };

    // Robust JSON extraction
    let parsed: any = undefined;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = tryParseFirstJson(content);
    }

    // If model answered with an array of actions, take the first
    if (Array.isArray(parsed)) parsed = parsed[0];

    if (parsed && typeof parsed === 'object' && typeof parsed.type === 'string') {
      return normalizeSuggestion(parsed as ActionSuggestion);
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('AI suggest error', e);
  }
  return { type: 'noop' };
}

// Parse one instruction that may contain multiple actions (e.g., many "crear tabla ...")
export async function suggestActionsFromText(userText: string): Promise<ActionSuggestion[]> {
  if (!OPENAI_API_KEY) return [];

  const MULTI_PROMPT = `Eres un asistente que convierte una INSTRUCCIÓN en español en una LISTA de acciones JSON.
Responde SOLO con un arreglo JSON ([]). Cada elemento debe seguir UNO de estos formatos:
- { "type": "create_class", "name": string, "attributes"?: [{"name": string, "type": "Int|Float|String|Bool|Date|DateTime"}] }
- { "type": "create_relation", "originNumber": number, "destNumber": number, "relationType": "asociacion"|"herencia"|"agregacion"|"composicion", "originCard"?: string, "destCard"?: string, "verb"?: string }
- { "type": "delete_relation", "originNumber": number, "destNumber": number }

Reglas:
- Si la instrucción menciona varias clases/tablas (separadas por comas o conectores), devuelve múltiples objetos create_class (uno por clase).
- Normaliza tipos de atributos y relación como en el prompt anterior. Si asociación sin cardinalidades, usa 1..1 por defecto.
- Si no entiendes, devuelve [].
Ejemplos:
Entrada: "crear tabla Usuario, crear tabla Producto y Factura"
Salida: [
  {"type":"create_class","name":"Usuario"},
  {"type":"create_class","name":"Producto"},
  {"type":"create_class","name":"Factura"}
]
Entrada: "relaciona 1 con 2 como composicion 1..* a 1..1"
Salida: [{"type":"create_relation","originNumber":1,"destNumber":2,"relationType":"composicion","originCard":"1..*","destCard":"1..1"}]`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: MULTI_PROMPT },
          { role: 'user', content: userText }
        ],
        temperature: 0.2
      })
    });
    if (!res.ok) {
      console.error('OpenAI API error (multi)', await res.text());
      return [];
    }
    const data = await res.json();
    const content: string | undefined = data?.choices?.[0]?.message?.content;
    if (!content) return [];
    let arr = tryParseFirstJson<any>(content);
    if (!Array.isArray(arr)) {
      // sometimes returns a single object
      if (arr && typeof arr === 'object') arr = [arr]; else return [];
    }
    return (arr as any[])
      .filter(Boolean)
      .map(a => normalizeSuggestion(a as ActionSuggestion))
      .filter(a => a && typeof (a as any).type === 'string');
  } catch (e) {
    console.error('AI suggestActions error', e);
    return [];
  }
}

// --- Audio transcription (Whisper) ---
export async function transcribeAudio(
  audio: Blob,
  opts?: { language?: string; translate?: boolean }
): Promise<string> {
  if (!OPENAI_API_KEY) return '';
  try {
    const form = new FormData();
    // Use a File to provide a filename expected by the API
    const file = new File([audio], 'audio.webm', { type: audio.type || 'audio/webm' });
    form.append('file', file);
    form.append('model', 'whisper-1');
    if (opts?.language) form.append('language', opts.language);
    if (opts?.translate) form.append('translate', 'true');
    form.append('response_format', 'json');

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: form
    });
    if (!res.ok) {
      console.error('OpenAI Whisper error', await res.text());
      return '';
    }
    const data = await res.json();
    const text: string = data?.text || '';
    return text;
  } catch (e) {
    console.error('transcribeAudio error', e);
    return '';
  }
}

// Suggest attributes for existing classes based on project title and class names
export async function suggestAttributesForClasses(
  projectTitle: string,
  classes: Array<{ displayId: number; name: string; attributes?: Array<{ name: string; type: string }> }>
): Promise<AttributeSuggestion[]> {
  if (!OPENAI_API_KEY) return [];

  const sys = `Eres un experto en modelado de dominio. Te daré el TÍTULO del proyecto y un listado de CLASES (con algunos atributos si existen).
Devuelve SOLO JSON con sugerencias de atributos RELEVANTES por clase, coherentes con el dominio implícito en el título y los nombres de clase.

Formato de salida (JSON estricto):
[
  { "displayId": number, "className": string, "attributes": [ { "name": string, "type": "Int|Float|String|Bool|Date|DateTime", "reason"?: string } ] }
]

Reglas:
- No dupliques atributos existentes (te paso los actuales, evítalos por nombre).
- Máximo 5 atributos nuevos por clase.
- Tipos permitidos: Int, Float, String, Bool, Date, DateTime.
- Opcionalmente incluye "reason" breve por atributo.
`;

  const user = {
    title: projectTitle,
    classes: classes.map(c => ({ displayId: c.displayId, name: c.name, attributes: c.attributes || [] }))
  };

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: JSON.stringify(user) }
        ],
        temperature: 0.2,
      })
    });
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.error('OpenAI API error (reco)', await res.text());
      return [];
    }
    const data = await res.json();
    const content: string | undefined = data?.choices?.[0]?.message?.content;
    if (!content) return [];
    const parsed = tryParseFirstJson<any>(content);
    if (Array.isArray(parsed)) {
      // Basic sanitize: ensure correct shapes
      return parsed
        .map((r: any) => ({
          displayId: Number(r?.displayId),
          className: String(r?.className || ''),
          attributes: Array.isArray(r?.attributes) ? r.attributes.map((a: any) => ({
            name: String(a?.name || '').trim(),
            type: normalizeAttrType(String(a?.type || ''), String(a?.name || '')),
            reason: a?.reason ? String(a.reason) : undefined
          })) : []
        }))
        .filter((r: any) => Number.isFinite(r.displayId) && r.className);
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('AI suggestAttributes error', e);
  }
  return [];
}

// Suggest new classes/entities ("tablas") from the project title and existing class names
export async function suggestClassesFromProjectTitle(
  projectTitle: string,
  existingClasses: string[]
): Promise<ClassSuggestion[]> {
  if (!OPENAI_API_KEY) return [];

  const sys = `Eres un experto en diseño de bases de datos y modelado de dominio.
Dado SOLO el TÍTULO de un proyecto y una lista de clases existentes, propone nuevas CLASES (también llamadas entidades/tablas) útiles y coherentes.

Responde SOLO con JSON válido con el siguiente formato:
[
  { "name": string, "attributes"?: [ { "name": string, "type": "Int|Float|String|Bool|Date|DateTime", "reason"?: string } ], "reason"?: string }
]

Reglas:
- NO repitas clases ya existentes (te paso la lista de existentes).
- Máximo 6 clases nuevas.
- Nombres en singular con PascalCase.
- Tipos de atributos permitidos: Int, Float, String, Bool, Date, DateTime.
- Incluye 2-6 atributos por clase cuando sea razonable.
`;

  const user = { title: projectTitle, existingClasses };

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: JSON.stringify(user) }
        ],
        temperature: 0.2,
      })
    });
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.error('OpenAI API error (class reco)', await res.text());
      return [];
    }
    const data = await res.json();
    const content: string | undefined = data?.choices?.[0]?.message?.content;
    if (!content) return [];
    const parsed = tryParseFirstJson<any>(content);
    if (Array.isArray(parsed)) {
      return parsed
        .map((c: any) => ({
          name: String(c?.name || '').trim(),
          attributes: Array.isArray(c?.attributes)
            ? c.attributes.map((a: any) => ({
                name: String(a?.name || '').trim(),
                type: normalizeAttrType(String(a?.type || ''), String(a?.name || '')),
                reason: a?.reason ? String(a.reason) : undefined
              }))
            : undefined,
          reason: c?.reason ? String(c.reason) : undefined
        }))
        .filter((c: ClassSuggestion) => !!c.name && !existingClasses.includes(c.name));
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('AI suggestClasses error', e);
  }
  return [];
}

// Suggest relations among existing classes from the project title and class names
export async function suggestRelationsFromProjectTitle(
  projectTitle: string,
  classNames: string[]
): Promise<RelationSuggestion[]> {
  if (!OPENAI_API_KEY) return [];

  const sys = `Eres un experto en modelado conceptual. Dado el TÍTULO del proyecto y la lista de CLASES existentes,
propón RELACIONES entre dichas clases.

Responde SOLO con JSON con este formato:
[
  { "originName": string, "destName": string, "relationType": "asociacion"|"herencia"|"agregacion"|"composicion", "originCard"?: string, "destCard"?: string, "verb"?: string, "reason"?: string }
]

Reglas:
- Usa solo nombres de la lista proporcionada (no inventes clases nuevas).
- Si "relationType" es "asociacion" y NO especificas cardinalidades, se asume 1..1 en ambos extremos.
- Usa cardinalidades estándar: 0..1, 1..1, 1..*, 0..*, *..1, *..*.
- Máximo 10 relaciones sugeridas.
`;

  const user = { title: projectTitle, classes: classNames };

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: JSON.stringify(user) }
        ],
        temperature: 0.2,
      })
    });
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.error('OpenAI API error (relation reco)', await res.text());
      return [];
    }
    const data = await res.json();
    const content: string | undefined = data?.choices?.[0]?.message?.content;
    if (!content) return [];
    const parsed = tryParseFirstJson<any>(content);
    if (Array.isArray(parsed)) {
      return parsed
        .map((r: any) => ({
          originName: String(r?.originName || '').trim(),
          destName: String(r?.destName || '').trim(),
          relationType: normalizeRelationType(String(r?.relationType || 'asociacion')),
          originCard: normalizeCardinality(r?.originCard) || r?.originCard || undefined,
          destCard: normalizeCardinality(r?.destCard) || r?.destCard || undefined,
          verb: r?.verb ? String(r.verb) : undefined,
          reason: r?.reason ? String(r.reason) : undefined
        }))
        .filter((r: RelationSuggestion) => !!r.originName && !!r.destName && classNames.includes(r.originName) && classNames.includes(r.destName));
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('AI suggestRelations error', e);
  }
  return [];
}
