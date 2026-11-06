import type { Diagram, Finding, Reference } from './types.js';

/** Iterative DFS/BFS: linear traversal, no recursion or repeated array shifts. */
export function checkGraph(diagram: Diagram): Finding[] {
  const findings: Finding[] = [];
  const nodes = new Set(diagram.classes.map(item => item.displayId));
  const edges = diagram.relations.filter(item => nodes.has(item.fromDisplayId) && nodes.has(item.toDisplayId) &&
    ['asociacion', 'agregacion', 'composicion', 'herencia'].includes(item.type));
  for (const type of ['herencia', 'composicion']) {
    const adjacency = new Map<number, { to: number; id: string }[]>();
    for (const node of nodes) adjacency.set(node, []);
    for (const edge of edges) if (edge.type === type) adjacency.get(edge.fromDisplayId)!.push({ to: edge.toDisplayId, id: edge.id });
    const state = new Map<number, number>();
    for (const start of nodes) {
      if (state.has(start)) continue;
      const stack = [{ node: start, index: 0, via: '' }];
      const positions = new Map<number, number>([[start, 0]]);
      state.set(start, 1);
      while (stack.length) {
        const frame = stack[stack.length - 1]!;
        const edge = adjacency.get(frame.node)![frame.index++];
        if (!edge) { state.set(frame.node, 2); positions.delete(frame.node); stack.pop(); continue; }
        if (state.get(edge.to) === 1) {
          const route = stack.slice(positions.get(edge.to)!);
          const path = [...route.map(item => item.node), edge.to];
          const affected: Reference[] = [...route.map(item => ({ kind: 'class' as const, displayId: item.node })),
            ...route.slice(1).map(item => ({ kind: 'relation' as const, id: item.via })), { kind: 'relation', id: edge.id }];
          findings.push({ ruleCode: 'G01', origin: 'graph', severity: type === 'herencia' ? 'error' : 'warning',
            title: `Ciclo de ${type}`, explanation: `Ruta: ${path.join(' → ')}.${type === 'composicion' ? ' Un ciclo entre tipos requiere revisar el contexto; no demuestra por sí solo un ciclo entre objetos.' : ' La cadena de herencia vuelve a la clase inicial.'}`,
            recommendation: type === 'herencia' ? 'Revisa la ruta y corrige la dependencia circular.' : 'Revisa si la composición recursiva es intencional y cómo se impide un ciclo entre objetos.', affected });
        } else if (!state.has(edge.to)) {
          state.set(edge.to, 1); positions.set(edge.to, stack.length); stack.push({ node: edge.to, index: 0, via: edge.id });
        }
      }
    }
  }
  if (nodes.size < 2) return findings;
  const neighbors = new Map<number, Set<number>>();
  for (const node of nodes) neighbors.set(node, new Set());
  for (const edge of edges) {
    // A self relation doesn't connect a class to the rest of the diagram.
    if (edge.fromDisplayId === edge.toDisplayId) continue;
    neighbors.get(edge.fromDisplayId)!.add(edge.toDisplayId);
    neighbors.get(edge.toDisplayId)!.add(edge.fromDisplayId);
  }
  const visited = new Set<number>();
  const components: number[][] = [];
  for (const start of nodes) {
    if (visited.has(start)) continue;
    const queue = [start]; visited.add(start);
    for (let index = 0; index < queue.length; index++) for (const next of neighbors.get(queue[index]!)!) {
      if (!visited.has(next)) { visited.add(next); queue.push(next); }
    }
    components.push(queue);
  }
  if (components.length > 1) for (const component of components) {
    findings.push({ ruleCode: component.length === 1 ? 'G02' : 'G03', severity: 'warning', origin: 'graph',
      title: component.length === 1 ? 'Clase aislada' : 'Grupo desconectado',
      explanation: `Las clases ${component.join(', ')} no tienen conexión con el resto del diagrama. La separación puede ser intencional.`,
      recommendation: 'Comprueba si la separación corresponde al modelo o si falta una relación.',
      affected: component.map(displayId => ({ kind: 'class', displayId })) });
  }
  return findings;
}
