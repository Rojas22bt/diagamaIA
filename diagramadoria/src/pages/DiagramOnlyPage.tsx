import { useEffect, useRef, useState } from 'react';
import * as joint from 'jointjs';
import 'jointjs/dist/joint.css';
import '../styles/DiagramCss.css';

// Minimal page that only shows a JointJS paper filling the viewport
type ClassItem = {
  displayId: number;
  name: string;
  element: joint.shapes.standard.Rectangle;
};

export default function DiagramOnlyPage() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const graphRef = useRef<joint.dia.Graph | null>(null);
  const paperRef = useRef<joint.dia.Paper | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [debug, setDebug] = useState<{hostW:number;hostH:number;paperW:number;paperH:number;elements:number}>({hostW:0,hostH:0,paperW:0,paperH:0,elements:0});

  // Sidebar state
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [nextNumber, setNextNumber] = useState<number>(1);
  const [relationType, setRelationType] = useState<'asociacion' | 'herencia' | 'agregacion' | 'composicion'>('asociacion');
  const [originNum, setOriginNum] = useState<string>('');
  const [destNum, setDestNum] = useState<string>('');
  const [originCard, setOriginCard] = useState<string>('1..*');
  const [destCard, setDestCard] = useState<string>('1..*');
  const [relationVerb, setRelationVerb] = useState<string>('Pertenecen');

  useEffect(() => {
    const host = hostRef.current!;
    if (!host) return;

    graphRef.current = new joint.dia.Graph();

    const size = () => ({ width: Math.max(200, host.clientWidth || 0), height: Math.max(200, host.clientHeight || 0) });
    const { width, height } = size();

    paperRef.current = new joint.dia.Paper({
      el: host,
      model: graphRef.current,
      width,
      height,
      gridSize: 10,
      drawGrid: false,
      async: true,
      interactive: true,
      // Prevent scrolling issues
      sorting: joint.dia.Paper.sorting.NONE,
      background: { color: 'transparent' }
    });

    // Keep paper sized to container
    resizeObserverRef.current = new ResizeObserver(() => {
      const s = size();
      if (paperRef.current) {
        paperRef.current.setDimensions(s.width, s.height);
        setDebug({ hostW: s.width, hostH: s.height, paperW: s.width, paperH: s.height, elements: (graphRef.current as any)?.getElements?.().length || 0 });
      }
    });
    resizeObserverRef.current.observe(host);

    return () => {
      try { resizeObserverRef.current?.disconnect(); } catch {}
      try { (paperRef.current as any)?.remove?.(); } catch {}
      try { graphRef.current?.clear(); } catch {}
      paperRef.current = null as any;
      graphRef.current = null as any;
    };
  }, []);

  // Helpers
  const clampInside = (element: joint.dia.Element) => {
    const host = hostRef.current;
    if (!host) return;
    const r = host.getBoundingClientRect();
    const bbox = element.getBBox();
    const margin = 20;
    let x = bbox.x;
    let y = bbox.y;
    if (x < margin) x = margin;
    if (y < margin) y = margin;
    if (x + bbox.width > r.width - margin) x = r.width - bbox.width - margin;
    if (y + bbox.height > r.height - margin) y = r.height - bbox.height - margin;
    element.position(x, y);
  };

  const nuevaClase = () => {
    if (!graphRef.current) {
      try { console.warn('Graph not ready yet'); } catch {}
      return;
    }
    const displayId = nextNumber;
    const name = `Clase${displayId}`;

    // Basic label/size
    const labelText = `${name}\n-----------------------\n\n-----------------------\n`;
    const width = 240;
    const height = 140;
    const x = 60 + (displayId - 1) * 30;
    const y = 60 + (displayId - 1) * 20;

    // Prefer standard.Rectangle, fallback to basic.Rect or dia.Element
    let rect: any;
    const Standard: any = (joint as any).shapes?.standard;
    const Basic: any = (joint as any).shapes?.basic;
    if (Standard && Standard.Rectangle) {
      rect = new Standard.Rectangle();
    } else if (Basic && Basic.Rect) {
      rect = new Basic.Rect();
    } else {
      rect = new joint.dia.Element();
      rect.markup = [
        { tagName: 'rect', selector: 'body' },
        { tagName: 'text', selector: 'label' }
      ];
    }
    rect.position(x, y);
    rect.resize(width, height);
    rect.attr({
      body: { fill: '#ffffff', stroke: '#3986d3', strokeWidth: 2, rx: 12, ry: 12 },
      label: { text: labelText, fontWeight: 'bold', fontSize: 12, fill: '#2477c3', fontFamily: 'monospace', xAlignment: 'middle' }
    });
    rect.addTo(graphRef.current);
    clampInside(rect);

    setClasses(prev => [...prev, { displayId, name, element: rect }]);
    setNextNumber(n => n + 1);

    // Fit content
    try { 
      paperRef.current?.scaleContentToFit({ padding: 20, useModelGeometry: true });
      const host = hostRef.current!;
      const w = Math.max(200, host.clientWidth || 0);
      const h = Math.max(200, host.clientHeight || 0);
      paperRef.current?.setDimensions(w, h);
      setDebug({ hostW: w, hostH: h, paperW: w, paperH: h, elements: (graphRef.current as any)?.getElements?.().length || 0 });
    } catch {}
    try { console.log(`Clase creada #${displayId}`); } catch {}
  };

  const crearRelacion = () => {
    if (!graphRef.current || !originNum || !destNum) return;
    const a = classes.find(c => c.displayId === Number(originNum));
    const b = classes.find(c => c.displayId === Number(destNum));
    if (!a || !b) return;

    const link = new joint.shapes.standard.Link();
    link.source(a.element);
    link.target(b.element);

    // line style
    const line: any = { stroke: '#0b132b', strokeWidth: 2 };
    if (relationType === 'herencia') {
      line.targetMarker = { type: 'path', d: 'M 15 0 L 0 -10 L 0 10 Z', fill: '#ffffff', stroke: '#0b132b', strokeWidth: 2 };
    } else if (relationType === 'agregacion') {
      line.targetMarker = { type: 'path', d: 'M 0 0 L 10 -7 L 20 0 L 10 7 Z', fill: '#ffffff', stroke: '#0b132b', strokeWidth: 2 };
    } else if (relationType === 'composicion') {
      line.targetMarker = { type: 'path', d: 'M 0 0 L 10 -7 L 20 0 L 10 7 Z', fill: '#0b132b', stroke: '#0b132b', strokeWidth: 2 };
    }
    link.attr({ line });

    if (relationType === 'asociacion') {
      const labels: any[] = [
        { position: 0.15, attrs: { text: { text: originCard, fill: '#0b132b', fontSize: 12, fontWeight: 'bold' }, rect: { fill: '#fff', stroke: '#d0d7de', rx: 4, ry: 4, opacity: 0.9 } } },
        { position: 0.85, attrs: { text: { text: destCard, fill: '#0b132b', fontSize: 12, fontWeight: 'bold' }, rect: { fill: '#fff', stroke: '#d0d7de', rx: 4, ry: 4, opacity: 0.9 } } }
      ];
      if (relationVerb.trim()) {
        labels.push({ position: 0.5, attrs: { text: { text: relationVerb.trim(), fill: '#111', fontSize: 12, fontWeight: 'bold' }, rect: { fill: '#fff', stroke: '#e5e7eb', rx: 6, ry: 6, opacity: 0.9 } } });
      }
      try { link.labels(labels); } catch {}
    }
    link.connector('smooth');
    link.addTo(graphRef.current);

    setOriginNum('');
    setDestNum('');
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%', overflow: 'hidden' }}>
      {/* Sidebar */}
      <aside style={{ width: 260, borderRight: '1px solid #e5e7eb', padding: 12, background: '#f8fafc' }}>
        <h3 style={{ margin: '6px 0 12px', fontSize: 16 }}>Herramientas UML</h3>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Clases creadas: {classes.length}</div>
        <button onClick={nuevaClase} style={{ width: '100%', padding: '8px 12px', background: '#0d6efd', color: '#fff', border: 'none', borderRadius: 6 }}>➕ Agregar Clase</button>

        <div style={{ marginTop: 16 }}>
          <label>Tipo de relación:</label>
          <select value={relationType} onChange={e => setRelationType(e.target.value as any)} style={{ marginLeft: 8 }}>
            <option value="asociacion">Asociación</option>
            <option value="herencia">Herencia</option>
            <option value="agregacion">Agregación</option>
            <option value="composicion">Composición</option>
          </select>
        </div>
        <div style={{ marginTop: 8 }}>
          <label>Card. origen:</label>
          {relationType === 'asociacion' ? (
            <input type="text" value={originCard} onChange={e => setOriginCard(e.target.value)} style={{ width: 80, marginLeft: 8 }} placeholder="1..*" />
          ) : (
            <input type="text" value={originCard} disabled style={{ width: 80, marginLeft: 8, opacity: 0.5 }} placeholder="--" />
          )}
        </div>
        <div style={{ marginTop: 8 }}>
          <label>Card. destino:</label>
          {relationType === 'asociacion' ? (
            <input type="text" value={destCard} onChange={e => setDestCard(e.target.value)} style={{ width: 80, marginLeft: 8 }} placeholder="1..*" />
          ) : (
            <input type="text" value={destCard} disabled style={{ width: 80, marginLeft: 8, opacity: 0.5 }} placeholder="--" />
          )}
        </div>
        {relationType === 'asociacion' && (
          <div style={{ marginTop: 8 }}>
            <label>Verbo:</label>
            <input type="text" value={relationVerb} onChange={e => setRelationVerb(e.target.value)} style={{ marginLeft: 8, width: 120 }} placeholder="contiene" />
          </div>
        )}
        <div style={{ marginTop: 12 }}>
          <label>Número origen:</label>
          <input type="number" value={originNum} onChange={e => setOriginNum(e.target.value)} style={{ width: 80, marginLeft: 8 }} />
        </div>
        <div style={{ marginTop: 8 }}>
          <label>Número destino:</label>
          <input type="number" value={destNum} onChange={e => setDestNum(e.target.value)} style={{ width: 80, marginLeft: 8 }} />
        </div>
        <button onClick={crearRelacion} disabled={!originNum || !destNum} style={{ width: '100%', marginTop: 10, padding: '8px 12px', background: (!originNum || !destNum) ? '#9ca3af' : '#198754', color: '#fff', border: 'none', borderRadius: 6 }}>🔗 Dibujar Relación</button>
      </aside>

      {/* Canvas with dotted background */}
      <div
        style={{
          position: 'relative',
          flex: 1,
          minWidth: 0,
          // Dotted background
          backgroundColor: '#ffffff',
          backgroundImage: 'radial-gradient(#d0d0d0 1px, transparent 1px)',
          backgroundSize: '16px 16px',
          backgroundPosition: '0 0'
        }}
      >
        <div ref={hostRef} style={{ position: 'absolute', inset: 0, overflow: 'hidden', width: '100%', height: '100%', zIndex: 1, outline: '1px dashed rgba(200,0,0,0.25)' }} />
        <div style={{ position: 'absolute', left: 10, bottom: 10, zIndex: 2, background: 'rgba(0,0,0,0.6)', color: '#fff', padding: '6px 8px', borderRadius: 8, fontSize: 12 }}>
          <div>Host: {debug.hostW} x {debug.hostH}</div>
          <div>Paper: {debug.paperW} x {debug.paperH}</div>
          <div>Elements: {debug.elements}</div>
        </div>
      </div>
    </div>
  );
}
