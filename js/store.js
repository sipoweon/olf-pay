// Datenhaltung: lokal im Browser (localStorage) und – wenn in config.js eine
// Firebase-URL steht – live synchronisiert über die Firebase-REST-Schnittstelle.
// Kein SDK, kein Login: wer den Event-Link kennt, kann mitmachen.

import { FIREBASE_DB_URL } from '../config.js';

const DB = (FIREBASE_DB_URL || '').trim().replace(/\/+$/, '');
export const syncEnabled = !!DB;

const ls = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v == null ? fallback : JSON.parse(v);
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* voll oder gesperrt */ }
  },
  del(key) { try { localStorage.removeItem(key); } catch { /* egal */ } },
};

const K = { last: 'hh.last', known: 'hh.events', outbox: 'hh.outbox', name: 'hh.name', cache: (id) => 'hh.e.' + id };

const clone = (v) => (v == null ? v : JSON.parse(JSON.stringify(v)));

/** Setzt einen Wert an einem "a/b/c"-Pfad; null löscht. Gibt die (evtl. neue) Wurzel zurück. */
export function setPath(root, path, value) {
  const parts = path.split('/').filter(Boolean);
  if (!parts.length) return value;
  if (!root || typeof root !== 'object') root = {};
  let o = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (!o[p] || typeof o[p] !== 'object') {
      if (value === null) return root;
      o[p] = {};
    }
    o = o[p];
  }
  const last = parts[parts.length - 1];
  if (value === null) delete o[last]; else o[last] = value;
  return root;
}

const applyUpdates = (root, updates) => {
  for (const [path, value] of Object.entries(updates)) root = setPath(root, path, value);
  return root;
};

let known = ls.get(K.known, []);
let outbox = ls.get(K.outbox, []);
const view = {};     // id -> das, was die App anzeigt (Server-Stand + noch nicht gesendete Änderungen)
const server = {};   // id -> letzter bekannter Server-Stand
const loaded = {};   // id -> Server hat mindestens einmal geantwortet
const listeners = new Set();
let source = null, openId = null, connected = false, flushing = false, retryTimer = null;

const emit = () => listeners.forEach((fn) => fn());
const saveOutbox = () => ls.set(K.outbox, outbox);

function rebuild(id) {
  let v = clone(server[id]);
  for (const op of outbox) if (op.id === id) v = applyUpdates(v, clone(op.updates));
  view[id] = v ?? null;
  if (v) ls.set(K.cache(id), v);
}

async function flush() {
  if (!syncEnabled || flushing) return;
  flushing = true;
  clearTimeout(retryTimer);
  try {
    while (outbox.length) {
      const op = outbox[0];
      const res = await fetch(`${DB}/events/${op.id}.json`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(op.updates),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      outbox.shift();
      saveOutbox();
      if (loaded[op.id]) server[op.id] = applyUpdates(server[op.id], clone(op.updates));
      emit();
    }
  } catch {
    retryTimer = setTimeout(flush, 8000);
  } finally {
    flushing = false;
  }
}

if (syncEnabled && typeof window !== 'undefined') {
  window.addEventListener('online', flush);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) flush(); });
  flush();
}

export const store = {
  syncEnabled,

  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },

  /** Events, die dieses Gerät kennt: [{ id, me }] */
  known() { return known; },
  me(id) { return known.find((k) => k.id === id)?.me || null; },
  remember(id, me) {
    const k = known.find((x) => x.id === id);
    if (k) { if (me !== undefined) k.me = me; }
    else known.unshift({ id, me: me || null });
    ls.set(K.known, known);
    emit();
  },
  forget(id) {
    known = known.filter((k) => k.id !== id);
    ls.set(K.known, known);
    ls.del(K.cache(id));
    delete view[id];
    emit();
  },

  /** Zuletzt geöffnetes Event – damit die App beim Start direkt dort landet. */
  lastEvent() {
    const id = ls.get(K.last, null);
    return known.some((k) => k.id === id) ? id : null;
  },
  setLastEvent(id) { ls.set(K.last, id); },

  myName() { return ls.get(K.name, ''); },
  setMyName(name) { ls.set(K.name, name); },

  /** Aktueller Stand eines Events: Objekt, null (gibt es nicht) oder undefined (lädt noch). */
  get(id) {
    if (!(id in view)) {
      const cached = ls.get(K.cache(id), undefined);
      if (cached !== undefined) view[id] = cached;
    }
    return view[id];
  },
  isLoaded(id) { return !syncEnabled || !!loaded[id]; },

  /** Live-Verbindung zu einem Event öffnen (immer nur eins gleichzeitig). */
  open(id) {
    if (!syncEnabled || openId === id) return;
    this.close();
    openId = id;
    source = new EventSource(`${DB}/events/${id}.json`);
    const onData = (isPatch) => (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (!msg) return;
      if (isPatch) {
        for (const [k, v] of Object.entries(msg.data || {})) server[id] = setPath(server[id], `${msg.path}/${k}`, v);
      } else {
        server[id] = setPath(server[id], msg.path, msg.data);
      }
      loaded[id] = true;
      rebuild(id);
      emit();
    };
    source.addEventListener('put', onData(false));
    source.addEventListener('patch', onData(true));
    source.onopen = () => { connected = true; flush(); emit(); };
    source.onerror = () => { connected = false; emit(); };
  },
  close() {
    if (source) source.close();
    source = null; openId = null; connected = false;
  },

  /** Änderung schreiben. updates: { "expenses/abc": {...}, "members/x/name": "Anna", "expenses/alt": null } */
  patch(id, updates) {
    if (syncEnabled) {
      outbox.push({ id, updates });
      saveOutbox();
      view[id] = applyUpdates(clone(this.get(id)), clone(updates));
      ls.set(K.cache(id), view[id]);
      emit();
      flush();
    } else {
      view[id] = applyUpdates(clone(this.get(id)), clone(updates));
      ls.set(K.cache(id), view[id]);
      emit();
    }
  },

  /** 'local' | 'synced' | 'pending' | 'offline' */
  status() {
    if (!syncEnabled) return 'local';
    if (outbox.length) return 'pending';
    return connected || !openId ? 'synced' : 'offline';
  },
};
