// Minimal OpenAI client wrapper using fetch and Vite env
// IMPORTANT: This calls OpenAI from the browser; only do this if you trust the environment.
// For production, proxy via your backend to keep the API key server-side.

export type ActionSuggestion =
  | { type: 'create_class'; name: string; attributes?: Array<{ name: string; type: string }>; methods?: Array<{ name: string; returns: string }> }
  | { type: 'create_relation'; originNumber: number; destNumber: number; relationType?: 'asociacion' | 'herencia' | 'agregacion' | 'composicion'; originCard?: string; destCard?: string; verb?: string }
  | { type: 'delete_relation'; originNumber: number; destNumber: number }
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
(clases y relaciones) a una sola acción JSON. Responde SOLO con JSON válido.

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
- { "type": "create_class", "name": string, "attributes": [{"name", "type"}]?, "methods": [{"name", "returns"}]? }
- { "type": "create_relation", "originNumber": number, "destNumber": number, "relationType": "asociacion"|"herencia"|"agregacion"|"composicion", "originCard"?: string, "destCard"?: string, "verb"?: string }
- { "type": "delete_relation", "originNumber": number, "destNumber": number }
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
