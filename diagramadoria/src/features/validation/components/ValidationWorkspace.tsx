import { useEffect, useMemo, useState } from 'react';
import type * as joint from 'jointjs';
import type { PanelScenario } from '../types';
import type { LiveClass, LiveRelation } from '../live';
import { currentDiagramKey } from '../live';
import { sortNotices } from '../contracts';
import { useLiveValidation } from '../hooks/useLiveValidation';
import { useNoticeHighlight } from '../hooks/useNoticeHighlight';
import { NoticeDetail } from './NoticeDetail';
import { NoticeList } from './NoticeList';
import { PanelStatus } from './PanelStatus';
import '../validation.css';

interface ClassBinding extends LiveClass { element?: joint.dia.Element }
interface ValidationWorkspaceProps {
  projectId: string;
  role: string;
  classes: readonly ClassBinding[];
  relations: readonly LiveRelation[];
  graph: joint.dia.Graph | null;
  paper: joint.dia.Paper | null;
}

export function ValidationWorkspace({ projectId, role, classes, relations, graph, paper }: ValidationWorkspaceProps) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const authorized = ['creador', 'editor', 'vista'].includes(role);
  const key = useMemo(() => currentDiagramKey(classes, relations), [classes, relations]);
  const { result, error } = useLiveValidation(projectId, open && authorized, key);
  const scenario: PanelScenario = !authorized ? 'forbidden' : error?.status ?? result?.status ?? 'loading';
  const notices = useMemo(() => authorized && !error && result ? sortNotices(result.notices) : [], [authorized, error, result]);
  const selected = notices.find(notice => notice.id === selectedId);
  const bindings = useMemo(() => {
    const map = new Map<string, joint.dia.Cell>();
    if (!result || !graph) return map;
    classes.forEach(item => { if (item.element) map.set(`class:${item.displayId}`, item.element); });
    const links = graph.getLinks();
    for (const relation of relations) {
      const exact = graph.getCell(relation.id);
      if (exact?.isLink()) { map.set(`relation:${relation.id}`, exact); continue; }
      const from = classes.find(item => item.displayId === relation.fromDisplayId)?.element;
      const to = classes.find(item => item.displayId === relation.toDisplayId)?.element;
      // Bind legacy generated link IDs only when the endpoint pair is unambiguous.
      const matches = links.filter(link => link.source().id === from?.id && link.target().id === to?.id);
      if (from && to && matches.length === 1 && relations.filter(item => item.fromDisplayId === relation.fromDisplayId && item.toDisplayId === relation.toDisplayId).length === 1) map.set(`relation:${relation.id}`, matches[0]);
    }
    return map;
  }, [result, graph, classes, relations]);
  const missingReferences = useNoticeHighlight({ notice: selected, bindings, graph, paper });
  const closePanel = () => { setOpen(false); setSelectedId(null); };
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); setSelectedId(null); } };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <>
      <button type="button" className="validation-toggle" disabled={!authorized || !paper}
        aria-expanded={open} aria-controls="validation-panel" onClick={open ? closePanel : () => setOpen(true)}>
        ◎ Avisos UML
      </button>
      {open && (
        <aside id="validation-panel" className="validation-panel" aria-labelledby="validation-title">
          <header className="validation-header">
            <div><span className="validation-eyebrow">AGENTE DE VALIDACIÓN · SPRINT 2</span><h2 id="validation-title">Avisos del diagrama</h2></div>
            <button type="button" aria-label="Cerrar panel de avisos" onClick={closePanel}>✕</button>
          </header>
          <p className="validation-demo-banner">Revisión del diagrama guardado · Los avisos se actualizan al guardar los cambios.</p>
          <PanelStatus scenario={scenario === 'ready' && notices.length === 0 ? 'empty' : scenario} />
          {(error?.message || result?.message) && <p className="validation-hint" role="status">{error?.message ?? result?.message}</p>}
          <NoticeList notices={notices} selectedId={selectedId} onSelect={setSelectedId} />
          {selected && <NoticeDetail notice={selected} missingReferences={missingReferences} />}
          {notices.length > 0 && !selected && <p className="validation-hint">Selecciona un aviso para ver el detalle y localizar sus elementos.</p>}
          <footer className="validation-footer">Solo consulta · Las recomendaciones no modifican el diagrama. No encontrar avisos no garantiza que todo sea correcto.</footer>
        </aside>
      )}
    </>
  );
}
