import { useEffect, useMemo, useState } from 'react';
import type * as joint from 'jointjs';
import type { PanelScenario, ValidationNotice } from '../types';
import { sortNotices } from '../contracts';
import { createMockNotices } from '../mocks/mockNoticeProvider';
import { useNoticeHighlight } from '../hooks/useNoticeHighlight';
import { NoticeDetail } from './NoticeDetail';
import { NoticeList } from './NoticeList';
import { PanelStatus } from './PanelStatus';
import '../validation.css';

interface ClassBinding {
  displayId: number;
  name: string;
  element?: joint.dia.Element;
}
interface ValidationWorkspaceProps {
  projectId: string;
  role: string;
  classes: readonly ClassBinding[];
  graph: joint.dia.Graph | null;
  paper: joint.dia.Paper | null;
}
interface DemoSession {
  notices: ValidationNotice[];
  bindings: Map<string, joint.dia.Cell>;
}

export function ValidationWorkspace({ projectId, role, classes, graph, paper }: ValidationWorkspaceProps) {
  const [session, setSession] = useState<DemoSession | null>(null);
  const [scenario, setScenario] = useState<PanelScenario>('ready');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const authorized = ['creador', 'editor', 'vista'].includes(role);
  const effectiveScenario = authorized ? scenario : 'forbidden';
  const notices = useMemo(() => {
    if (!session || !['ready', 'partial'].includes(effectiveScenario)) return [];
    return sortNotices(session.notices.filter(notice => effectiveScenario !== 'partial' || notice.origin !== 'semantic'));
  }, [session, effectiveScenario]);
  const selected = notices.find(notice => notice.id === selectedId);
  const missingReferences = useNoticeHighlight({
    notice: selected,
    bindings: session?.bindings,
    graph,
    paper,
  });

  const openPanel = () => {
    if (!authorized || !graph || !paper) return;
    const bindings = new Map<string, joint.dia.Cell>();
    classes.forEach(item => { if (item.element) bindings.set(`class:${item.displayId}`, item.element); });
    const links = graph.getLinks();
    links.forEach(link => bindings.set(`relation:${String(link.id)}`, link));
    setSession({
      bindings,
      notices: createMockNotices(projectId, { classes, relations: links.map(link => ({ id: String(link.id) })) }),
    });
    setScenario('ready');
    setSelectedId(null);
  };
  const closePanel = () => { setSession(null); setSelectedId(null); };

  useEffect(() => {
    if (!session) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') { setSession(null); setSelectedId(null); } };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [session]);

  return (
    <>
      <button
        type="button"
        className="validation-toggle"
        disabled={!authorized || !paper}
        aria-expanded={session !== null}
        aria-controls="validation-panel"
        onClick={session ? closePanel : openPanel}
      >
        ◎ Avisos UML
      </button>
      {session && (
        <aside id="validation-panel" className="validation-panel" aria-labelledby="validation-title">
          <header className="validation-header">
            <div>
              <span className="validation-eyebrow">AGENTE DE VALIDACIÓN · SPRINT 1</span>
              <h2 id="validation-title">Avisos del diagrama</h2>
            </div>
            <button type="button" aria-label="Cerrar panel de avisos" onClick={closePanel}>✕</button>
          </header>
          <p className="validation-demo-banner">
            Datos de ejemplo · No se está analizando el diagrama. No se consulta IA ni se guardan estos avisos.
          </p>
          <label className="validation-scenario">
            Escenario de demostración
            <select
              value={scenario}
              onChange={event => {
                setScenario(event.target.value as PanelScenario);
                setSelectedId(null);
              }}
            >
              <option value="ready">Avisos de ejemplo</option>
              <option value="loading">Analizando</option>
              <option value="empty">Sin avisos</option>
              <option value="partial">Análisis parcial</option>
              <option value="failed">Fallo</option>
              <option value="forbidden">Sin permisos</option>
            </select>
          </label>
          <PanelStatus scenario={effectiveScenario} />
          <NoticeList notices={notices} selectedId={selectedId} onSelect={setSelectedId} />
          {selected && <NoticeDetail notice={selected} missingReferences={missingReferences} />}
          {notices.length > 0 && !selected && (
            <p className="validation-hint">
              Selecciona un aviso para ver el detalle y localizar sus elementos.
            </p>
          )}
          <footer className="validation-footer">
            Solo consulta · Las decisiones y el motor real se incorporarán en los siguientes sprints.
          </footer>
        </aside>
      )}
    </>
  );
}
