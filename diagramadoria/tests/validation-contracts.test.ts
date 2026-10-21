import assert from 'node:assert/strict';
import test from 'node:test';
import { parseNotices, sortNotices, referenceLabel } from '../src/features/validation/contracts';
import { createMockNotices } from '../src/features/validation/mocks/mockNoticeProvider';

const fixtures = () => createMockNotices('42', { classes: [{ displayId: 1, name: 'Cliente' }, { displayId: 2, name: 'Factura' }], relations: [{ id: 'link-1' }] });

test('mock provider returns all origins and severities without changing context', () => {
  const context = { classes: [{ displayId: 1, name: 'Cliente' }], relations: [{ id: 'link-1' }] };
  const before = JSON.stringify(context);
  const notices = createMockNotices('42', context);
  assert.equal(JSON.stringify(context), before);
  assert.deepEqual(new Set(notices.map(notice => notice.origin)), new Set(['rules', 'graph', 'semantic']));
  assert.ok(notices.every(notice => notice.projectId === '42' && notice.title.startsWith('Ejemplo:')));
});

test('sort is deterministic, severity first, then rule code and id; does not mutate input', () => {
  const notices = fixtures().reverse();
  const originalIds = notices.map(notice => notice.id);
  assert.deepEqual(sortNotices(notices).map(notice => notice.severity), ['error', 'warning', 'recommendation']);
  assert.deepEqual(notices.map(notice => notice.id), originalIds);
  const base = notices[0];
  assert.ok(base);
  const ties = [{ ...base, ruleCode: 'Z', id: 'a' }, { ...base, ruleCode: 'A', id: 'z' }, { ...base, ruleCode: 'A', id: 'a' }];
  assert.deepEqual(sortNotices(ties).map(notice => notice.id), ['a', 'z', 'a']);
});

test('contract rejects malformed, duplicate, invalid-date and unsupported notices', () => {
  const notice = fixtures()[0];
  assert.throws(() => parseNotices({}), /lista/);
  assert.throws(() => parseNotices([null]), /inválido/);
  for (const change of [{ severity: 'critical' }, { createdAt: 'invalid' }, { affected: [] }, { affected: [{ kind: 'class', displayId: -1 }] }, { affected: [{ kind: 'relation', id: '' }] }, { explanation: '' }, { origin: 'unknown' }]) {
    assert.throws(() => parseNotices([{ ...notice, ...change }]), /contrato/);
  }
  assert.throws(() => parseNotices([notice, notice]), /duplicados/);
});

test('empty diagram still yields explicitly fictitious, unresolvable references', () => {
  const notices = createMockNotices('42', { classes: [], relations: [] });
  assert.equal(notices.length, 3);
  assert.match(referenceLabel(notices[0]!.affected[0]!), /Relación/);
  assert.match(referenceLabel({ kind: 'attribute', displayId: 1, name: 'domicilio' }), /domicilio/);
});
