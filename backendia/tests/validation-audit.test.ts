import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PrismaClient } from '@prisma/client';

const url = process.env.VALIDATION_TEST_DATABASE_URL;
if (!url) throw new Error('Set VALIDATION_TEST_DATABASE_URL to an isolated local test database.');
const parsed = new URL(url);
if (!['127.0.0.1', 'localhost'].includes(parsed.hostname) || !parsed.pathname.startsWith('/sprint01_')) {
  throw new Error('Safety guard: only local sprint01_* databases are allowed.');
}
const prisma = new PrismaClient({ datasources: { db: { url } } });

test('Prisma validation audit: CRUD, constraints, atomicity, actor retention and project cascade', async () => {
  const suffix = crypto.randomUUID();
  const diagram = { version: 1, nextDisplayId: 2, classes: [{ id: 'c-1', displayId: 1, name: 'Cliente', position: { x: 0, y: 0 }, attributes: [], methods: [] }], relations: [] };
  const user = await prisma.usuario.create({ data: { correo: `sprint01-${suffix}@example.invalid`, contrasena: 'test-not-a-password' } });
  const project = await prisma.proyecto.create({ data: { titulo: `sprint01-${suffix}`, fecha_inicio: new Date(), estado: 'test', diagrama_json: diagram } });
  try {
    const permission = await prisma.permisos.create({ data: { descripcion: `sprint01-${suffix}` } });
    const detail = await prisma.detalle_Proyecto.create({ data: { id_usuario: user.id_usuario, id_proyecto: project.id_proyecto, id_permiso: permission.id_permiso } });
    const audit = await prisma.acciones_Proyecto.create({ data: { id_detalle: detail.id_detalle, accion: 'validation_decision_link' } });
    const runData = { projectId: project.id_proyecto, requestedById: user.id_usuario, snapshotHash: suffix, catalogVersion: 'v1' };
    const run = await prisma.validationRun.create({ data: runData });
    const noticeData = { runId: run.id, fingerprint: 'R05:c-1', ruleCode: 'R05', severity: 'WARNING' as const, origin: 'RULES' as const, title: 'test', explanation: 'test', recommendation: 'review', affected: [{ kind: 'class', displayId: 1 }] };
    const notice = await prisma.validationNotice.create({ data: noticeData });
    const actionData = { noticeId: notice.id, actorId: user.id_usuario, auditActionId: audit.id_accion, idempotencyKey: suffix, type: 'ACCEPTED' as const, snapshotHash: suffix };
    const action = await prisma.validationAction.create({ data: actionData });
    assert.equal((await prisma.validationNotice.findUniqueOrThrow({ where: { id: notice.id }, include: { actions: true } })).actions[0]?.id, action.id);
    assert.equal((await prisma.validationNotice.findUniqueOrThrow({ where: { id: notice.id } })).status, 'ACTIVE', 'acceptance must not resolve a notice');
    await assert.rejects(prisma.validationRun.create({ data: runData }), { code: 'P2002' });
    await assert.rejects(prisma.validationNotice.create({ data: noticeData }), { code: 'P2002' });
    await assert.rejects(prisma.validationAction.create({ data: actionData }), { code: 'P2002' });
    await assert.rejects(prisma.validationNotice.create({ data: { ...noticeData, runId: 'missing-run' } }), { code: 'P2003' });
    const before = await prisma.validationRun.count({ where: { projectId: project.id_proyecto } });
    await assert.rejects(prisma.$transaction(async tx => {
      const partial = await tx.validationRun.create({ data: { ...runData, snapshotHash: 'rollback' } });
      await tx.validationNotice.create({ data: { ...noticeData, runId: partial.id } });
      throw new Error('simulate interrupted write');
    }), /interrupted/);
    assert.equal(await prisma.validationRun.count({ where: { projectId: project.id_proyecto } }), before);
    assert.deepEqual((await prisma.proyecto.findUniqueOrThrow({ where: { id_proyecto: project.id_proyecto } })).diagrama_json, diagram);
    await prisma.usuario.delete({ where: { id_usuario: user.id_usuario } });
    const retained = await prisma.validationAction.findUniqueOrThrow({ where: { id: action.id } });
    assert.equal(retained.actorId, null);
    assert.equal(retained.auditActionId, null);
    assert.equal((await prisma.validationRun.findUniqueOrThrow({ where: { id: run.id } })).requestedById, null);
    await prisma.proyecto.delete({ where: { id_proyecto: project.id_proyecto } });
    assert.equal(await prisma.validationRun.count({ where: { id: run.id } }), 0);
    assert.equal(await prisma.validationNotice.count({ where: { id: notice.id } }), 0);
    assert.equal(await prisma.validationAction.count({ where: { id: action.id } }), 0);
    await prisma.permisos.delete({ where: { id_permiso: permission.id_permiso } });
  } finally {
    await prisma.proyecto.deleteMany({ where: { id_proyecto: project.id_proyecto } });
    await prisma.usuario.deleteMany({ where: { id_usuario: user.id_usuario } });
    await prisma.$disconnect();
  }
});
