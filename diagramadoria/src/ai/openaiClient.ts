// Minimal OpenAI client wrapper using fetch and Vite env
// IMPORTANT: This calls OpenAI from the browser; only do this if you trust the environment.
// For production, proxy via your backend to keep the API key server-side.

export type ActionSuggestion =
  | { type: 'create_class'; name: string; attributes?: Array<{ name: string; type: string }>; methods?: Array<{ name: string; returns: string }> }
  | { type: 'create_relation'; originNumber: number; destNumber: number; relationType?: 'asociacion' | 'herencia' | 'agregacion' | 'composicion'; originCard?: string; destCard?: string; verb?: string }
  | { type: 'noop' }

export type AttributeSuggestion = {
  displayId: number;
  className: string;
  attributes: Array<{ name: string; type: string; reason?: string }>;
};

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY as string | undefined;

if (!OPENAI_API_KEY) {
  // eslint-disable-next-line no-console
  console.warn('VITE_OPENAI_API_KEY is not set. AI features will be disabled.');
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

Tipos de acción:
- { "type": "create_class", "name": string, "attributes": [{"name", "type"}]?, "methods": [{"name", "returns"}]? }
- { "type": "create_relation", "originNumber": number, "destNumber": number, "relationType": "asociacion"|"herencia"|"agregacion"|"composicion", "originCard"?: string, "destCard"?: string, "verb"?: string }
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
    return {
      ...s,
      relationType: normalizeRelationType(s.relationType),
      originCard: normalizeCardinality(s.originCard) || s.originCard,
      destCard: normalizeCardinality(s.destCard) || s.destCard,
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

    // Try to extract JSON (strip markdown fences if any)
    const jsonStr = content.trim().replace(/^```json\n?|```$/g, '');
    const parsed = JSON.parse(jsonStr);

    // Basic validation
    if (parsed && typeof parsed === 'object' && typeof parsed.type === 'string') {
      return normalizeSuggestion(parsed as ActionSuggestion);
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('AI suggest error', e);
  }
  return { type: 'noop' };
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
    const jsonStr = content.trim().replace(/^```json\n?|```$/g, '');
    const parsed = JSON.parse(jsonStr);
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
