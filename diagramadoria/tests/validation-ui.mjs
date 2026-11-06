import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { checkRules } from '../../backendia/dist/validation/rules.js';
import { checkGraph } from '../../backendia/dist/validation/graph.js';
import { parseDiagram, diagramKey, hash } from '../../backendia/dist/validation/diagram.js';

const modulePath = process.env.PLAYWRIGHT_MODULE;
const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : 'playwright');
const uiUrl = process.env.VALIDATION_UI_URL || 'http://127.0.0.1:5174/diagram/1';
const server = process.env.VALIDATION_UI_URL ? null : spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5174', '--strictPort'], { cwd: new URL('../', import.meta.url), stdio: ['ignore', 'pipe', 'pipe'] });
if (server) await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('Vite startup timeout')), 15000);
  server.once('error', reject);
  server.once('exit', code => { clearTimeout(timer); reject(new Error(`Vite exited ${code}`)); });
  server.stdout.on('data', data => { if (String(data).includes('Local:')) { clearTimeout(timer); resolve(); } });
});
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const evidence = new URL('../../docs/sprint-02/evidence/', import.meta.url);
await mkdir(evidence, { recursive: true });
const diagram = JSON.parse((await readFile(new URL('../../docs/sprint-01/fixtures/diagram.json', import.meta.url), 'utf8')).replace(/^\uFEFF/, ''));
diagram.classes[1].name = 'cliente';
diagram.classes.push({ id: 'c-3', displayId: 3, name: 'Aislada', position: { x: 800, y: 150 }, attributes: [], methods: [] });
diagram.nextDisplayId = 4;
diagram.relations[0].originCard = '3..1';
const parsed = parseDiagram(diagram);
const key = diagramKey(parsed);
const snapshotId = hash(key);
const notices = [...checkRules(parsed), ...checkGraph(parsed)].map((finding, i) => ({ ...finding, id: `notice-${i}`, projectId: '1', snapshotId, ruleVersion: 'sprint2-test', status: 'active', createdAt: new Date().toISOString() }));
const results = [];
try {
  for (const role of ['creador', 'editor', 'vista']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
    const page = await context.newPage();
    const errors = [];
    const writes = [];
    let mode = 'ready';
    page.on('pageerror', error => errors.push(error.message));
    await context.addInitScript(() => {
      localStorage.setItem('token', 'sprint02-ui-token');
      localStorage.setItem('user', JSON.stringify({ id: 1, correo: 'demo@example.invalid', nombre: 'Demo' }));
      localStorage.setItem('userId', '1');
    });
    await context.route('http://localhost:3000/api/**', async route => {
      const request = route.request();
      if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method())) writes.push(request.url());
      const path = new URL(request.url()).pathname;
      if (path.endsWith('/validation')) {
        const body = { projectId: '1', snapshotId, diagramKey: key, status: mode === 'empty' ? 'ready' : mode, message: `Estado de prueba: ${mode}`, notices: ['failed', 'empty'].includes(mode) ? [] : notices };
        await route.fulfill({ status: mode === 'forbidden' ? 403 : 200, contentType: 'application/json', body: JSON.stringify(body) });
        return;
      }
      const project = { id: 1, name: 'Prueba aislada sprint 2', rol: role, creator_id: 1, diagrama_json: diagram,
        colaboradores: [{ usuario: { id: 1, name: 'Demo', email: 'demo@example.invalid' }, rol: role }] };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(path.endsWith('/projects/1') ? { proyecto: project } : { invitaciones: [] }) });
    });
    await page.goto(uiUrl);
    const toggle = page.getByRole('button', { name: '◎ Avisos UML' });
    await toggle.waitFor();
    await page.waitForFunction(() => document.querySelectorAll('.paper-host [model-id]').length >= 4);
    const exportDiagram = async () => {
      const downloaded = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Exportar JSON' }).click();
      return JSON.parse(await readFile(await (await downloaded).path(), 'utf8'));
    };
    const before = role === 'vista' ? null : await exportDiagram();
    await page.evaluate(async () => {
      const { default: service } = await import('/src/services/socketService.ts');
      window.__validationSocketWrites = 0;
      service.sendDiagramUpdate = () => { window.__validationSocketWrites++; };
    });
    await toggle.click();
    await page.getByText('Estado de prueba: ready', { exact: true }).waitFor();
    assert.equal(await page.locator('.validation-notice').count(), notices.length);
    assert.equal(await page.getByLabel('Escenario de demostración').count(), 0);
    await page.locator('.validation-notice').filter({ hasText: 'Cantidad de participantes inválida' }).click();
    assert.equal(await page.locator('.paper-host .validation-highlight-error').count(), 1);
    await page.locator('.validation-notice').filter({ hasText: 'Nombre repetido' }).click();
    assert.equal(await page.locator('.paper-host .validation-highlight-error').count(), 2);
    assert.match(await page.locator('.validation-detail').innerText(), /sin mayúsculas ni acentos/);
    await page.locator('.validation-notice').filter({ hasText: 'Clase aislada' }).click();
    assert.equal(await page.locator('.paper-host .validation-highlight-error').count(), 0);
    assert.equal(await page.locator('.paper-host .validation-highlight-warning').count(), 1);
    await page.screenshot({ path: new URL(`panel-${role}.png`, evidence).pathname.replace(/^\/(\w:)/, '$1'), fullPage: true });
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#validation-panel').count(), 0);
    assert.equal(await page.locator('.paper-host [class*="validation-highlight-"]').count(), 0);
    for (const state of ['loading', 'empty', 'partial', 'failed', 'forbidden']) {
      mode = state;
      await toggle.click();
      await page.locator(`.validation-status-${state}`).waitFor();
      assert.equal(await page.locator('.validation-notice').count(), ['loading', 'partial'].includes(state) ? notices.length : 0);
      await page.getByRole('button', { name: 'Cerrar panel de avisos' }).click();
    }
    mode = 'ready';
    await toggle.click(); await page.getByText('Estado de prueba: ready', { exact: true }).waitFor();
    await page.locator('.validation-notice').filter({ hasText: 'Clase aislada' }).click();
    if (role !== 'vista') {
      await page.getByRole('button', { name: 'Cerrar panel de avisos' }).click();
      assert.deepEqual(await exportDiagram(), before);
      await toggle.click();
    }
    assert.equal(await page.getByRole('button', { name: /^(Aceptar|Rechazar|Aplicar)/ }).count(), 0);
    assert.equal(await page.evaluate(() => window.__validationSocketWrites), 0, 'panel must not emit edits');
    assert.deepEqual(writes, []);
    assert.deepEqual(errors, []);
    if (role === 'creador') {
      const replacement = structuredClone(diagram); replacement.classes[0].name = 'Reemplazada';
      await page.locator('input[type=file][accept="application/json"]').setInputFiles({ name: 'replacement.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(replacement)) });
      await page.waitForFunction(() => !document.querySelector('.validation-notice'));
      assert.equal(await page.locator('.paper-host [class*="validation-highlight-"]').count(), 0, 'stale notices must not highlight a new diagram');
    }
    results.push({ role, result: 'PASS', notices: notices.length, states: 6, writes: writes.length, pageErrors: errors.length });
    await context.close();
  }
  console.log(JSON.stringify({ ui: results, note: 'Real React/JointJS with mocked HTTP using actual rule-engine findings. Socket.IO covered by backend integration tests.' }, null, 2));
} finally { await browser.close(); server?.kill(); }
