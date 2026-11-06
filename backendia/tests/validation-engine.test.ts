import assert from 'node:assert/strict';
import { test } from 'node:test';
import { performance } from 'node:perf_hooks';
import { parseDiagram, diagramKey, hash } from '../src/validation/diagram.js';
import { checkRules, multiplicity } from '../src/validation/rules.js';
import { checkGraph } from '../src/validation/graph.js';
import { parseSemanticResponse, selectSemanticContext } from '../src/validation/semantic.js';
import { ValidationCoordinator } from '../src/validation/coordinator.js';
import type { Diagram, ValidationResult } from '../src/validation/types.js';
import { currentDiagramKey, parseLiveResult } from '../../diagramadoria/src/features/validation/live.js';

const node = (displayId: number, name = `Clase${displayId}`, attributes = [{ name: 'id', type: 'Int' }]) => ({ displayId, name, attributes });
const relation = (id: string, fromDisplayId: number, toDisplayId: number, type = 'asociacion', originCard = '1', destCard = '*') => ({ id, fromDisplayId, toDisplayId, type, originCard, destCard, verb: '' });
const tick = () => new Promise(resolve => setTimeout(resolve, 15));

test('R07: reversed category/product multiplicities are a contextual recommendation in either drawing order', () => {
  const classes = [node(1, 'Categoría'), node(2, 'Producto')];
  for (const link of [relation('r', 1, 2, 'asociacion', '1..*', '1..1'), relation('r', 2, 1, 'asociacion', '1..1', '1..*')]) {
    const result = checkRules({ classes, relations: [link] });
    assert.equal(result[0]?.ruleCode, 'R07');
    assert.equal(result[0]?.severity, 'recommendation');
    assert.deepEqual(result[0]?.affected, [{ kind: 'relation', id: 'r' }]);
  }
  for (const products of ['1..*', '0..*']) {
    assert.deepEqual(checkRules({ classes, relations: [relation('r', 1, 2, 'asociacion', '1..1', products)] }), []);
  }
});

test('R01: multiplicities, defaults and large integers', () => {
  for (const value of ['', '1', '*', '0..*', '1..5', '999999999999999999999']) assert.ok(multiplicity(value), value);
  for (const value of ['3..1', '-1..*', '1.5', 'uno', '1..', '*..*']) assert.equal(multiplicity(value), null, value);
  assert.equal(checkRules({ classes: [node(1), node(2)], relations: [relation('r', 1, 2, 'herencia', 'invalid')] }).length, 0);
});
test('R02/R03/R04: invalid type, dangling endpoints and contextual many-to-many', () => {
  const findings = checkRules({ classes: [node(1), node(2)], relations: [relation('bad', 1, 99, 'xyz'), relation('many', 1, 2, 'asociacion', '*', '2..*')] });
  assert.deepEqual(findings.map(item => item.ruleCode), ['R02', 'R03', 'R04']);
  assert.equal(findings[2]?.severity, 'recommendation');
  assert.ok(findings.every(item => item.explanation && item.recommendation));
});
test('R05: grouped duplicates, accents, per-class attribute scope and distinct names', () => {
  const findings = checkRules({ classes: [node(1, 'Dirección', [{ name: 'Nombre', type: 'String' }, { name: 'nombre', type: 'String' }]), node(2, 'direccion'), node(3, 'DIRECCION'), node(4)], relations: [] });
  assert.equal(findings.length, 2);
  assert.equal(findings[0]?.affected.length, 3);
  assert.equal(checkRules({ classes: [node(1), node(2)], relations: [] }).length, 0);
});
test('G01: full directed cycle path, separate types, self cycle, composition warning', () => {
  const classes = [node(1), node(2), node(3)];
  const cycle = checkGraph({ classes, relations: [relation('a', 1, 2, 'herencia'), relation('b', 2, 3, 'herencia'), relation('c', 3, 1, 'herencia')] });
  assert.equal(cycle.length, 1); assert.match(cycle[0]!.explanation, /1 → 2 → 3 → 1/);
  assert.equal(cycle[0]!.affected.length, 6);
  assert.equal(checkGraph({ classes, relations: [relation('a', 1, 2, 'herencia'), relation('b', 2, 1, 'asociacion')] }).filter(item => item.ruleCode === 'G01').length, 0);
  assert.equal(checkGraph({ classes: [node(1)], relations: [relation('self', 1, 1, 'composicion')] })[0]?.severity, 'warning');
});
test('G02/G03: undirected connectivity, small-diagram exception, no duplicate isolation', () => {
  for (const classes of [[], [node(1)]]) assert.deepEqual(checkGraph({ classes, relations: [] }), []);
  const findings = checkGraph({ classes: [node(1), node(2), node(3), node(4), node(5)], relations: [relation('a', 2, 1), relation('b', 4, 3)] });
  assert.deepEqual(findings.map(item => item.ruleCode), ['G03', 'G03', 'G02']);
  assert.ok(findings.every(item => item.severity === 'warning'));
});
test('parsing and shared UI projection ignore layout and preserve meaning', () => {
  const diagram = { classes: [node(2), node(1)], relations: [relation('z', 1, 2)], position: { x: 20 } };
  const parsed = parseDiagram(JSON.stringify(diagram));
  const key = currentDiagramKey(diagram.classes.map(item => ({ ...item, attributes: item.attributes.map(attribute => `${attribute.name}: ${attribute.type}`) })), diagram.relations);
  assert.equal(key, diagramKey(parsed));
  assert.equal(hash(key), hash(diagramKey(parseDiagram({ ...diagram, position: { x: 999 } }))));
  assert.throws(() => parseDiagram({ classes: [node(1), node(1)], relations: [] }));
  assert.throws(() => parseDiagram({ classes: Array.from({ length: 501 }, (_, i) => node(i + 1)), relations: [] }));
});
test('S01-S05: bounded candidates and rejection of invented references', () => {
  const diagram: Diagram = { classes: [node(1, 'Cliente', [{ name: 'domicilio', type: 'String' }, { name: 'direccion_envio', type: 'String' }])], relations: [] };
  const context = selectSemanticContext(diagram);
  assert.equal(context.classes.length, 1);
  assert.equal(selectSemanticContext({ classes: [node(1)], relations: [] }).classes.length, 0);
  const suggestion = { ruleCode: 'S02', title: 'Revisar direcciones', explanation: 'Pueden tener usos distintos.', recommendation: 'Confirma el significado.', certainty: 'low', references: [{ kind: 'attribute', displayId: 1, name: 'domicilio', id: null }] };
  assert.equal(parseSemanticResponse({ suggestions: [suggestion] }, context)[0]?.severity, 'recommendation');
  assert.throws(() => parseSemanticResponse({ suggestions: [{ ...suggestion, references: [{ kind: 'class', displayId: 999 }] }] }, context));
  assert.throws(() => parseSemanticResponse({ suggestions: [{ ...suggestion, ruleCode: 'R05' }] }, context));
  const large = selectSemanticContext({ classes: Array.from({ length: 40 }, (_, i) => node(i + 1, 'Cliente', Array.from({ length: 30 }, (_, j) => ({ name: `${j}${'x'.repeat(180)}`, type: 'String' })))), relations: [] });
  assert.ok(large.truncated); assert.ok(JSON.stringify(large.classes).length < 25000);
});
test('orchestration: coalescing, layout cache, partial failure and UI contract', async () => {
  let diagram = { classes: [node(1, 'Cliente', [{ name: 'a', type: 'String' }, { name: 'b', type: 'String' }]), node(2)], relations: [] };
  let calls = 0;
  const saves: ValidationResult[] = [];
  const coordinator = new ValidationCoordinator({ readDiagram: async () => diagram, readCached: async () => null, save: async result => { saves.push(result); } }, async () => {}, async () => { calls++; throw new Error('unavailable'); });
  await Promise.all([coordinator.current(1, 1), coordinator.current(1, 2), coordinator.current(1, 3)]);
  await tick();
  const result = await coordinator.current(1, 1);
  assert.equal(calls, 1); assert.equal(result.status, 'partial'); assert.equal(result.notices.length, 2);
  assert.equal(parseLiveResult(result, '1').notices.length, 2);
  assert.throws(() => parseLiveResult(result, '2'));
  coordinator.schedule(1, 1, { ...diagram, layout: 'changed' });
  await coordinator.current(1, 1); assert.equal(calls, 1);
  diagram = { classes: [node(1)], relations: [] };
  coordinator.schedule(1, 1, diagram); await coordinator.current(1, 1); await tick();
  assert.equal((await coordinator.current(1, 1)).status, 'ready');
  assert.ok(saves.length >= 2);
  coordinator.dispose();
});
test('orchestration: a late semantic response cannot replace a newer snapshot', async () => {
  let diagram = { classes: [node(1, 'Cliente', [{ name: 'a', type: 'String' }, { name: 'b', type: 'String' }])], relations: [] };
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const published: ValidationResult[] = [];
  const coordinator = new ValidationCoordinator({ readDiagram: async () => diagram, readCached: async () => null, save: async () => {} }, async result => { published.push(result); }, async () => { await pending; return []; });
  const first = await coordinator.current(1, 1); await tick();
  diagram = { classes: [node(1)], relations: [] };
  coordinator.schedule(1, 1, diagram);
  const second = await coordinator.current(1, 1); release(); await tick();
  assert.notEqual(first.snapshotId, second.snapshotId);
  assert.equal(published.filter(item => item.snapshotId === first.snapshotId && item.status !== 'loading').length, 0);
  coordinator.dispose();
});
test('500 classes / 2000 edges run without recursion overflow', () => {
  const classes = Array.from({ length: 500 }, (_, i) => node(i + 1));
  const relations = Array.from({ length: 2000 }, (_, i) => relation(String(i), i % 499 + 1, i % 499 + 2, i < 499 ? 'herencia' : 'asociacion'));
  const start = performance.now();
  checkRules({ classes, relations }); checkGraph({ classes, relations });
  const elapsed = performance.now() - start;
  console.log(`Deterministic engine benchmark: ${elapsed.toFixed(1)} ms (500 classes, 2000 relations)`);
  assert.ok(elapsed < 1500);
});

test('persistent complete results avoid another semantic request after restart', async () => {
  const diagram = { classes: [node(1, 'Cliente', [{ name: 'a', type: 'String' }, { name: 'b', type: 'String' }])], relations: [] };
  let saved: ValidationResult | null = null;
  const repository = { readDiagram: async () => diagram, readCached: async () => saved, save: async (result: ValidationResult) => { saved = result; } };
  let calls = 0;
  const analyzer = async () => { calls++; return []; };
  const first = new ValidationCoordinator(repository, async () => {}, analyzer);
  await first.current(1, 1); await tick(); first.dispose();
  const second = new ValidationCoordinator(repository, async () => {}, analyzer);
  assert.equal((await second.current(1, 1)).status, 'ready');
  assert.equal(calls, 1);
  second.dispose();
});

test('semantic concurrency is bounded and excess work preserves deterministic findings', async () => {
  const diagram = { classes: [node(1, 'Cliente', [{ name: 'a', type: 'String' }, { name: 'b', type: 'String' }]), node(2)], relations: [] };
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  let calls = 0;
  const coordinator = new ValidationCoordinator({ readDiagram: async () => diagram, readCached: async () => null, save: async () => {} }, async () => {}, async () => { calls++; await pending; return []; });
  try {
    for (let id = 1; id <= 5; id++) await coordinator.current(id, 1);
    await tick();
    assert.equal(calls, 4);
    const excess = await coordinator.current(5, 1);
    assert.equal(excess.status, 'partial'); assert.equal(excess.notices.length, 2);
    release(); await tick();
    assert.equal((await coordinator.current(1, 1)).status, 'ready');
  } finally { release(); coordinator.dispose(); }
});

test('storage failure is reported as partial without losing rule findings', async () => {
  const coordinator = new ValidationCoordinator({ readDiagram: async () => ({ classes: [node(1), node(2)], relations: [] }), readCached: async () => null,
    save: async () => { throw new Error('database unavailable'); } });
  const result = await coordinator.current(1, 1);
  assert.equal(result.status, 'partial'); assert.equal(result.notices.length, 2);
  assert.match(result.message, /guardar/);
  coordinator.dispose();
});
