import React, { useCallback, useEffect, useState } from 'react';
import { fetchGeminiVisionJSON } from '../../services/geminiClient';

export type ImportImageModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onUpload?: (file: File) => void;
  onAnalyzeWithAI?: (file: File, result?: any) => void;
};

type UMLAttribute = { name: string; type: string };
type UMLMethod = { name: string; returns: string };
type UMLClassNode = {
  id: string;
  displayId: number;
  name: string;
  position: { x: number; y: number };
  size?: { width: number; height: number };
  attributes: UMLAttribute[];
  methods: UMLMethod[];
};
type UMLRelation = {
  id: string;
  fromDisplayId: number;
  toDisplayId: number;
  type: 'asociacion' | 'herencia' | 'agregacion' | 'composicion';
  originCard?: string;
  destCard?: string;
  verb?: string;
};
type DiagramModel = {
  version: 1;
  nextDisplayId: number;
  classes: UMLClassNode[];
  relations: UMLRelation[];
};

function extractFencedOrFirstJson(text: string): any | undefined {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fence ? fence[1] : (() => {
    const trimmed = text.trim();
    const start = trimmed.search(/[\[{]/);
    if (start < 0) return undefined;
    const stack: string[] = [];
    let inStr = false, esc = false;
    for (let i = start; i < trimmed.length; i++) {
      const ch = trimmed[i];
      if (inStr) {
        if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') { inStr = true; continue; }
      if (ch === '{' || ch === '[') stack.push(ch);
      else if (ch === '}' || ch === ']') {
        const last = stack.pop();
        if ((ch === '}' && last !== '{') || (ch === ']' && last !== '[')) break;
        if (stack.length === 0) return trimmed.slice(start, i + 1);
      }
    }
    return undefined;
  })();
  if (!candidate) return undefined;
  try { return JSON.parse(candidate); } catch { return undefined; }
}

function normalizeToDiagramModel(raw: any): DiagramModel | undefined {
  try {
    const classes: UMLClassNode[] = Array.isArray(raw?.classes) ? raw.classes.map((c: any, idx: number) => {
      const displayId = Number(c?.displayId ?? (idx + 1));
      const id = typeof c?.id === 'string' ? c.id : `c-${displayId}`;
      const name = String(c?.name || 'Clase');
      const pos = {
        x: Number(c?.position?.x ?? (60 + (idx % 3) * 280)),
        y: Number(c?.position?.y ?? (120 + Math.floor(idx / 3) * 200))
      };
      const size = {
        width: Number(c?.size?.width ?? 220),
        height: Number(c?.size?.height ?? 78)
      };
      const attrs: UMLAttribute[] = Array.isArray(c?.attributes) ? c.attributes.map((a: any) => ({
        name: String(a?.name || '').trim() || 'atributo',
        type: String(a?.type || 'String')
      })) : [];
      const methods: UMLMethod[] = Array.isArray(c?.methods) ? c.methods.map((m: any) => ({
        name: String(m?.name || '').trim() || 'metodo',
        returns: String(m?.returns || 'void')
      })) : [];
      return { id, displayId, name, position: pos, size, attributes: attrs, methods };
    }) : [];
    const maxDisplay = classes.reduce((m, c) => Math.max(m, c.displayId), 0);
    const relations: UMLRelation[] = Array.isArray(raw?.relations) ? raw.relations.map((r: any, i: number) => ({
      id: String(r?.id || `r-${Date.now()}-${i}`),
      fromDisplayId: Number(r?.fromDisplayId),
      toDisplayId: Number(r?.toDisplayId),
      type: (['asociacion', 'herencia', 'agregacion', 'composicion'] as const).includes((r?.type || '').toLowerCase()) ? (r.type.toLowerCase()) as UMLRelation['type'] : 'asociacion',
      originCard: r?.originCard,
      destCard: r?.destCard,
      verb: r?.verb
    })) : [];
    return { version: 1, nextDisplayId: Number(raw?.nextDisplayId ?? (maxDisplay + 1)), classes, relations };
  } catch { return undefined; }
}

const STRONG_PROMPT = (example: any) => `Eres un experto en reconocimiento de diagramas UML a partir de FOTOS de pizarra o papel.
Devuelve ESTRICTAMENTE un único objeto JSON con esta forma EXACTA (sin texto adicional, sin markdown):
{
  "version": 1,
  "nextDisplayId": number,
  "classes": [
    { "id": string, "displayId": number, "name": string, "position": {"x": number, "y": number}, "size": {"width": number, "height": number}, "attributes": [{"name": string, "type": "Int|Float|String|Bool|Date|DateTime"}], "methods": [{"name": string, "returns": string}] }
  ],
  "relations": [
    { "id": string, "fromDisplayId": number, "toDisplayId": number, "type": "asociacion"|"herencia"|"agregacion"|"composicion", "originCard"?: string, "destCard"?: string, "verb"?: string }
  ]
}
Reglas:
- Usa displayId consecutivos (si detectas N clases, usa 1..N) y setea nextDisplayId = max(displayId)+1.
- Si no se ven tamaños/posiciones, usa width=220, height=78 y posiciones separadas en grilla.
- Si un atributo no tiene tipo, infiere: id/codigo/nro -> Int; precio/total/peso -> Float; fecha -> Date; fechaHora -> DateTime; activo -> Bool; otro -> String.
- Normaliza relación a los 4 tipos. Si es asociación sin cardinalidades visibles, usa 1..1 por defecto.
- NO envuelvas la respuesta en backticks ni texto adicional.

Ejemplo de referencia (SOLO estructura):\n${JSON.stringify(example)}\n`;

const ImportImageModal: React.FC<ImportImageModalProps> = ({ isOpen, onClose, onUpload: _onUpload, onAnalyzeWithAI }) => {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');

  useEffect(() => { if (!isOpen) { setFile(null); setError(''); setLoading(false); setResult(''); } }, [isOpen]);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    // Ya no mostramos la vista previa; solo marcamos que hay archivo
  }, []);

  const toDataUrl = (f: File) => new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = reject; r.readAsDataURL(f); });

  const handleAnalyze = async () => {
    if (!file) return;
    try {
      setLoading(true); setError(''); setResult('');
      const dataUrl = await toDataUrl(file);
      const example = {
        version: 1,
        nextDisplayId: 14,
        classes: [
          { id: 'c-10', displayId: 10, name: 'Nuevo', position: { x: 60, y: 210 }, size: { width: 220, height: 78 }, attributes: [{ name: 'atributo1', type: 'String' }, { name: 'atributo2', type: 'Int' }], methods: [] },
          { id: 'c-11', displayId: 11, name: 'Nuevo', position: { x: 650, y: 200 }, size: { width: 220, height: 78 }, attributes: [{ name: 'atributo1', type: 'String' }, { name: 'atributo2', type: 'Int' }], methods: [] }
        ],
        relations: [ { id: 'r-1761363287761-529c', fromDisplayId: 10, toDisplayId: 11, type: 'asociacion', originCard: '1..*', destCard: '1..*', verb: 'Pertenecen' } ]
      };
      const prompt = STRONG_PROMPT(example);
      const text = await fetchGeminiVisionJSON({ dataUrl, prompt });
      const parsed = extractFencedOrFirstJson(text);
      const model = parsed ? normalizeToDiagramModel(parsed) : undefined;
      const pretty = JSON.stringify(model ?? parsed ?? { error: 'No se pudo interpretar JSON de la IA' }, null, 2);
      setResult(pretty);
      if (onAnalyzeWithAI) {
        // Entregar el modelo/JSON al padre para que pinte el diagrama
        onAnalyzeWithAI(file, model ?? parsed);
        // Cerrar el modal para mostrar el diagrama inmediatamente
        onClose();
      }
    } catch (e: any) { setError(e?.message || String(e)); }
    finally { setLoading(false); }
  };

  // No hay botón de "Subir"; el flujo es seleccionar y analizar.

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm p-6" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 bg-blue-600 text-white">
          <div className="flex items-center gap-3"><span className="text-2xl">🖼️</span><h2 className="text-xl font-semibold">Importar Imagen</h2></div>
          <button onClick={onClose} className="p-2 rounded-md hover:bg-blue-500">✖</button>
        </div>
        <div className="p-6 space-y-4">
          <label className="flex flex-col items-center justify-center w-full h-44 border-2 border-dashed border-blue-400 rounded-xl cursor-pointer bg-blue-50 hover:bg-blue-100 transition-colors">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <svg className="w-12 h-12 mb-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
              {!file ? (
                <>
                  <p className="text-blue-700 font-semibold">Click para seleccionar o arrastra una imagen</p>
                  <p className="text-xs text-blue-500">PNG/JPG/GIF máx 10MB</p>
                </>
              ) : (
                <div className="flex flex-col items-center">
                  <span className="text-green-700 font-semibold">Imagen cargada</span>
                  <span className="text-xs text-gray-600 mt-1">{file.name}</span>
                </div>
              )}
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={onFileChange} />
          </label>
          {error && (<div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">{error}</div>)}
          {result && (
            <div className="bg-slate-900 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 bg-slate-800 text-slate-100"><span className="font-semibold text-sm">JSON generado</span>
                <div className="flex gap-2">
                  <button className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-xs" onClick={() => navigator.clipboard.writeText(result)}>Copiar</button>
                  <button className="px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-xs" onClick={() => { const blob = new Blob([result], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'diagram.json'; a.click(); URL.revokeObjectURL(url); }}>Descargar</button>
                </div>
              </div>
              <pre className="p-4 text-slate-200 text-xs whitespace-pre-wrap break-words">{result}</pre>
            </div>
          )}
        </div>
        <div className="flex gap-4 px-6 py-4 bg-gray-50 border-t">
          <button onClick={handleAnalyze} disabled={!file || loading} className="flex-1 px-6 py-3 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50">Analizar diagrama con IA</button>
          <button onClick={onClose} className="px-6 py-3 rounded-lg bg-gray-200 text-gray-800 font-semibold hover:bg-gray-300">Cerrar</button>
        </div>
      </div>

      {loading && (
        <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 9999 }}>
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative px-6 py-4 rounded-xl shadow-xl bg-white/90 backdrop-blur-md border border-gray-200 flex items-center gap-3">
            <span className="inline-block h-5 w-5 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
            <span className="font-semibold text-gray-700">Por favor esperar, cargando…</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportImageModal;