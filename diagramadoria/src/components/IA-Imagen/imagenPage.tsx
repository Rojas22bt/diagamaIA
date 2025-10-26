import React, { useCallback, useEffect, useState } from 'react';
import { fetchGeminiVisionJSON } from '../../services/geminiClient';
import socketService from '../../services/socketService';

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


const ImportImageModal: React.FC<ImportImageModalProps> = ({ isOpen, onClose, onAnalyzeWithAI }) => {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  // Nuevo estado para el JSON de la IA y el estado de espera
  const [aiJsonData, setAiJsonData] = useState<DiagramModel | null>(null);
  const [jsonReady, setJsonReady] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setFile(null);
      setError('');
      setLoading(false);
      setAiJsonData(null);
      setJsonReady(false);
    }
  }, [isOpen]);

  // useEffect para importar automáticamente el JSON cuando esté listo
  useEffect(() => {
    if (jsonReady && aiJsonData && window.dispatchEvent) {
      const event = new CustomEvent('import-uml-json', { detail: aiJsonData });
      window.dispatchEvent(event);
      setJsonReady(false); // Reset para evitar reimportar
    }
  }, [jsonReady, aiJsonData]);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
  }, []);

  const toDataUrl = (f: File) => new Promise<string>((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = reject; r.readAsDataURL(f); });

  const handleAnalyze = async () => {
    if (!file) return;
    setStatusMsg(null);
    try {
  setLoading(true); setError('');
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
      setStatusMsg('¡Análisis realizado con éxito!');
      if (onAnalyzeWithAI) onAnalyzeWithAI(file, model ?? parsed);
      // Guardar el modelo en el estado y marcarlo como listo para importar
      if (model) {
        // Emitir por socket para todos los usuarios (si hay proyecto y conexión)
        try {
          let pid: number | null = null;
          try {
            const url = window.location.pathname;
            const match = url.match(/project[s]?\/?(\d+)/i);
            if (match) pid = Number(match[1]);
          } catch {}
          if (!pid && window.localStorage) {
            pid = Number(window.localStorage.getItem('activeProjectId') || 0);
          }
          if (pid && socketService && socketService.sendDiagramUpdate) {
            // Asegurar sala unida
            try { if (socketService.isConnected() && !socketService.isInProject(pid)) socketService.joinProject(pid); } catch {}
            socketService.sendDiagramUpdate({
              projectId: pid,
              userId: Number(window.localStorage.getItem('userId') || 0),
              diagramData: { fullModel: model },
              changeType: 'import_full_model',
              elementId: undefined,
              timestamp: new Date().toISOString()
            });
          }
        } catch {}
        setAiJsonData(model);
        setJsonReady(true);
      }
    } catch (e: any) {
      setError(e?.message || String(e));
      setStatusMsg('Ocurrió un error al analizar la imagen.');
    }
    finally { setLoading(false); }
  };


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md p-4" onClick={onClose}>
      <div className="bg-white/90 rounded-3xl w-full max-w-4xl min-h-[480px] shadow-2xl border border-blue-200 flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-8 py-6 bg-gradient-to-r from-blue-700 to-blue-500 text-white rounded-t-3xl border-b border-blue-300">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🖼️</span>
            <h2 className="text-2xl font-bold tracking-wide">Importar Imagen</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-blue-600 transition-colors text-xl">✖</button>
        </div>
        <div className="flex-1 flex flex-col justify-center px-10 py-8 gap-6">
          <label className="flex flex-col items-center justify-center w-full h-56 border-2 border-dashed border-blue-400 rounded-2xl cursor-pointer bg-blue-50 hover:bg-blue-100 transition-colors shadow-inner">
            <div className="flex flex-col items-center justify-center pt-6 pb-8">
              <svg className="w-16 h-16 mb-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
              <p className="text-blue-700 font-semibold text-lg">Click para seleccionar o arrastra una imagen</p>
              <p className="text-sm text-blue-500">PNG/JPG/GIF máx 10MB</p>
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={onFileChange} />
          </label>
          {loading && (
            <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/60 backdrop-blur-md" style={{minHeight: '100vh'}}>
              <div className="w-24 h-24 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mb-8"></div>
              <span className="text-blue-100 font-bold text-2xl drop-shadow">Analizando imagen, por favor espera...</span>
            </div>
          )}
          {statusMsg && !loading && (
            <div className={`p-5 rounded-2xl text-center font-semibold text-xl shadow-md ${error ? 'bg-red-100 text-red-700 border border-red-300' : 'bg-green-100 text-green-700 border border-green-300'} mt-4`}>
              {statusMsg}
            </div>
          )}
        </div>
        <div className="flex gap-6 px-10 py-6 bg-gray-50 border-t border-blue-200 rounded-b-3xl">
          <button onClick={handleAnalyze} disabled={!file || loading} className="flex-1 px-8 py-4 rounded-xl bg-emerald-600 text-white text-lg font-bold shadow hover:bg-emerald-700 disabled:opacity-50 transition-colors">Analizar diagrama con IA</button>
          <button onClick={onClose} className="px-8 py-4 rounded-xl bg-gray-200 text-gray-800 text-lg font-bold shadow hover:bg-gray-300 transition-colors">Cerrar</button>
        </div>
      </div>
    </div>
  );
};

export default ImportImageModal;