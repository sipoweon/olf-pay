// Reine Rechenlogik – ohne DOM, damit sie mit `node --test` prüfbar ist.
// Alle Beträge sind ganze Cent.

/** "12,50" | "12.5" | "1.234,56" | "12" -> Cent (oder null, wenn ungültig) */
export function parseAmount(input) {
  let s = String(input ?? '').replace(/[\s€]/g, '');
  if (!s || !/^[\d.,]+$/.test(s)) return null;
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  if (lastDot >= 0 && lastComma >= 0) {
    const dec = lastDot > lastComma ? '.' : ',';
    const thou = dec === '.' ? ',' : '.';
    s = s.split(thou).join('').replace(dec, '.');
  } else if (lastDot >= 0 || lastComma >= 0) {
    const sep = lastDot >= 0 ? '.' : ',';
    const parts = s.split(sep);
    const isThousands = parts.length > 2 || (parts[1].length === 3 && parts[0] !== '0' && parts[0] !== '');
    s = isThousands ? parts.join('') : parts.join('.');
  }
  const n = Number(s);
  if (!isFinite(n)) return null;
  const cents = Math.round(n * 100);
  return cents > 0 ? cents : null;
}

export function fmt(cents) {
  const neg = cents < 0;
  const abs = Math.abs(cents);
  const euros = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${neg ? '−' : ''}${euros},${String(abs % 100).padStart(2, '0')} €`;
}

/** Für das Eingabefeld beim Bearbeiten: 1250 -> "12,50" */
export function fmtInput(cents) {
  return `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, '0')}`;
}

export function memberIds(event) {
  return Object.keys(event?.members || {}).sort();
}

export function expenseList(event) {
  return Object.entries(event?.expenses || {})
    .filter(([, e]) => e && typeof e.amt === 'number')
    .map(([id, e]) => ({ id, ...e }))
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.ts || 0) - (a.ts || 0));
}

/** Anteil pro Person für eine Ausgabe. Rest-Cents gehen reihum an die ersten Personen. */
export function shares(exp) {
  const ids = Object.keys(exp.for || {}).filter((k) => exp.for[k]).sort();
  const out = {};
  if (!ids.length) return out;
  const base = Math.floor(exp.amt / ids.length);
  let rest = exp.amt - base * ids.length;
  for (const id of ids) {
    out[id] = base + (rest > 0 ? 1 : 0);
    rest--;
  }
  return out;
}

/** Saldo pro Person: positiv = bekommt Geld, negativ = schuldet Geld. */
export function balances(event) {
  const bal = {};
  for (const id of memberIds(event)) bal[id] = 0;
  const add = (id, v) => { bal[id] = (bal[id] || 0) + v; };
  for (const e of expenseList(event)) {
    if (e.type === 'transfer') {
      if (!e.by || !e.to) continue;
      add(e.by, e.amt);
      add(e.to, -e.amt);
      continue;
    }
    const sh = shares(e);
    if (!e.by || !Object.keys(sh).length) continue;
    add(e.by, e.amt);
    for (const [id, v] of Object.entries(sh)) add(id, -v);
  }
  return bal;
}

/** Möglichst wenige Überweisungen, um alle Salden auszugleichen. */
export function settle(bal) {
  const debt = [], cred = [];
  for (const [id, v] of Object.entries(bal)) {
    if (v < 0) debt.push({ id, v: -v });
    else if (v > 0) cred.push({ id, v });
  }
  const bySize = (a, b) => b.v - a.v || a.id.localeCompare(b.id);
  debt.sort(bySize); cred.sort(bySize);
  const out = [];
  let i = 0, j = 0;
  while (i < debt.length && j < cred.length) {
    const amount = Math.min(debt[i].v, cred[j].v);
    out.push({ from: debt[i].id, to: cred[j].id, amount });
    debt[i].v -= amount; cred[j].v -= amount;
    if (!debt[i].v) i++;
    if (!cred[j].v) j++;
  }
  return out;
}

/** Monate (YYYY-MM) mit Ausgaben, neueste zuerst. */
export function months(event) {
  const set = new Set();
  for (const e of expenseList(event)) if (e.type !== 'transfer' && e.date) set.add(e.date.slice(0, 7));
  return [...set].sort().reverse();
}

/** Auswertung für einen Monat ("YYYY-MM") oder insgesamt ("all"). Ausgleichszahlungen zählen nicht mit. */
export function stats(event, month = 'all') {
  const res = { total: 0, count: 0, byCat: {}, paid: {}, share: {}, byMonth: {} };
  for (const e of expenseList(event)) {
    if (e.type === 'transfer') continue;
    const m = (e.date || '').slice(0, 7);
    res.byMonth[m] = (res.byMonth[m] || 0) + e.amt;
    if (month !== 'all' && m !== month) continue;
    res.total += e.amt;
    res.count++;
    const cat = e.cat || 'sonstiges';
    res.byCat[cat] = (res.byCat[cat] || 0) + e.amt;
    if (e.by) res.paid[e.by] = (res.paid[e.by] || 0) + e.amt;
    for (const [id, v] of Object.entries(shares(e))) res.share[id] = (res.share[id] || 0) + v;
  }
  return res;
}

export function today(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function randomId(len = 20) {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  let s = '';
  for (const b of bytes) s += ALPHABET[b % ALPHABET.length];
  return s;
}

/** Zeitlich sortierbare ID für Personen und Ausgaben. */
export function uid() {
  return Date.now().toString(36).padStart(9, '0') + randomId(5);
}
