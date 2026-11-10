import { store } from './store.js';
import * as C from './calc.js';
import { otter } from './otter.js';
import { parseQuick } from './quick.js';

const CATS = [
  { id: 'einkauf', emoji: '🛒', name: 'Einkauf' },
  { id: 'wohnung', emoji: '🏠', name: 'Wohnung' },
  { id: 'essen', emoji: '🍝', name: 'Essen gehen' },
  { id: 'freizeit', emoji: '🎬', name: 'Freizeit' },
  { id: 'unterwegs', emoji: '🚆', name: 'Unterwegs' },
  { id: 'sonstiges', emoji: '✨', name: 'Sonstiges' },
];
const cat = (id) => CATS.find((c) => c.id === id) || CATS[CATS.length - 1];

const EMOJIS = ['🦦', '🏝️', '🚀', '🏠', '🎉', '🏔️', '🚗', '🍕', '❤️'];
const TEMPLATES = [
  { name: 'Alltag', emoji: '🦦' },
  { name: 'Urlaub', emoji: '🏝️' },
  { name: 'Projekt X', emoji: '🚀' },
];

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const viewEl = $('#view');
const sheetEl = $('#sheet');
const toastEl = $('#toast');

let route = { page: 'home' };
let statsMonth = 'all';
let askedWho = false;
let F = null; // Zustand des offenen Formulars
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null; // laufende Spracherkennung

// ---------- kleine Helfer ----------

const members = (ev) => C.memberIds(ev).map((id, i) => ({ id, name: ev.members[id]?.name || 'Jemand', color: (i % 6) + 1 }));
const nameOf = (ev, id) => ev.members?.[id]?.name || 'Jemand';
const avatar = (m, small = false) => `<span class="avatar p${m.color}${small ? ' sm' : ''}" aria-hidden="true">${esc(m.name.trim().charAt(0).toUpperCase() || '?')}</span>`;
const eventUrl = (id) => `${location.origin}${location.pathname}#/e/${id}`;

function monthLabel(m, short = false) {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString('de-DE', { month: short ? 'short' : 'long', year: 'numeric' });
}

function dayLabel(date) {
  const now = new Date();
  if (date === C.today(now)) return 'Heute';
  const y = new Date(now); y.setDate(y.getDate() - 1);
  if (date === C.today(y)) return 'Gestern';
  const d = new Date(date + 'T12:00:00');
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long', ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) });
}

function forLabel(ev, exp) {
  const ids = Object.keys(exp.for || {}).filter((k) => exp.for[k]);
  const all = C.memberIds(ev);
  if (ids.length === all.length && all.length > 1) return all.length === 2 ? 'geteilt' : 'für alle';
  return 'für ' + ids.map((id) => nameOf(ev, id)).join(', ');
}

let toastTimer;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.hidden = true; }, 2200);
}

// ---------- Routing ----------

function parseRoute() {
  const m = location.hash.match(/^#\/e\/([A-Za-z0-9]{8,})(?:\/(stats))?/);
  return m ? { page: 'event', id: m[1], tab: m[2] || 'list' } : { page: 'home' };
}

function onRoute() {
  const prev = route;
  route = parseRoute();
  if (route.page === 'event') {
    if (prev.id !== route.id) { statsMonth = 'all'; askedWho = false; }
    store.open(route.id);
    store.setLastEvent(route.id);
  } else {
    store.close();
  }
  if (prev.page !== route.page || prev.id !== route.id) { closeSheet(); window.scrollTo(0, 0); }
  update();
}

function update() {
  if (route.page === 'event') {
    const ev = store.get(route.id);
    if (ev?.meta) {
      if (!store.known().some((k) => k.id === route.id)) { store.remember(route.id, null); return; }
      const me = store.me(route.id);
      if ((!me || !ev.members?.[me]) && !askedWho && sheetEl.hidden) { askedWho = true; openWho(); }
    }
    viewEl.innerHTML = eventView(ev);
  } else {
    viewEl.innerHTML = homeView();
  }
}

// ---------- Startseite ----------

function homeView() {
  const cards = store.known().map((k) => {
    const ev = store.get(k.id);
    if (!ev?.meta) return `<a class="event-card" href="#/e/${k.id}"><span class="emoji">🦦</span><span class="grow"><b>Event</b><small>antippen zum Laden</small></span></a>`;
    const bal = C.balances(ev)[k.me] || 0;
    const n = C.expenseList(ev).filter((e) => e.type !== 'transfer').length;
    const pill = !k.me ? '' : bal > 0 ? `<span class="pill plus">+${C.fmt(bal)}</span>` : bal < 0 ? `<span class="pill minus">${C.fmt(bal)}</span>` : `<span class="pill">quitt</span>`;
    return `<a class="event-card" href="#/e/${k.id}">
      <span class="emoji">${esc(ev.meta.emoji || '🦦')}</span>
      <span class="grow"><b>${esc(ev.meta.name)}</b><small>${members(ev).map((m) => esc(m.name)).join(', ')} · ${n} ${n === 1 ? 'Ausgabe' : 'Ausgaben'}</small></span>
      ${pill}</a>`;
  }).join('');

  return `<header class="hero">
      ${otter({ mood: 'happy', hold: 'coin', size: 150 })}
      <h1>halbe halbe</h1>
      <p>Ausgaben teilen, ganz otterleicht.</p>
    </header>
    <section class="stack">
      ${cards || `<p class="empty">Noch kein Event. Leg eins an für euren Alltag, den Urlaub oder die Hochzeit.</p>`}
      <button class="btn primary big" data-a="new-event">＋ Neues Event</button>
      <button class="btn ghost" data-a="join">Ich habe einen Link bekommen</button>
    </section>
    ${store.syncEnabled ? '' : `<p class="note">Sync ist noch nicht eingerichtet. Gerade bleibt alles nur auf diesem Gerät. Wie ihr zu zweit loslegt, steht in der README.</p>`}`;
}

// ---------- Event ----------

function eventView(ev) {
  if (!ev?.meta) {
    return store.isLoaded(route.id)
      ? `<div class="center">${otter({ mood: 'sleepy', hold: 'none', size: 140 })}<h2>Hier ist nichts</h2><p>Dieses Event gibt es nicht (mehr). Stimmt der Link?</p><a class="btn primary" href="#/">Zur Übersicht</a></div>`
      : `<div class="center">${otter({ mood: 'normal', hold: 'none', size: 140, cls: 'bob' })}<p>Der Otter taucht nach euren Daten …</p><a class="btn ghost" href="#/">Zurück</a></div>`;
  }
  const id = route.id;
  const st = store.status();
  const stLabel = { local: 'nur auf diesem Gerät', pending: 'wird gesendet …', offline: 'offline', synced: '' }[st];

  return `<header class="bar">
      <a class="icon-btn" href="#/" aria-label="Zur Übersicht">‹</a>
      <div class="title"><span class="emoji">${esc(ev.meta.emoji || '🦦')}</span><h1>${esc(ev.meta.name)}</h1>${stLabel ? `<small class="status ${st}">${stLabel}</small>` : ''}</div>
      <button class="icon-btn" data-a="settings" aria-label="Teilen und Einstellungen">👥</button>
    </header>
    ${balanceCard(ev)}
    <nav class="tabs">
      <a href="#/e/${id}" ${route.tab === 'list' ? 'aria-current="page"' : ''}>Ausgaben</a>
      <a href="#/e/${id}/stats" ${route.tab === 'stats' ? 'aria-current="page"' : ''}>Auswertung</a>
    </nav>
    ${route.tab === 'stats' ? statsView(ev) : listView(ev)}
    <div class="fab-wrap"><div class="fab-row"><button class="btn primary big fab" data-a="add">＋ Ausgabe</button>${SR ? '<button class="btn primary big mic" data-a="mic" aria-label="Ausgabe einsprechen">🎤</button>' : ''}</div></div>`;
}

function balanceCard(ev) {
  const me = store.me(route.id);
  const bal = C.balances(ev);
  const tx = C.settle(bal);
  const mine = bal[me] || 0;
  const hasAny = C.expenseList(ev).length > 0;
  let mood = 'happy', hold = 'heart', big, sub = '';
  if (!hasAny) {
    hold = 'coin'; big = 'Los geht’s!'; sub = 'Tippe unten auf „＋ Ausgabe“.';
  } else if (!me || !ev.members?.[me]) {
    mood = 'normal'; hold = 'coin';
    big = tx.length ? 'Da ist noch was offen' : 'Alles ausgeglichen';
    sub = tx.map((t) => `${esc(nameOf(ev, t.from))} → ${esc(nameOf(ev, t.to))}: ${C.fmt(t.amount)}`).join('<br>');
  } else if (mine > 0) {
    hold = 'coin';
    big = `Du bekommst noch <b class="plus">${C.fmt(mine)}</b>`;
    sub = tx.filter((t) => t.to === me).map((t) => `${C.fmt(t.amount)} von ${esc(nameOf(ev, t.from))}`).join(' · ');
  } else if (mine < 0) {
    mood = 'normal'; hold = 'coin';
    big = `Du schuldest noch <b class="minus">${C.fmt(-mine)}</b>`;
    sub = tx.filter((t) => t.from === me).map((t) => `${C.fmt(t.amount)} an ${esc(nameOf(ev, t.to))}`).join(' · ');
  } else {
    big = 'Du bist quitt';
    sub = tx.length ? 'Zwischen den anderen ist noch was offen.' : 'Alles ausgeglichen. Otterstark!';
  }
  return `<section class="balance">${otter({ mood, hold, size: 96 })}<div><p class="big">${big}</p>${sub ? `<p class="sub">${sub}</p>` : ''}</div></section>`;
}

function listView(ev) {
  const list = C.expenseList(ev);
  if (!list.length) return `<p class="empty">Noch keine Ausgaben in diesem Event.</p>`;
  const mem = Object.fromEntries(members(ev).map((m) => [m.id, m]));
  let out = '', lastDay = null;
  for (const e of list) {
    if (e.date !== lastDay) {
      if (lastDay !== null) out += '</ul>';
      out += `<h3 class="day">${esc(dayLabel(e.date || ''))}</h3><ul class="rows">`;
      lastDay = e.date;
    }
    if (e.type === 'transfer') {
      out += `<li><button class="row transfer" data-a="edit" data-id="${e.id}">
        <span class="cat-ico">💸</span>
        <span class="grow"><b>Ausgleich</b><small>${esc(nameOf(ev, e.by))} → ${esc(nameOf(ev, e.to))}</small></span>
        <span class="amt">${C.fmt(e.amt)}</span></button></li>`;
      continue;
    }
    const c = cat(e.cat);
    const payer = mem[e.by];
    out += `<li><button class="row" data-a="edit" data-id="${e.id}">
      <span class="cat-ico c-${c.id}">${c.emoji}</span>
      <span class="grow"><b>${esc(e.note || c.name)}</b><small>${payer ? avatar(payer, true) : ''}${esc(nameOf(ev, e.by))} · ${esc(forLabel(ev, e))}</small></span>
      <span class="amt">${C.fmt(e.amt)}</span></button></li>`;
  }
  return out + '</ul>';
}

function statsView(ev) {
  const mem = members(ev);
  const tx = C.settle(C.balances(ev));
  const ms = C.months(ev);
  if (statsMonth !== 'all' && !ms.includes(statsMonth)) statsMonth = 'all';
  const s = C.stats(ev, statsMonth);

  const debts = tx.length
    ? `<ul class="rows">${tx.map((t) => `<li class="row static">
        <span class="grow"><b>${esc(nameOf(ev, t.from))} → ${esc(nameOf(ev, t.to))}</b><small>${C.fmt(t.amount)}</small></span>
        <button class="btn small" data-a="settle" data-from="${t.from}" data-to="${t.to}" data-amt="${t.amount}">Ausgleichen</button></li>`).join('')}</ul>`
    : `<p class="empty tight">Niemand schuldet jemandem etwas. 🎉</p>`;

  const chips = `<div class="chips scroll">
      <button class="chip" data-a="month" data-m="all" aria-pressed="${statsMonth === 'all'}">Insgesamt</button>
      ${ms.map((m) => `<button class="chip" data-a="month" data-m="${m}" aria-pressed="${statsMonth === m}">${esc(monthLabel(m, true))}</button>`).join('')}
    </div>`;

  const cats = CATS.filter((c) => s.byCat[c.id]).sort((a, b) => s.byCat[b.id] - s.byCat[a.id]);
  const maxCat = Math.max(1, ...cats.map((c) => s.byCat[c.id]));
  const catBars = cats.map((c) => `<div class="stat">
      <div class="stat-head"><span>${c.emoji} ${c.name}</span><span class="amt">${C.fmt(s.byCat[c.id])} <small>${Math.round((s.byCat[c.id] / s.total) * 100)} %</small></span></div>
      <div class="track"><i class="c-${c.id}" style="width:${Math.max(2, (s.byCat[c.id] / maxCat) * 100)}%"></i></div>
    </div>`).join('');

  const people = mem.map((m) => `<tr><td>${avatar(m, true)}${esc(m.name)}</td><td class="amt">${C.fmt(s.paid[m.id] || 0)}</td><td class="amt">${C.fmt(s.share[m.id] || 0)}</td></tr>`).join('');

  const maxMonth = Math.max(1, ...Object.values(s.byMonth));
  const monthBars = ms.length > 1 && statsMonth === 'all'
    ? `<section class="card"><h2>Monat für Monat</h2>${ms.map((m) => `<button class="stat link" data-a="month" data-m="${m}">
        <div class="stat-head"><span>${esc(monthLabel(m))}</span><span class="amt">${C.fmt(s.byMonth[m])}</span></div>
        <div class="track"><i class="c-month" style="width:${Math.max(2, (s.byMonth[m] / maxMonth) * 100)}%"></i></div>
      </button>`).join('')}</section>`
    : '';

  return `<section class="card"><h2>Wer schuldet wem?</h2>${debts}</section>
    <section class="card">
      <h2>Wofür ging das Geld drauf?</h2>
      ${chips}
      ${s.count ? `<p class="total"><b>${C.fmt(s.total)}</b> <small>in ${s.count} ${s.count === 1 ? 'Ausgabe' : 'Ausgaben'}</small></p>${catBars}
        <table class="people"><thead><tr><th></th><th>bezahlt</th><th>eigener Anteil</th></tr></thead><tbody>${people}</tbody></table>`
      : `<p class="empty tight">Noch keine Ausgaben in diesem Zeitraum.</p>`}
    </section>
    ${monthBars}`;
}

// ---------- Sheets ----------

function openSheet(html) {
  sheetEl.innerHTML = `<div class="backdrop" data-a="close"></div><div class="panel" role="dialog" aria-modal="true"><button class="x" data-a="close" aria-label="Schließen">✕</button>${html}</div>`;
  sheetEl.hidden = false;
  document.body.classList.add('sheet-open');
}

function closeSheet() {
  if (rec) { const r = rec; rec = null; try { r.abort(); } catch { /* lief nicht mehr */ } }
  sheetEl.hidden = true;
  sheetEl.innerHTML = '';
  F = null;
  document.body.classList.remove('sheet-open');
}

const chip = (action, value, label, pressed, extra = '') =>
  `<button type="button" class="chip" data-a="${action}" data-v="${esc(value)}" aria-pressed="${!!pressed}" ${extra}>${label}</button>`;

function openExpense(expId, spoken = '') {
  const ev = store.get(route.id);
  const mem = members(ev);
  const me = store.me(route.id);
  const old = expId ? { id: expId, ...ev.expenses[expId] } : null;

  if (old?.type === 'transfer') {
    openSheet(`<div class="form"><h2>💸 Ausgleich</h2>
      <p>${esc(nameOf(ev, old.by))} hat ${esc(nameOf(ev, old.to))} <b>${C.fmt(old.amt)}</b> gegeben (${esc(dayLabel(old.date || ''))}).</p>
      <button class="btn danger" data-a="delete" data-id="${old.id}">Löschen</button></div>`);
    return;
  }

  F = {
    id: old?.id || null,
    ts: old?.ts || null,
    cat: old?.cat || 'einkauf',
    by: old?.by && ev.members[old.by] ? old.by : (ev.members[me] ? me : mem[0].id),
    for: new Set(old ? Object.keys(old.for || {}).filter((k) => old.for[k] && ev.members[k]) : mem.map((m) => m.id)),
  };

  openSheet(`<form class="form" data-form="expense" novalidate>
    <h2>${old ? 'Ausgabe ändern' : 'Neue Ausgabe'}</h2>
    ${old ? '' : `<input id="f-quick" class="input quick" autocomplete="off" placeholder="Schnell diktieren oder tippen: „5 € Aldi“" aria-label="Schnelleingabe als Satz">`}
    <label class="amount"><input id="f-amt" name="amt" inputmode="decimal" autocomplete="off" placeholder="0,00" value="${old ? C.fmtInput(old.amt) : ''}" aria-label="Betrag in Euro"><span>€</span></label>
    <div class="cats">${CATS.map((c) => `<button type="button" class="cat c-${c.id}" data-a="pick-cat" data-v="${c.id}" aria-pressed="${F.cat === c.id}"><span>${c.emoji}</span>${c.name}</button>`).join('')}</div>
    <input id="f-note" name="note" class="input" maxlength="80" placeholder="Wofür genau? (optional)" value="${esc(old?.note || '')}" aria-label="Notiz">
    <div class="field"><span class="lbl">Bezahlt von</span>
      <div class="chips" id="f-by">${mem.map((m) => chip('pick-by', m.id, avatar(m, true) + esc(m.name), F.by === m.id)).join('')}</div></div>
    <div class="field"><span class="lbl">Aufgeteilt auf</span>
      <div class="chips" id="f-for">${mem.map((m) => chip('toggle-for', m.id, avatar(m, true) + esc(m.name), F.for.has(m.id))).join('')}</div>
      <p class="hint" id="f-split"></p></div>
    <div class="field"><label class="lbl" for="f-date">Datum</label>
      <input class="input" type="date" id="f-date" name="date" value="${old?.date || C.today()}"></div>
    <div class="actions">
      ${old ? `<button type="button" class="btn danger" data-a="delete" data-id="${old.id}">Löschen</button>` : ''}
      <button class="btn primary big grow">Speichern</button>
    </div>
  </form>`);
  updateSplitHint();
  if (spoken) { $('#f-quick').value = spoken; applyQuick(spoken); }
  else if (!old) $('#f-amt').focus();
}

/** Satz aus der Schnelleingabe auf die Formularfelder verteilen. */
function applyQuick(text) {
  if (!F) return;
  const q = parseQuick(text, members(store.get(route.id)), store.me(route.id));
  if (q.amt) $('#f-amt').value = C.fmtInput(q.amt);
  if (q.cat || q.note) { F.cat = q.cat || 'sonstiges'; press($('.cats', sheetEl), F.cat); }
  $('#f-note').value = q.note;
  if (q.by) { F.by = q.by; press($('#f-by'), F.by); }
  if (q.for) {
    F.for = new Set(q.for);
    $$('#f-for [data-v]').forEach((b) => b.setAttribute('aria-pressed', String(F.for.has(b.dataset.v))));
  }
  if (q.date) $('#f-date').value = q.date;
  updateSplitHint();
}

/** Mikrofon: zuhören, dann das ausgefüllte Formular zum Bestätigen zeigen. */
function listen() {
  let heard = '', error = '';
  const r = new SR();
  rec = r;
  r.lang = 'de-DE';
  r.interimResults = true;
  openSheet(`<div class="form">
    <div class="center-s">${otter({ mood: 'happy', hold: 'none', size: 120, cls: 'bob' })}</div>
    <h2>Ich höre zu …</h2>
    <p class="heard" id="f-heard">Sag zum Beispiel: „5 Euro für Aldi“</p>
    <div class="actions"><button type="button" class="btn grow" data-a="close">Abbrechen</button></div>
  </div>`);
  r.onresult = (ev) => {
    heard = [...ev.results].map((x) => x[0].transcript).join(' ').trim();
    const el = $('#f-heard');
    if (el && heard) el.textContent = `„${heard}“`;
  };
  r.onerror = (ev) => { error = ev.error; };
  r.onend = () => {
    if (rec !== r) return; // abgebrochen
    rec = null;
    if (heard) return openExpense(null, heard);
    closeSheet();
    toast(error === 'not-allowed' || error === 'service-not-allowed' ? 'Mikrofon ist nicht erlaubt' : error === 'network' ? 'Spracheingabe braucht Internet' : 'Ich habe nichts verstanden');
  };
  try { r.start(); } catch { rec = null; closeSheet(); toast('Spracheingabe geht hier leider nicht'); }
}

function updateSplitHint() {
  const el = $('#f-split');
  if (!el || !F) return;
  const amt = C.parseAmount($('#f-amt').value);
  const n = F.for.size;
  if (!n) el.textContent = 'Wähle mindestens eine Person.';
  else if (!amt) el.textContent = n === 1 ? 'Geht komplett auf eine Person.' : `Wird durch ${n} geteilt.`;
  else el.textContent = n === 1 ? `Geht komplett auf eine Person: ${C.fmt(amt)}` : `Macht ${C.fmt(Math.round(amt / n))} pro Person.`;
}

function emojiRow(current) {
  const own = EMOJIS.includes(current) ? '' : current;
  return `<div class="field"><span class="lbl">Symbol</span>
    <div class="chips" id="f-emoji">${EMOJIS.map((e) => chip('pick-emoji', e, e, e === current, 'aria-label="Symbol ' + e + '"')).join('')}
      <input class="chip own-emoji" id="f-emoji-own" autocomplete="off" placeholder="＋ eigenes" value="${esc(own)}" aria-label="Eigenes Emoji von der Tastatur"></div></div>`;
}

/** Eigenes Emoji von der Tastatur: nur das zuletzt getippte Zeichen behalten. */
function onOwnEmoji(input) {
  let v = input.value.trim();
  if (v && typeof Intl !== 'undefined' && Intl.Segmenter) {
    const parts = [...new Intl.Segmenter().segment(v)];
    v = parts[parts.length - 1].segment;
  } else {
    v = v.slice(0, 8);
  }
  input.value = v;
  if (!v) return;
  F.emoji = v;
  press($('#f-emoji'), v);
}

function openNewEvent() {
  F = { emoji: '🦦' };
  openSheet(`<form class="form" data-form="new-event" novalidate>
    <h2>Neues Event</h2>
    <div class="field"><span class="lbl">Vorschläge zum Antippen</span>
      <div class="chips">${TEMPLATES.map((t) => `<button type="button" class="chip suggest" data-a="tpl" data-name="${t.name}" data-emoji="${t.emoji}">${t.emoji} ${t.name}</button>`).join('')}</div></div>
    <div class="field"><label class="lbl" for="f-name">Wie heißt es?</label>
      <input class="input" id="f-name" name="name" maxlength="40" placeholder="z. B. Urlaub Portugal"></div>
    ${emojiRow(F.emoji)}
    <div class="field"><label class="lbl" for="f-me">Dein Name</label>
      <input class="input" id="f-me" name="me" maxlength="24" autocomplete="given-name" value="${esc(store.myName())}"></div>
    <div class="field"><span class="lbl">Wer macht mit?</span>
      <div id="f-others" class="stack-s"><input class="input" name="other" maxlength="24" placeholder="Name" aria-label="Name einer weiteren Person"></div>
      <button type="button" class="btn ghost small" data-a="more-people">＋ noch jemand</button></div>
    <p class="error" id="f-err" hidden></p>
    <div class="actions"><button class="btn primary big grow">Event anlegen</button></div>
  </form>`);
}

function openJoin() {
  openSheet(`<form class="form" data-form="join" novalidate>
    <h2>Event beitreten</h2>
    <p>Füge hier den Link ein, den du bekommen hast.</p>
    <input class="input" id="f-link" name="link" placeholder="https://…#/e/…" autocomplete="off" autocapitalize="off" aria-label="Event-Link">
    <p class="error" id="f-err" hidden></p>
    <div class="actions"><button class="btn primary big grow">Öffnen</button></div>
  </form>`);
}

function openWho() {
  const ev = store.get(route.id);
  openSheet(`<form class="form" data-form="add-me" novalidate>
    <div class="center-s">${otter({ mood: 'happy', hold: 'heart', size: 110 })}</div>
    <h2>Wer bist du?</h2>
    <p>Damit „bezahlt von“ gleich richtig steht.</p>
    <div class="chips">${members(ev).map((m) => chip('iam', m.id, avatar(m, true) + esc(m.name), false)).join('')}</div>
    <div class="field"><label class="lbl" for="f-me">Nicht dabei? Dann komm dazu:</label>
      <div class="inline"><input class="input" id="f-me" name="me" maxlength="24" placeholder="Dein Name" value="${esc(store.myName())}"><button class="btn primary">Dazu</button></div></div>
  </form>`);
}

function openSettings() {
  const ev = store.get(route.id);
  const me = store.me(route.id);
  F = { emoji: ev.meta.emoji || '🦦', me };
  const url = eventUrl(route.id);
  openSheet(`<form class="form" data-form="settings" novalidate>
    <h2>Teilen &amp; Leute</h2>
    <div class="field"><span class="lbl">Link zum Mitmachen</span>
      <div class="inline"><input class="input" id="f-url" readonly value="${esc(url)}" aria-label="Event-Link"><button type="button" class="btn" data-a="copy">Kopieren</button></div>
      ${navigator.share ? `<button type="button" class="btn ghost small" data-a="share">Link verschicken …</button>` : ''}
      <p class="hint">${store.syncEnabled ? 'Wer den Link hat, kann mitlesen und Ausgaben eintragen. Ganz ohne Anmeldung.' : 'Sync ist noch nicht eingerichtet: Der Link funktioniert bisher nur auf diesem Gerät (siehe README).'}</p></div>
    <div class="field"><label class="lbl" for="f-name">Name des Events</label>
      <input class="input" id="f-name" name="name" maxlength="40" value="${esc(ev.meta.name)}"></div>
    ${emojiRow(F.emoji)}
    <div class="field"><span class="lbl">Leute</span>
      <div class="stack-s">${members(ev).map((m) => `<input class="input" name="m:${m.id}" maxlength="24" value="${esc(m.name)}" aria-label="Name von ${esc(m.name)}">`).join('')}
      <input class="input" name="new" maxlength="24" placeholder="＋ Neue Person" aria-label="Neue Person"></div></div>
    <div class="field"><span class="lbl">Ich bin</span>
      <div class="chips" id="f-iam">${members(ev).map((m) => chip('pick-me', m.id, avatar(m, true) + esc(m.name), m.id === me)).join('')}</div></div>
    <div class="actions"><button type="button" class="btn danger" data-a="forget">Vom Gerät entfernen</button><button class="btn primary big grow">Speichern</button></div>
  </form>`);
}

function openSettle(from, to, amount) {
  const ev = store.get(route.id);
  F = { from, to };
  openSheet(`<form class="form" data-form="settle" novalidate>
    <div class="center-s">${otter({ mood: 'happy', hold: 'coin', size: 110 })}</div>
    <h2>Ausgleichen</h2>
    <p>${esc(nameOf(ev, from))} gibt ${esc(nameOf(ev, to))}:</p>
    <label class="amount"><input id="f-amt" name="amt" inputmode="decimal" autocomplete="off" value="${C.fmtInput(amount)}" aria-label="Betrag in Euro"><span>€</span></label>
    <div class="actions"><button class="btn primary big grow">Als bezahlt eintragen</button></div>
  </form>`);
}

// ---------- Aktionen ----------

function press(container, value) {
  $$('[data-v]', container).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === value)));
}

function confirmTwice(btn, label) {
  if (btn.dataset.armed) return true;
  btn.dataset.armed = '1';
  btn.textContent = label;
  setTimeout(() => { if (btn.isConnected) { delete btn.dataset.armed; } }, 4000);
  return false;
}

const actions = {
  close: closeSheet,
  'new-event': openNewEvent,
  join: openJoin,
  settings: openSettings,
  add() {
    const ev = store.get(route.id);
    const me = store.me(route.id);
    if (!me || !ev.members?.[me]) openWho(); else openExpense(null);
  },
  mic() {
    const ev = store.get(route.id);
    const me = store.me(route.id);
    if (!me || !ev.members?.[me]) openWho(); else listen();
  },
  edit: (el) => openExpense(el.dataset.id),
  month(el) { statsMonth = el.dataset.m; update(); },
  settle: (el) => openSettle(el.dataset.from, el.dataset.to, Number(el.dataset.amt)),

  'pick-cat'(el) { F.cat = el.dataset.v; press(el.parentElement, F.cat); },
  'pick-by'(el) { F.by = el.dataset.v; press(el.parentElement, F.by); },
  'toggle-for'(el) {
    const id = el.dataset.v;
    if (F.for.has(id)) F.for.delete(id); else F.for.add(id);
    el.setAttribute('aria-pressed', String(F.for.has(id)));
    updateSplitHint();
  },
  'pick-emoji'(el) { F.emoji = el.dataset.v; press(el.parentElement, F.emoji); $('#f-emoji-own').value = ''; },
  'pick-me'(el) { F.me = el.dataset.v; press(el.parentElement, F.me); },
  tpl(el) {
    $('#f-name').value = el.dataset.name;
    F.emoji = el.dataset.emoji;
    press($('#f-emoji'), F.emoji);
    $('#f-emoji-own').value = '';
  },
  'more-people'() {
    const input = document.createElement('input');
    Object.assign(input, { className: 'input', name: 'other', maxLength: 24, placeholder: 'Name' });
    input.setAttribute('aria-label', 'Name einer weiteren Person');
    $('#f-others').append(input);
    input.focus();
  },
  iam(el) {
    store.remember(route.id, el.dataset.v);
    store.setMyName(nameOf(store.get(route.id), el.dataset.v));
    closeSheet();
    update();
  },
  delete(el) {
    if (!confirmTwice(el, 'Wirklich löschen?')) return;
    store.patch(route.id, { ['expenses/' + el.dataset.id]: null });
    closeSheet();
    toast('Gelöscht');
  },
  forget(el) {
    if (!confirmTwice(el, 'Sicher? Nochmal tippen')) return;
    const id = route.id;
    closeSheet();
    location.hash = '#/';
    store.forget(id);
  },
  async copy() {
    const input = $('#f-url');
    try { await navigator.clipboard.writeText(input.value); toast('Link kopiert'); }
    catch { input.select(); toast('Link markiert – jetzt kopieren'); }
  },
  async share() {
    const ev = store.get(route.id);
    try { await navigator.share({ title: `halbe halbe: ${ev.meta.name}`, text: `Mach mit bei „${ev.meta.name}“ auf halbe halbe`, url: eventUrl(route.id) }); } catch { /* abgebrochen */ }
  },
};

function showError(msg) {
  const el = $('#f-err');
  if (el) { el.textContent = msg; el.hidden = false; } else toast(msg);
}

const forms = {
  expense(fd) {
    const amt = C.parseAmount(fd.get('amt'));
    if (!amt) { $('#f-amt').focus(); return toast('Wie viel war es denn?'); }
    if (!F.for.size) return toast('Auf wen wird aufgeteilt?');
    const id = F.id || C.uid();
    const exp = {
      amt, cat: F.cat, by: F.by,
      for: Object.fromEntries([...F.for].map((m) => [m, true])),
      date: fd.get('date') || C.today(),
      ts: F.ts || Date.now(),
    };
    const note = String(fd.get('note') || '').trim();
    if (note) exp.note = note;
    store.patch(route.id, { ['expenses/' + id]: exp });
    closeSheet();
    toast('Eingetragen 🦦');
  },

  'new-event'(fd) {
    const name = String(fd.get('name') || '').trim();
    const me = String(fd.get('me') || '').trim();
    const others = fd.getAll('other').map((s) => String(s).trim()).filter(Boolean);
    if (!name) { $('#f-name').focus(); return showError('Gib dem Event einen Namen.'); }
    if (!me) { $('#f-me').focus(); return showError('Wie heißt du?'); }
    const id = C.randomId(20);
    const meId = C.uid();
    const updates = { meta: { name, emoji: F.emoji, created: Date.now() }, ['members/' + meId]: { name: me } };
    others.forEach((n, i) => { updates['members/' + C.uid() + i] = { name: n }; });
    store.setMyName(me);
    store.patch(id, updates);
    store.remember(id, meId);
    closeSheet();
    location.hash = '#/e/' + id;
  },

  join(fd) {
    const m = String(fd.get('link') || '').trim().match(/(?:\/e\/|^)([A-Za-z0-9]{16,})\/?(?:stats)?$/);
    if (!m) return showError('Das sieht nicht nach einem halbe-halbe-Link aus.');
    closeSheet();
    location.hash = '#/e/' + m[1];
  },

  'add-me'(fd) {
    const name = String(fd.get('me') || '').trim();
    if (!name) { $('#f-me').focus(); return; }
    const ev = store.get(route.id);
    const existing = members(ev).find((m) => m.name.toLowerCase() === name.toLowerCase());
    const id = existing?.id || C.uid();
    if (!existing) store.patch(route.id, { ['members/' + id]: { name } });
    store.setMyName(name);
    store.remember(route.id, id);
    closeSheet();
    update();
  },

  settings(fd) {
    const ev = store.get(route.id);
    const updates = {};
    const name = String(fd.get('name') || '').trim();
    if (name && name !== ev.meta.name) updates['meta/name'] = name;
    if (F.emoji !== ev.meta.emoji) updates['meta/emoji'] = F.emoji;
    for (const m of members(ev)) {
      const n = String(fd.get('m:' + m.id) || '').trim();
      if (n && n !== m.name) updates[`members/${m.id}/name`] = n;
    }
    const added = String(fd.get('new') || '').trim();
    if (added) updates['members/' + C.uid()] = { name: added };
    const me = F.me;
    if (Object.keys(updates).length) store.patch(route.id, updates);
    if (me && me !== store.me(route.id)) store.remember(route.id, me);
    closeSheet();
    toast('Gespeichert');
    update();
  },

  settle(fd) {
    const amt = C.parseAmount(fd.get('amt'));
    if (!amt) return toast('Wie viel wurde gezahlt?');
    store.patch(route.id, { ['expenses/' + C.uid()]: { type: 'transfer', amt, by: F.from, to: F.to, date: C.today(), ts: Date.now() } });
    closeSheet();
    toast('Ausgeglichen 🎉');
  },
};

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-a]');
  if (!el) return;
  const fn = actions[el.dataset.a];
  if (fn) { ev.preventDefault(); fn(el); }
});

document.addEventListener('submit', (ev) => {
  const form = ev.target.closest('[data-form]');
  if (!form) return;
  ev.preventDefault();
  forms[form.dataset.form]?.(new FormData(form));
});

document.addEventListener('input', (ev) => {
  if (ev.target.id === 'f-amt') updateSplitHint();
  if (ev.target.id === 'f-quick') applyQuick(ev.target.value);
  if (ev.target.id === 'f-emoji-own') onOwnEmoji(ev.target);
});
document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !sheetEl.hidden) closeSheet(); });

store.onChange(update);
window.addEventListener('hashchange', onRoute);
// Beim App-Start ohne konkreten Link direkt ins zuletzt geöffnete Event springen.
if (!location.hash || location.hash === '#/' || location.hash === '#') {
  const last = store.lastEvent();
  if (last) history.replaceState(null, '', '#/e/' + last);
}
onRoute();

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
