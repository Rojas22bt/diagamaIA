import { createHash } from 'node:crypto';
import type { Diagram } from './types.js';

export const MAX_CLASSES = 500;
export const MAX_RELATIONS = 2000;
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function text(value: unknown, max = 200): string {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string' || value.length > max) throw new Error('Texto del diagrama inválido o demasiado largo.');
  return value.trim();
}
function identifier(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) throw new Error('Identificador de clase inválido.');
  return value;
}
export function parseDiagram(input: unknown): Diagram {
  if (typeof input === 'string') input = JSON.parse(input) as unknown;
  if (input === null) input = { classes: [], relations: [] };
  if (!isRecord(input) || !Array.isArray(input.classes) || !Array.isArray(input.relations)) {
    throw new Error('Guarda el diagrama desde el editor para poder revisarlo.');
  }
  if (input.classes.length > MAX_CLASSES || input.relations.length > MAX_RELATIONS) throw new Error('El diagrama supera el límite de revisión (500 clases y 2000 relaciones).');
  const classIds = new Set<number>();
  const relationIds = new Set<string>();
  const classes = input.classes.map((item: unknown) => {
    if (!isRecord(item) || !Array.isArray(item.attributes) || item.attributes.length > 100) throw new Error('Clase inválida (máximo 100 atributos).');
    const displayId = identifier(item.displayId);
    if (classIds.has(displayId)) throw new Error('Hay identificadores de clase repetidos.');
    classIds.add(displayId);
    return { displayId, name: text(item.name), attributes: item.attributes.map((attribute: unknown) => {
      if (!isRecord(attribute)) throw new Error('Atributo inválido.');
      return { name: text(attribute.name), type: text(attribute.type) };
    }) };
  }).sort((a, b) => a.displayId - b.displayId);
  const relations = input.relations.map((item: unknown) => {
    if (!isRecord(item)) throw new Error('Relación inválida.');
    const id = text(item.id);
    if (!id || relationIds.has(id)) throw new Error('Identificador de relación vacío o repetido.');
    relationIds.add(id);
    return { id, fromDisplayId: identifier(item.fromDisplayId), toDisplayId: identifier(item.toDisplayId),
      type: text(item.type), originCard: text(item.originCard), destCard: text(item.destCard), verb: text(item.verb) };
  }).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  return { classes, relations };
}
export const diagramKey = (diagram: Diagram): string => JSON.stringify(diagram);
export const hash = (value: string): string => createHash('sha256').update(value).digest('hex');
export const normalizeName = (value: string): string => value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
