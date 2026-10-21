import { useEffect, useMemo, useState } from 'react';
import type * as joint from 'jointjs';
import { referenceLabel } from '../contracts';
import type { ElementReference, ValidationNotice } from '../types';
import { highlightViews } from './highlightViews';

interface HighlightContext {
  notice: ValidationNotice | undefined;
  bindings: ReadonlyMap<string, joint.dia.Cell> | undefined;
  graph: joint.dia.Graph | null;
  paper: joint.dia.Paper | null;
}

function referenceKey(reference: ElementReference): string {
  return reference.kind === 'relation'
    ? `relation:${reference.id}`
    : `class:${reference.displayId}`;
}

export function useNoticeHighlight({ notice, bindings, graph, paper }: HighlightContext): string[] {
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!bindings || !graph) return;
    const refresh = () => setRevision(value => value + 1);
    // JointJS inherits these APIs from Backbone, whose types are absent here.
    const events = graph as unknown as {
      on: (names: string, callback: () => void) => void;
      off: (names: string, callback: () => void) => void;
    };
    events.on('remove reset add', refresh);
    return () => events.off('remove reset add', refresh);
  }, [bindings, graph]);

  const { missing, elements } = useMemo(() => {
    // A graph event invalidates captured views even when the graph object is unchanged.
    void revision;
    const missing: string[] = [];
    const elements: Element[] = [];
    const root = (paper as unknown as { el?: HTMLElement } | null)?.el;
    const views = Array.from(root?.querySelectorAll('[model-id]') ?? []);

    for (const reference of notice?.affected ?? []) {
      const cell = bindings?.get(referenceKey(reference));
      // Object identity prevents highlighting a replacement with a reused displayId.
      const current = cell && graph?.getCell(cell.id) === cell;
      const element = current
        ? views.find(candidate => candidate.getAttribute('model-id') === String(cell.id))
        : undefined;
      if (element) elements.push(element);
      else missing.push(referenceLabel(reference));
    }
    return { missing, elements };
  }, [notice, bindings, graph, paper, revision]);

  useEffect(() => {
    if (!notice) return;
    return highlightViews(elements, notice.severity);
  }, [notice, elements]);

  return missing;
}
