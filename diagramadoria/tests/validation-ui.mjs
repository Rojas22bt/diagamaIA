import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

// Resolve Playwright from the caller's environment without adding a production dependency.
const modulePath = process.env.PLAYWRIGHT_MODULE;
const { chromium } = await import(modulePath ? pathToFileURL(modulePath).href : 'playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const evidence = new URL('../../docs/sprint-01/evidence/', import.meta.url);
await mkdir(evidence, { recursive: true });
const diagram = JSON.parse((await readFile(new URL('../../docs/sprint-01/fixtures/diagram.json', import.meta.url), 'utf8')).replace(/^\uFEFF/, ''));
const results = [];
try {
  for (const role of ['creador', 'editor', 'vista']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
    const page = await context.newPage();
    const errors = [];
    const writes = [];
    page.on('pageerror', error => errors.push(error.message));
    await context.addInitScript(() => {
      localStorage.setItem('token', 'sprint01-mock-token');
      localStorage.setItem('user', JSON.stringify({ id: 1, correo: 'demo@example.invalid', nombre: 'Demo' }));
      localStorage.setItem('userId', '1');
    });
    await context.route('http://localhost:3000/api/**', async route => {
      const request = route.request();
      if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method())) writes.push(request.url());
      const path = new URL(request.url()).pathname;
      const project = { id: 1, name: 'Demostración aislada', rol: role, creator_id: 1, diagrama_json: diagram,
        colaboradores: [{ usuario: { id: 1, name: 'Demo', email: 'demo@example.invalid' }, rol: role }] };
      const body = path.endsWith('/projects/1') ? { proyecto: project } : path.endsWith('/permissions') ? { permisos: [] } : { invitaciones: [] };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });
    await page.goto(process.env.VALIDATION_UI_URL || 'http://127.0.0.1:5173/diagram/1');
    await page.getByRole('button', { name: '◎ Avisos UML' }).waitFor({ state: 'visible' });
    await page.waitForFunction(() => document.querySelectorAll('.paper-host [model-id]').length >= 3);
    const exportDiagram = async () => {
      const downloadEvent = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Exportar JSON' }).click();
      const download = await downloadEvent;
      return JSON.parse(await readFile(await download.path(), 'utf8'));
    };
    const beforePanel = role !== 'vista' ? await exportDiagram() : null;
    await page.evaluate(async () => {
      const { default: service } = await import('/src/services/socketService.ts');
      const original = service.sendDiagramUpdate.bind(service);
      window.__validationSocketWrites = 0;
      service.sendDiagramUpdate = payload => { window.__validationSocketWrites += 1; return original(payload); };
    });
    const toggle = page.getByRole('button', { name: '◎ Avisos UML' });
    await toggle.click();
    await page.getByText('Datos de ejemplo · No se está analizando el diagrama.', { exact: false }).waitFor();
    assert.equal(await page.locator('.validation-notice').count(), 3);
    assert.deepEqual(await page.locator('.validation-badge').allTextContents(), ['Error', 'Advertencia', 'Recomendación']);
    assert.equal(await page.getByRole('button', { name: /Clases sugeridas|Recomendaciones IA/ }).count(), 0);
    await page.locator('.validation-notice').nth(0).click();
    assert.ok(await page.locator('.paper-host .validation-highlight-error').count() >= 1, 'relation view highlighted');
    assert.match(await page.locator('.validation-missing').innerText(), /2147483647/);
    await page.locator('.validation-notice').nth(1).click();
    assert.equal(await page.locator('.paper-host .validation-highlight-error').count(), 0);
    assert.equal(await page.locator('.paper-host .validation-highlight-warning').count(), 2);
    await page.locator('.validation-notice').nth(2).click();
    assert.match(await page.locator('.validation-detail').innerText(), /domicilio/);
    assert.equal(await page.locator('.paper-host .validation-highlight-warning').count(), 0);
    await page.screenshot({ path: new URL(`panel-${role}.png`, evidence).pathname.replace(/^\/(\w:)/, '$1'), fullPage: true });
    const select = page.getByLabel('Escenario de demostración');
    for (const scenario of ['loading', 'empty', 'partial', 'failed', 'forbidden', 'ready']) {
      await select.selectOption(scenario);
      const expected = scenario === 'partial' ? 2 : scenario === 'ready' ? 3 : 0;
      assert.equal(await page.locator('.validation-notice').count(), expected);
      assert.equal(await page.locator('.paper-host [class*="validation-highlight-"]').count(), 0);
      assert.ok(await page.locator('.validation-demo-banner').isVisible());
    }
    assert.equal(await page.getByRole('button', { name: /^(Aceptar|Rechazar|Aplicar)/ }).count(), 0);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#validation-panel').count(), 0);
    await toggle.click();
    await page.getByRole('button', { name: 'Cerrar panel de avisos' }).click();
    if (beforePanel) assert.deepEqual(await exportDiagram(), beforePanel, 'panel preserves serialized diagram');
    assert.equal(await page.evaluate(() => window.__validationSocketWrites), 0, 'panel emits no diagram updates');
    if (role === 'creador') {
      await toggle.click();
      await page.locator('.validation-notice').nth(1).click();
      const replacement = structuredClone(diagram);
      replacement.classes[0].name = 'Clase reemplazada';
      await page.locator('input[type=file][accept="application/json"]').setInputFiles({ name: 'replacement.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(replacement)) });
      await page.waitForFunction(() => !document.querySelector('.paper-host [class*="validation-highlight-"]'));
      assert.match(await page.locator('.validation-missing').innerText(), /Clase #1/);
      await page.getByRole('button', { name: 'Cerrar panel de avisos' }).click();
    }
    assert.deepEqual(writes, [], 'panel must not persist mocks or modify a project');
    assert.deepEqual(errors, [], 'no uncaught browser errors');
    const generators = [];
    if (role === 'creador') {
      const generatorPage = await context.newPage();
      generatorPage.on('dialog', dialog => dialog.accept());
      for (const [path, button] of [['/generate/1', 'Generar Proyecto Spring Boot'], ['/generate-frontend/1', 'Generar App Flutter']]) {
        const target = new URL(path, process.env.VALIDATION_UI_URL || 'http://127.0.0.1:5173');
        await generatorPage.goto(target.href);
        const downloadEvent = generatorPage.waitForEvent('download');
        await generatorPage.getByRole('button', { name: button, exact: true }).click();
        const download = await downloadEvent;
        const zip = await readFile(await download.path());
        assert.equal(zip.subarray(0, 2).toString(), 'PK');
        assert.ok(zip.length > 1000);
        generators.push({ generator: button, bytes: zip.length });
      }
      await generatorPage.close();
    }
    results.push({ role, result: 'PASS', states: 6, notices: 3, writes: writes.length, pageErrors: errors.length, generators });
    await context.close();
  }
  console.log(JSON.stringify({ ui: results, note: 'Real editor and JointJS; HTTP project data mocked. Socket server not exercised.' }, null, 2));
} finally {
  await browser.close();
}

