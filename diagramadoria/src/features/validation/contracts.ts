import { SEVERITIES } from './types';
import type { ElementReference, ValidationNotice } from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isReference(value: unknown): value is ElementReference {
  if (!isRecord(value)) return false;
  if (value.kind === 'relation') return typeof value.id === 'string' && value.id.length > 0;
  const validId = typeof value.displayId === 'number' && Number.isInteger(value.displayId) && value.displayId > 0;
  return validId && (value.kind === 'class' ||
    (value.kind === 'attribute' && typeof value.name === 'string' && value.name.length > 0));
}

export function parseNotices(input: unknown): ValidationNotice[] {
  if (!Array.isArray(input)) throw new Error('El proveedor debe devolver una lista de avisos.');
  const ids = new Set<string>();
  return input.map((notice: unknown) => {
    if (!isRecord(notice)) throw new Error('Aviso inválido.');
    const textFields = ['id', 'projectId', 'snapshotId', 'ruleCode', 'ruleVersion', 'title', 'explanation', 'recommendation', 'createdAt'];
    if (textFields.some(key => typeof notice[key] !== 'string' || !notice[key].trim()) ||
      !SEVERITIES.some(value => value === notice.severity) ||
      !['rules', 'graph', 'semantic'].includes(String(notice.origin)) ||
      !['active', 'resolved'].includes(String(notice.status)) ||
      !Array.isArray(notice.affected) || notice.affected.length === 0 || !notice.affected.every(isReference) ||
      Number.isNaN(Date.parse(String(notice.createdAt)))) {
      throw new Error('El aviso no cumple el contrato de validación v1.');
    }
    const id = String(notice.id);
    if (ids.has(id)) throw new Error('El proveedor contiene identificadores duplicados.');
    ids.add(id);
    return notice as unknown as ValidationNotice;
  });
}

export function sortNotices(notices: readonly ValidationNotice[]): ValidationNotice[] {
  return [...notices].sort((a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity) ||
    a.ruleCode.localeCompare(b.ruleCode) || a.id.localeCompare(b.id));
}

export function referenceLabel(reference: ElementReference): string {
  if (reference.kind === 'relation') return `Relación ${reference.id}`;
  if (reference.kind === 'attribute') return `Clase #${reference.displayId} · atributo ${reference.name}`;
  return `Clase #${reference.displayId}`;
}
