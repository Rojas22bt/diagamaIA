import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const url = process.env.VALIDATION_TEST_DATABASE_URL;
if (!url) throw new Error('VALIDATION_TEST_DATABASE_URL is required.');
const parsed = new URL(url);
if (!['127.0.0.1', 'localhost'].includes(parsed.hostname) || !parsed.pathname.startsWith('/sprint01_')) {
  throw new Error('Only isolated local sprint01_* test databases are allowed.');
}
const prisma = new PrismaClient({ datasources: { db: { url } } });
const { io } = createRequire(new URL('../../diagramadoria/package.json', import.meta.url))('socket.io-client');

function waitForEvent(emitter, name) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { emitter.off(name, listener); reject(new Error(`Timeout: ${name}`)); }, 8000);
    const listener = value => { clearTimeout(timer); resolve(value); };
    emitter.once(name, listener);
  });
}

test('existing API and Socket.IO: save, reload, 3 collaborators, reconnect and denied access', async () => {
  const suffix = crypto.randomUUID();
  const secret = `isolated-test-${suffix}`;
  const server = spawn(process.execPath, ['dist/server.js'], {
    cwd: new URL('../', import.meta.url),
    env: { ...process.env, DATABASE_URL: url, JWT_SECRET: secret, PORT: '55492' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const clients = [];
  const users = [];
  let projectId;
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Test backend did not start.')), 10000);
      server.once('error', reject);
      server.stdout.on('data', data => {
        if (String(data).includes('Servidor escuchando')) { clearTimeout(timer); resolve(); }
      });
      server.once('exit', code => { clearTimeout(timer); reject(new Error(`Test backend exited: ${code}`)); });
    });
    for (const role of ['creador', 'editor', 'vista', 'outsider']) {
      users.push(await prisma.usuario.create({ data: { correo: `regression-${role}-${suffix}@example.invalid`, nombre: role, contrasena: 'fixture-only' } }));
    }
    const tokens = users.map(user => jwt.sign({ id: user.id_usuario, correo: user.correo }, secret, { expiresIn: '5m' }));
    const api = async (path, token, method = 'GET', body) => {
      const response = await fetch(`http://127.0.0.1:55492/api${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      assert.ok(response.ok, `HTTP ${response.status} ${path}`);
      return response.json();
    };
    const original = { version: 1, nextDisplayId: 2, classes: [{ id: 'c-1', displayId: 1, name: 'Cliente', position: { x: 0, y: 0 }, attributes: [], methods: [] }], relations: [] };
    const created = await api('/projects', tokens[0], 'POST', { name: `regression-${suffix}`, diagrama_json: original });
    projectId = created.proyecto.id;
    for (const [index, role] of [[1, 'editor'], [2, 'vista']]) {
      const permission = await prisma.permisos.findFirst({ where: { descripcion: role } }) ?? await prisma.permisos.create({ data: { descripcion: role } });
      await prisma.detalle_Proyecto.create({ data: { id_usuario: users[index].id_usuario, id_proyecto: projectId, id_permiso: permission.id_permiso } });
    }
    for (const token of tokens.slice(0, 3)) {
      const socket = io('http://127.0.0.1:55492', { auth: { token }, transports: ['websocket'], autoConnect: false, reconnection: false });
      clients.push(socket);
      const connected = waitForEvent(socket, 'connect');
      socket.connect();
      await connected;
      const joined = waitForEvent(socket, 'joined-project');
      socket.emit('join-project', projectId);
      assert.equal(await joined, projectId);
    }
    const updated = structuredClone(original);
    updated.classes[0].name = 'Cliente actualizado';
    await api(`/projects/${projectId}/diagram`, tokens[0], 'PUT', { diagrama_json: updated });
    for (const token of tokens.slice(0, 3)) {
      assert.deepEqual((await api(`/projects/${projectId}`, token)).proyecto.diagrama_json, updated);
    }
    const deliveries = clients.slice(1).map(client => waitForEvent(client, 'diagram-updated'));
    clients[0].emit('diagram-update', { projectId, diagramData: updated, changeType: 'autosave' });
    for (const delivered of await Promise.all(deliveries)) assert.deepEqual(delivered.diagramData, updated);
    const persisted = (await api(`/projects/${projectId}`, tokens[0])).proyecto.diagrama_json;
    assert.deepEqual(typeof persisted === 'string' ? JSON.parse(persisted) : persisted, updated);
    const reconnected = waitForEvent(clients[2], 'connect');
    clients[2].disconnect();
    clients[2].connect();
    await reconnected;
    const rejoined = waitForEvent(clients[2], 'joined-project');
    clients[2].emit('join-project', projectId);
    assert.equal(await rejoined, projectId);
    const forbidden = await fetch(`http://127.0.0.1:55492/api/projects/${projectId}`, { headers: { Authorization: `Bearer ${tokens[3]}` } });
    assert.equal(forbidden.status, 403);
    const noToken = await fetch(`http://127.0.0.1:55492/api/projects/${projectId}`);
    assert.equal(noToken.status, 401);
  } finally {
    clients.forEach(client => client.disconnect());
    const exited = once(server, 'exit');
    server.kill();
    await exited;
    if (projectId) await prisma.proyecto.deleteMany({ where: { id_proyecto: projectId } });
    await prisma.usuario.deleteMany({ where: { id_usuario: { in: users.map(user => user.id_usuario) } } });
    await prisma.$disconnect();
  }
});
