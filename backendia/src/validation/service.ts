import { PrismaClient, Prisma } from '@prisma/client';
import type { Server } from 'socket.io';
import { ValidationCoordinator } from './coordinator.js';
import type { Finding, Reference, ValidationResult } from './types.js';

const prisma = new PrismaClient();
let io: Server | undefined;
export const setValidationSocketServer = (server: Server): void => { io = server; };

export async function canReadProject(projectId: number, userId: number): Promise<boolean> {
  return Boolean(await prisma.detalle_Proyecto.findFirst({ where: { id_proyecto: projectId, id_usuario: userId,
    Permisos: { descripcion: { in: ['creador', 'editor', 'vista'] } } }, select: { id_detalle: true } }));
}

export const validation = new ValidationCoordinator({
  async readDiagram(projectId) {
    const project = await prisma.proyecto.findUnique({ where: { id_proyecto: projectId }, select: { diagrama_json: true } });
    if (!project) throw new Error('Proyecto no disponible.');
    return project.diagrama_json;
  },
  async readCached(projectId, snapshotId, version) {
    const run = await prisma.validationRun.findUnique({ where: { projectId_snapshotHash_catalogVersion: { projectId, snapshotHash: snapshotId, catalogVersion: version } }, include: { notices: true } });
    if (!run || run.status !== 'COMPLETE') return null;
    return { projectId: String(projectId), snapshotId, diagramKey: '', catalogVersion: version, modelVersion: run.modelVersion, status: 'ready',
      message: 'Revisión recuperada para esta versión del diagrama.', notices: run.notices.map(notice => ({
        id: notice.id, projectId: String(projectId), snapshotId, ruleVersion: version, ruleCode: notice.ruleCode,
        severity: notice.severity.toLowerCase() as Finding['severity'], origin: notice.origin.toLowerCase() as Finding['origin'],
        status: notice.status.toLowerCase() as 'active' | 'resolved', title: notice.title, explanation: notice.explanation,
        recommendation: notice.recommendation, affected: notice.affected as unknown as Reference[], createdAt: notice.createdAt.toISOString(),
      })) };
  },
  async save(result, requestedById) {
    await prisma.$transaction(async tx => {
      const run = await tx.validationRun.upsert({
        where: { projectId_snapshotHash_catalogVersion: { projectId: Number(result.projectId), snapshotHash: result.snapshotId, catalogVersion: result.catalogVersion } },
        create: { projectId: Number(result.projectId), requestedById, snapshotHash: result.snapshotId, catalogVersion: result.catalogVersion,
          modelVersion: result.modelVersion, status: result.status === 'ready' ? 'COMPLETE' : 'PARTIAL', completedAt: new Date() },
        update: { modelVersion: result.modelVersion, status: result.status === 'ready' ? 'COMPLETE' : 'PARTIAL', completedAt: new Date() },
      });
      const notices = result.notices.map(notice => ({ id: notice.id, runId: run.id, fingerprint: notice.id, ruleCode: notice.ruleCode,
          severity: notice.severity === 'error' ? 'ERROR' as const : notice.severity === 'warning' ? 'WARNING' as const : 'RECOMMENDATION' as const,
          origin: notice.origin === 'rules' ? 'RULES' as const : notice.origin === 'graph' ? 'GRAPH' as const : 'SEMANTIC' as const,
          title: notice.title, explanation: notice.explanation, recommendation: notice.recommendation,
          affected: notice.affected as unknown as Prisma.InputJsonValue }));
      await tx.validationNotice.deleteMany({ where: { runId: run.id, id: { notIn: notices.map(notice => notice.id) }, actions: { none: {} } } });
      if (notices.length) await tx.validationNotice.createMany({ data: notices, skipDuplicates: true });
    });
  },
}, async (result: ValidationResult) => {
  if (!io) return;
  const projectId = Number(result.projectId);
  const [members, sockets] = await Promise.all([
    prisma.detalle_Proyecto.findMany({ where: { id_proyecto: projectId, Permisos: { descripcion: { in: ['creador', 'editor', 'vista'] } } }, select: { id_usuario: true } }),
    io.in(`project-${projectId}`).fetchSockets(),
  ]);
  const allowed = new Set(members.map(member => member.id_usuario));
  for (const socket of sockets) if (allowed.has(Number(socket.data.userId)) && socket.data.projectId === projectId) socket.emit('validation-result', result);
});
