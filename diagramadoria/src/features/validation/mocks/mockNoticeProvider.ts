import { parseNotices } from '../contracts';
import type { DiagramContext, ValidationNotice } from '../types';

/** Presentation fixtures only. Never infer validity or change the user's diagram. */
export function createMockNotices(projectId: string, context: DiagramContext): ValidationNotice[] {
  const firstClass = context.classes[0];
  const secondClass = context.classes[1];
  const firstRelation = context.relations[0];
  const base = {
    projectId, snapshotId: 'demo-snapshot-v1', ruleVersion: 'catalog-v1',
    status: 'active', createdAt: '2026-10-21T12:00:00.000Z',
  };
  return parseNotices([
    { ...base, id: 'demo-reference', ruleCode: 'R03', severity: 'error', origin: 'rules',
      title: 'Ejemplo: referencia a una clase ausente',
      explanation: 'Este aviso simula una relación con un extremo inexistente. No es una detección sobre tu diagrama.',
      recommendation: 'Revisar los extremos de la relación antes de decidir si debe corregirse.',
      affected: [firstRelation ? { kind: 'relation', id: firstRelation.id } : { kind: 'relation', id: 'demo-missing-relation' },
        { kind: 'class', displayId: 2147483647 }],
    },
    { ...base, id: 'demo-component', ruleCode: 'G03', severity: 'warning', origin: 'graph',
      title: 'Ejemplo: grupo desconectado',
      explanation: 'Este escenario ilustra una advertencia de conectividad sin dirección; no se ha ejecutado BFS.',
      recommendation: 'Comprobar si la separación es intencional. No es obligatorio conectar todos los grupos.',
      affected: [firstClass ? { kind: 'class', displayId: firstClass.displayId } : { kind: 'class', displayId: 2147483646 },
        ...(secondClass ? [{ kind: 'class', displayId: secondClass.displayId }] : [])],
    },
    { ...base, id: 'demo-semantic', ruleCode: 'S02', severity: 'recommendation', origin: 'semantic',
      title: 'Ejemplo: atributos posiblemente equivalentes',
      explanation: 'Domicilio y dirección de envío pueden tener significados diferentes. Este texto es estático; no se consultó IA.',
      recommendation: 'Revisar el contexto del dominio antes de combinar atributos.',
      affected: [{ kind: 'attribute', displayId: firstClass?.displayId ?? 2147483646, name: 'domicilio (ejemplo)' }],
    },
  ]);
}
