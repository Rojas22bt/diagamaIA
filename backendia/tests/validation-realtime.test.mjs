import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const url = process.env.VALIDATION_TEST_DATABASE_URL;
if (!url) throw new Error('VALIDATION_TEST_DATABASE_URL is required.');
const target = new URL(url);
if (!['localhost', '127.0.0.1'].includes(target.hostname) || !target.pathname.startsWith('/sprint01_')) throw new Error('Only isolated local sprint01_* databases are allowed.');
const prisma = new PrismaClient({ datasources: { db: { url } } });
const { io } = createRequire(new URL('../../diagramadoria/package.json', import.meta.url))('socket.io-client');

function event(socket, name, predicate = () => true) {
  return new Promise((resolve, reject) => {
    const listener = value => { if (predicate(value)) { clearTimeout(timer); socket.off(name, listener); resolve(value); } };
    const timer = setTimeout(() => { socket.off(name, listener); reject(new Error(`Timeout ${name}`)); }, 10000);
    socket.on(name, listener);
  });
}

test('Sprint 2 API / database / 3 sockets: results, reconnect, isolation, revoked access and read-only enforcement', async () => {
  const suffix = crypto.randomUUID();
  const secret = `sprint02-${suffix}`;
  const server = spawn(process.execPath, ['dist/server.js'], {
    cwd: new URL('../', import.meta.url),
    env: { ...process.env, DATABASE_URL: url, JWT_SECRET: secret, PORT: '55493', OPENAI_API_KEY: '', VALIDATION_DEBOUNCE_MS: '100' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const users = [];
  const clients = [];
  const projects = [];
  const permissions = [];
  const tokens = [];
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Backend startup timeout')), 10000);
      server.once('error', reject);
      server.stdout.on('data', data => { if (String(data).includes('Servidor escuchando')) { clearTimeout(timer); resolve(); } });
      server.once('exit', code => { clearTimeout(timer); reject(new Error(`Backend exited ${code}`)); });
    });
    const api = async (path, index = 0, method = 'GET', body) => fetch(`http://127.0.0.1:55493/api/projects${path}`, {
      method, headers: { Authorization: `Bearer ${tokens[index]}`, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    for (const role of ['creador', 'editor', 'vista', 'outsider']) {
      const user = await prisma.usuario.create({ data: { correo: `${suffix}-${role}@example.invalid`, nombre: role, contrasena: 'test-only' } });
      users.push(user); tokens.push(jwt.sign({ id: user.id_usuario }, secret, { expiresIn: '5m' }));
      permissions.push(await prisma.permisos.create({ data: { descripcion: role } }));
    }
    const original = { version: 1, classes: [{ displayId: 1, name: 'Cliente', attributes: [{ name: 'id', type: 'Int' }], methods: [] }, { displayId: 2, name: 'cliente', attributes: [], methods: [] }], relations: [] };
    for (let i = 0; i < 2; i++) projects.push(await prisma.proyecto.create({ data: { titulo: `${suffix}-${i}`, fecha_inicio: new Date(), estado: 'test', diagrama_json: original } }));
    const projectId = projects[0].id_proyecto;
    for (let i = 0; i < 3; i++) await prisma.detalle_Proyecto.create({ data: { id_usuario: users[i].id_usuario, id_proyecto: projectId, id_permiso: permissions[i].id_permiso } });
    await prisma.detalle_Proyecto.create({ data: { id_usuario: users[3].id_usuario, id_proyecto: projects[1].id_proyecto, id_permiso: permissions[0].id_permiso } });
    const connect = async index => {
      const socket = io('http://127.0.0.1:55493', { auth: { token: tokens[index] }, transports: ['websocket'], autoConnect: false, reconnection: false });
      clients.push(socket);
      const connected = event(socket, 'connect'); socket.connect(); await connected;
      return socket;
    };
    for (let i = 0; i < 3; i++) {
      const socket = await connect(i);
      const result = event(socket, 'validation-result', value => value.status === 'ready');
      socket.emit('join-project', projectId);
      const delivered = await result;
      assert.equal(delivered.projectId, String(projectId));
      assert.ok(delivered.notices.some(notice => notice.ruleCode === 'R05'));
    }
    const initialResponse = await api(`/${projectId}/validation`);
    assert.equal(initialResponse.status, 200);
    const initial = await initialResponse.json();
    assert.ok(initial.notices.length >= 3);
    const run = await prisma.validationRun.findFirst({ where: { projectId, snapshotHash: initial.snapshotId }, include: { notices: true } });
    assert.ok(run); assert.equal(run.notices.length, initial.notices.length);
    assert.equal((await api(`/${projectId}/validation`, 3)).status, 403);
    assert.equal((await api('/not-an-id/validation')).status, 400);
    assert.equal((await api(`/${projectId}/diagram`, 2, 'PUT', { diagrama_json: original })).status, 403);
    const deniedWrite = event(clients[2], 'error');
    clients[2].emit('diagram-update', { projectId, diagramData: original, changeType: 'autosave' });
    assert.match(await deniedWrite, /editar/);
    const outsider = await connect(3);
    const deniedJoin = event(outsider, 'error'); outsider.emit('join-project', projectId);
    assert.match(await deniedJoin, /acceso/);
    const crossProject = [];
    outsider.on('validation-result', value => crossProject.push(value));
    outsider.emit('join-project', projects[1].id_proyecto);

    const next = structuredClone(original);
    next.classes[1].name = 'Factura';
    next.relations = [{ id: 'r-valid', fromDisplayId: 1, toDisplayId: 2, type: 'asociacion', originCard: '1', destCard: '*' }];
    const updates = clients.slice(0, 3).map(socket => event(socket, 'validation-result', value => value.status === 'ready' && value.snapshotId !== initial.snapshotId));
    assert.equal((await api(`/${projectId}/diagram`, 1, 'PUT', { diagrama_json: next })).status, 200);
    const results = await Promise.all(updates);
    assert.ok(results.every(value => value.notices.length === 0));
    assert.ok(results.every(value => value.snapshotId === results[0].snapshotId));
    assert.equal(crossProject.filter(value => value.projectId === String(projectId)).length, 0);
    clients[2].disconnect();
    const viewer = await connect(2);
    const recovered = event(viewer, 'validation-result', value => value.status === 'ready'); viewer.emit('join-project', projectId);
    assert.equal((await recovered).snapshotId, results[0].snapshotId);

    // Delta updates must never overwrite the full saved diagram.
    const delta = event(clients[1], 'diagram-updated', value => value.changeType === 'update_class');
    clients[0].emit('diagram-update', { projectId, diagramData: { displayId: 1, name: 'Temporal' }, changeType: 'update_class' });
    await delta;
    assert.deepEqual((await prisma.proyecto.findUnique({ where: { id_proyecto: projectId } })).diagrama_json, next);

    await prisma.detalle_Proyecto.deleteMany({ where: { id_proyecto: projectId, id_usuario: users[2].id_usuario } });
    const revoked = []; viewer.on('validation-result', value => revoked.push(value));
    const ambiguous = structuredClone(next);
    ambiguous.classes[0].attributes = [{ name: 'domicilio', type: 'String' }, { name: 'direccion_envio', type: 'String' }];
    const partial = event(clients[0], 'validation-result', value => value.status === 'partial');
    await api(`/${projectId}/diagram`, 0, 'PUT', { diagrama_json: ambiguous });
    const partialResult = await partial;
    assert.match(partialResult.message, /OpenAI/);
    assert.equal(revoked.length, 0);
    assert.equal((await api(`/${projectId}/validation`, 2)).status, 403);
  } finally {
    clients.forEach(socket => socket.disconnect());
    const exited = once(server, 'exit'); server.kill(); await exited;
    await prisma.proyecto.deleteMany({ where: { id_proyecto: { in: projects.map(project => project.id_proyecto) } } });
    await prisma.usuario.deleteMany({ where: { id_usuario: { in: users.map(user => user.id_usuario) } } });
    await prisma.permisos.deleteMany({ where: { id_permiso: { in: permissions.map(permission => permission.id_permiso) } } });
    await prisma.$disconnect();
  }
});
