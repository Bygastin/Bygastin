// Pruebas de la lógica: node --test demos/cuentas-claras/test/*.test.js
const test = require('node:test');
const assert = require('node:assert');
const CC = require('../logic.js');

const now = 1700000000000;
const mk = (items) => ({ id: 'grupo1', name: 'Viaje', cur: 'ARS', u: now,
  members: ['ana1', 'beto', 'caro'].map(id => ({ id, n: id, u: now })), items });
const g = (id, by, a, to, u = now) => ({ id, t: 'g', d: id, a, by, to, at: now, u });

test('parseAmount entiende formatos argentinos y comunes', () => {
  assert.strictEqual(CC.parseAmount('1.234,56'), 123456);
  assert.strictEqual(CC.parseAmount('1234.5'), 123450);
  assert.strictEqual(CC.parseAmount('1.500'), 150000);
  assert.strictEqual(CC.parseAmount('1.500.000'), 150000000);
  assert.strictEqual(CC.parseAmount('$ 2000'), 200000);
  assert.strictEqual(CC.parseAmount('0'), null);
  assert.strictEqual(CC.parseAmount('abc'), null);
  assert.strictEqual(CC.parseAmount('-5'), null);
});

test('el reparto no pierde centavos', () => {
  const parts = CC.splitCents(1000, ['a', 'b', 'c']);
  assert.deepStrictEqual(parts.map(p => p[1]), [334, 333, 333]);
});

test('saldos suman cero y el plan los deja en cero', () => {
  const grp = mk([g('gas1', 'ana1', 9000, ['ana1', 'beto', 'caro']), g('gas2', 'beto', 1001, ['beto', 'caro'])]);
  const bal = CC.balances(grp);
  assert.strictEqual(Object.values(bal).reduce((s, v) => s + v, 0), 0);
  const plan = CC.settle(bal);
  for (const p of plan) { bal[p.from] += p.a; bal[p.to] -= p.a; }
  assert.ok(Object.values(bal).every(v => v === 0));
  assert.ok(plan.length <= 2);
});

test('un pago registrado salda la deuda', () => {
  const grp = mk([g('gas1', 'ana1', 3000, ['ana1', 'beto', 'caro']),
    { id: 'pag1', t: 'p', d: '', a: 1000, by: 'beto', to: ['ana1'], at: now, u: now }]);
  const plan = CC.settle(CC.balances(grp));
  assert.deepStrictEqual(plan, [{ from: 'caro', to: 'ana1', a: 1000 }]);
});

test('los borrados no cuentan', () => {
  const grp = mk([{ ...g('gas1', 'ana1', 3000, ['beto']), x: 1 }]);
  assert.deepStrictEqual(CC.settle(CC.balances(grp)), []);
});

test('merge junta gastos de los dos celus y gana la edición más nueva', () => {
  const a = mk([g('gas1', 'ana1', 100, ['beto']), g('gas2', 'ana1', 200, ['beto'])]);
  const b = mk([g('gas1', 'ana1', 150, ['beto'], now + 5), g('gas3', 'caro', 300, ['ana1'])]);
  const r = CC.merge(a, b);
  const byId = Object.fromEntries(r.group.items.map(i => [i.id, i]));
  assert.strictEqual(r.group.items.length, 3);
  assert.strictEqual(byId.gas1.a, 150);
  assert.strictEqual(r.added, 1);
  assert.strictEqual(r.updated, 1);
  // combinar dos veces da lo mismo
  assert.deepStrictEqual(CC.merge(r.group, b).group, r.group);
});

test('validateGroup rechaza datos tramposos', () => {
  assert.throws(() => CC.validateGroup({ ...mk([g('gas1', 'nadie', 100, ['beto'])]) }));
  assert.throws(() => CC.validateGroup({ ...mk([g('gas1', 'ana1', -1, ['beto'])]) }));
  assert.throws(() => CC.validateGroup({ ...mk([]), id: '<img>' }));
  const ok = CC.validateGroup(mk([g('gas1', 'ana1', 100, ['beto'])]));
  assert.strictEqual(ok.items.length, 1);
});

test('el link ida y vuelta devuelve el mismo grupo', async () => {
  const grp = mk([g('gas1', 'ana1', 9000, ['ana1', 'beto', 'caro'])]);
  grp.name = 'Viaje a Bariloche ñandú 🏔️';
  const code = await CC.encodeGroup(grp);
  assert.ok(/^[zj][A-Za-z0-9_-]+$/.test(code));
  assert.strictEqual(CC.codeFromLink('https://x.io/app/#g=' + code), code);
  assert.deepStrictEqual(await CC.decodeGroup(code), grp);
});
