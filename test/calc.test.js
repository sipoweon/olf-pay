import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAmount, fmt, shares, balances, settle, stats, months } from '../js/calc.js';

test('parseAmount', () => {
  assert.equal(parseAmount('12,50'), 1250);
  assert.equal(parseAmount('12.5'), 1250);
  assert.equal(parseAmount('12'), 1200);
  assert.equal(parseAmount('1.234,56'), 123456);
  assert.equal(parseAmount('1,234.56'), 123456);
  assert.equal(parseAmount('1.234'), 123400);
  assert.equal(parseAmount('0,99 €'), 99);
  assert.equal(parseAmount('19,99'), 1999);
  assert.equal(parseAmount(''), null);
  assert.equal(parseAmount('abc'), null);
  assert.equal(parseAmount('0'), null);
});

test('fmt', () => {
  assert.equal(fmt(1250), '12,50 €');
  assert.equal(fmt(123456), '1.234,56 €');
  assert.equal(fmt(-5), '−0,05 €');
});

test('shares verteilt Rest-Cents', () => {
  assert.deepEqual(shares({ amt: 1000, for: { a: true, b: true, c: true } }), { a: 334, b: 333, c: 333 });
  assert.deepEqual(shares({ amt: 999, for: { a: true } }), { a: 999 });
});

const ev = {
  members: { a: { name: 'Pascal' }, b: { name: 'Anna' }, c: { name: 'Tom' } },
  expenses: {
    x1: { amt: 6000, cat: 'einkauf', by: 'a', for: { a: true, b: true }, date: '2026-10-03', ts: 1 },
    x2: { amt: 3000, cat: 'essen', by: 'b', for: { a: true, b: true, c: true }, date: '2026-11-01', ts: 2 },
    x3: { amt: 1000, cat: 'essen', by: 'c', for: { b: true }, date: '2026-11-02', ts: 3 },
  },
};

test('balances summieren sich zu 0', () => {
  const bal = balances(ev);
  assert.deepEqual(bal, { a: 2000, b: -2000, c: 0 });
  assert.equal(Object.values(bal).reduce((s, v) => s + v, 0), 0);
});

test('settle + Ausgleichszahlung', () => {
  assert.deepEqual(settle(balances(ev)), [{ from: 'b', to: 'a', amount: 2000 }]);
  const paid = { ...ev, expenses: { ...ev.expenses, t: { type: 'transfer', amt: 2000, by: 'b', to: 'a', date: '2026-11-03', ts: 4 } } };
  assert.deepEqual(settle(balances(paid)), []);
  assert.equal(stats(paid).total, 10000, 'Ausgleich zählt nicht als Ausgabe');
});

test('settle mit mehreren Personen', () => {
  const tx = settle({ a: 5000, b: -3000, c: -2500, d: 500 });
  assert.equal(tx.reduce((s, t) => s + t.amount, 0), 5500);
  assert.ok(tx.length <= 3);
});

test('stats und months', () => {
  assert.deepEqual(months(ev), ['2026-11', '2026-10']);
  const nov = stats(ev, '2026-11');
  assert.equal(nov.total, 4000);
  assert.deepEqual(nov.byCat, { essen: 4000 });
  assert.deepEqual(nov.paid, { b: 3000, c: 1000 });
  assert.deepEqual(nov.share, { a: 1000, b: 2000, c: 1000 });
  assert.deepEqual(stats(ev).byMonth, { '2026-10': 6000, '2026-11': 4000 });
});
