import test from 'node:test';
import assert from 'node:assert/strict';
import { parseQuick } from '../js/quick.js';

const people = [{ id: 'p', name: 'Pascal' }, { id: 'a', name: 'Anna' }];
const q = (t) => parseQuick(t, people, 'p');

test('Beispielsatz', () => {
  const r = q('ich habe gerade 5€ für aldi ausgegeben');
  assert.equal(r.amt, 500); assert.equal(r.cat, 'einkauf'); assert.equal(r.note, 'Aldi');
  assert.equal(r.by, null); assert.equal(r.for, null);
});

test('Beträge', () => {
  assert.equal(q('12,50 Euro Rewe').amt, 1250);
  assert.equal(q('5 Euro 50 beim Bäcker').amt, 550);
  assert.equal(q('€ 7.90 Kaffee').amt, 790);
  assert.equal(q('Kino 24').amt, 2400);
  assert.equal(q('2 Pizzen für 23 Euro').amt, 2300, 'Zahl mit Währung gewinnt');
  assert.equal(q('1.250 € Miete').amt, 125000);
  assert.equal(q('nur Text').amt, null);
});

test('Kategorien', () => {
  assert.equal(q('45 Euro Wocheneinkauf').cat, 'einkauf');
  assert.equal(q('800 Euro Miete').cat, 'wohnung');
  assert.equal(q('30 Euro im Baumarkt').cat, 'wohnung');
  assert.equal(q('wir waren Pizza essen für 32 Euro').cat, 'essen');
  assert.equal(q('18 € Kino').cat, 'freizeit');
  assert.equal(q('60 Euro getankt').cat, 'unterwegs');
  assert.equal(q('15 Euro Blumen').cat, null);
  assert.equal(q('15 Euro Blumen').note, 'Blumen');
});

test('Personen und Datum', () => {
  assert.deepEqual(q('20 Euro Geschenk nur für Anna').for, ['a']);
  assert.equal(q('20 Euro Geschenk nur für Anna').note, 'Geschenk');
  assert.deepEqual(q('9 Euro Kaffee für mich').for, ['p']);
  assert.equal(q('Anna hat 40 Euro bei Rewe bezahlt').by, 'a');
  assert.equal(q('Anna hat 40 Euro bei Rewe bezahlt').note, 'Rewe');
  assert.ok(q('gestern 12 Euro Döner').date);
  assert.equal(q('12 Euro Döner').date, null);
});
