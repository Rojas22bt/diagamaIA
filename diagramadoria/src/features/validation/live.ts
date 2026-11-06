import { parseNotices } from './contracts';
import type { ValidationNotice } from './types';

export interface LiveClass { displayId: number; name: string; attributes: readonly string[] }
export interface LiveRelation {
  id: string;
  fromDisplayId: number;
  toDisplayId: number;
  type: string;
  originCard?: string;
  destCard?: string;
  verb?: string;
}
export interface LiveResult {
  projectId: string;
  snapshotId: string;
  diagramKey: string;
  status: 'loading' | 'ready' | 'partial' | 'failed';
  message: string;
  notices: ValidationNotice[];
}

/** Same projection as the backend: layout and methods do not trigger reviews. */
export function currentDiagramKey(classes: readonly LiveClass[], relations: readonly LiveRelation[]): string {
  return JSON.stringify({
    classes: [...classes].sort((a, b) => a.displayId - b.displayId).map(item => ({ displayId: item.displayId,
      name: item.name.trim(), attributes: item.attributes.map(line => {
        const [name, ...type] = line.split(':');
        return { name: name.trim(), type: type.join(':').trim() };
      }) })),
    relations: [...relations].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0).map(item => ({
      id: item.id, fromDisplayId: item.fromDisplayId, toDisplayId: item.toDisplayId, type: item.type.trim(),
      originCard: (item.originCard ?? '').trim(), destCard: (item.destCard ?? '').trim(), verb: (item.verb ?? '').trim(),
    })),
  });
}

export function parseLiveResult(value: unknown, projectId: string): LiveResult {
  if (!value || typeof value !== 'object') throw new Error('Respuesta de revisión inválida.');
  const input = value as Record<string, unknown>;
  if (input.projectId !== projectId || typeof input.snapshotId !== 'string' || !input.snapshotId ||
    typeof input.diagramKey !== 'string' || typeof input.message !== 'string' ||
    !['loading', 'ready', 'partial', 'failed'].includes(String(input.status))) throw new Error('La revisión no corresponde al proyecto.');
  const notices = parseNotices(input.notices);
  if (notices.some(item => item.projectId !== projectId || item.snapshotId !== input.snapshotId)) throw new Error('Los avisos pertenecen a otra revisión.');
  return { projectId, snapshotId: input.snapshotId, diagramKey: input.diagramKey,
    status: input.status as LiveResult['status'], message: input.message, notices };
}
