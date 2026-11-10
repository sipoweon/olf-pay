// Schnelleingabe: aus einem gesprochenen oder getippten Satz wie
// „ich habe gerade 5 € für Aldi ausgegeben“ Betrag, Kategorie und Notiz ziehen.
// Bewusst ohne KI: feste Regeln und eine Stichwortliste, läuft komplett im Browser.

import { parseAmount, today } from './calc.js';

const KEYWORDS = {
  einkauf: ['aldi', 'lidl', 'rewe', 'edeka', 'penny', 'netto', 'kaufland', 'simmel', 'dm', 'rossmann', 'müller', 'supermarkt', 'einkauf', 'einkaufen', 'eingekauft', 'lebensmittel', 'bäcker', 'bäckerei', 'metzger', 'wochenmarkt', 'markt', 'drogerie', 'getränke', 'getränkemarkt', 'biomarkt', 'denns', 'alnatura', 'tegut', 'globus', 'norma', 'spar', 'billa', 'hofer', 'migros', 'coop'],
  wohnung: ['miete', 'strom', 'gas', 'heizung', 'nebenkosten', 'internet', 'wlan', 'rundfunk', 'rundfunkbeitrag', 'ikea', 'möbel', 'baumarkt', 'obi', 'hornbach', 'bauhaus', 'putzmittel', 'wohnung', 'haushalt', 'hausrat', 'handwerker', 'schrank', 'lampe', 'waschmaschine', 'staubsauger'],
  essen: ['restaurant', 'essen', 'pizza', 'pizzeria', 'döner', 'burger', 'sushi', 'café', 'cafe', 'kaffee', 'frühstück', 'brunch', 'mittagessen', 'abendessen', 'lieferando', 'lieferdienst', 'imbiss', 'eis', 'eisdiele', 'bar', 'kneipe', 'cocktail', 'cocktails', 'bier', 'biergarten', 'mcdonalds', 'asiate', 'italiener', 'grieche', 'inder'],
  freizeit: ['kino', 'konzert', 'theater', 'museum', 'schwimmbad', 'zoo', 'eintritt', 'ticket', 'tickets', 'festival', 'bowling', 'club', 'party', 'netflix', 'spotify', 'sauna', 'therme', 'minigolf', 'klettern', 'bouldern', 'fitnessstudio'],
  unterwegs: ['tanken', 'getankt', 'tankstelle', 'benzin', 'sprit', 'bahn', 'zug', 'bus', 'taxi', 'uber', 'flug', 'flüge', 'hotel', 'airbnb', 'parken', 'parkhaus', 'parkplatz', 'maut', 'fähre', 'mietwagen', 'fahrkarte', 'bahnticket', 'zugticket', 'deutschlandticket', 'flixbus', 'hostel', 'ferienwohnung', 'camping', 'campingplatz'],
};

const STOP = new Set(('ich habe hab haben wir gerade eben heute gestern vorgestern für bei beim im in ins am an auf aus mit vom von zum zur zu ' +
  'ausgegeben bezahlt gezahlt zahlt gekauft gekostet kostet kosten war waren es hat hatte der die das den dem ein eine einen einem einer ' +
  'und noch mal nur mich mir uns euro euros eur cent bitte so ca etwa ungefähr').split(' '));

const CURRENCY = '(?:€|euros?(?![a-zäöü])|eur(?![a-zäöü]))';

function findAmount(text) {
  // „5 Euro 50“
  let m = text.match(new RegExp(`(\\d+)\\s*${CURRENCY}\\s+(\\d{2})(?![\\d.,])`, 'i'));
  if (m) return { cents: Number(m[1]) * 100 + Number(m[2]), match: m[0] };
  // „12,50 €“ oder „€ 12,50“ – eine Zahl mit Währung gewinnt gegen andere Zahlen im Satz
  const NUM = '(\\d{1,3}(?:\\.\\d{3})+(?:,\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?)';
  m = text.match(new RegExp(`${NUM}\\s*${CURRENCY}`, 'i')) || text.match(new RegExp(`€\\s*${NUM}`)) || text.match(new RegExp(NUM));
  if (!m) return null;
  const cents = parseAmount(m[1]);
  return cents ? { cents, match: m[0] } : null;
}

function findCategory(tokens) {
  for (const t of tokens) {
    for (const [cat, words] of Object.entries(KEYWORDS)) if (words.includes(t)) return cat;
  }
  for (const t of tokens) {
    for (const [cat, words] of Object.entries(KEYWORDS)) {
      if (words.some((w) => w.length >= 5 && t.includes(w))) return cat;
    }
  }
  return null;
}

/**
 * @param {string} text  gesprochener oder getippter Satz
 * @param {{id:string,name:string}[]} people  Personen im Event
 * @param {string|null} meId  eigene Person (für „nur für mich“)
 * @returns {{amt:number|null, cat:string|null, note:string, by:string|null, for:string[]|null, date:string|null}}
 */
export function parseQuick(text, people = [], meId = null) {
  const res = { amt: null, cat: null, note: '', by: null, for: null, date: null };
  let rest = String(text || '').trim();
  if (!rest) return res;

  const amount = findAmount(rest);
  if (amount) {
    res.amt = amount.cents;
    rest = rest.replace(amount.match, ' ');
  }

  const words = rest.split(/[^\p{L}\d]+/u).filter(Boolean);
  const lower = words.map((w) => w.toLowerCase());

  if (lower.includes('vorgestern')) res.date = dayOffset(-2);
  else if (lower.includes('gestern')) res.date = dayOffset(-1);

  // Personen: „für Anna“ -> nur auf Anna aufteilen, „Anna hat bezahlt“ -> Anna ist Zahlerin
  const nameIdx = new Set();
  const onlyFor = [];
  lower.forEach((w, i) => {
    const person = people.find((p) => p.name.trim().toLowerCase() === w) || ((w === 'mich' || w === 'mir') && meId ? { id: meId } : null);
    if (!person) return;
    nameIdx.add(i);
    const prev = lower[i - 1], next = lower[i + 1];
    if (prev === 'für' || (prev === 'und' && onlyFor.length && nameIdx.has(i - 2))) onlyFor.push(person.id);
    else if (next === 'hat' || next === 'zahlt' || prev === 'hat' || prev === 'von') res.by = person.id;
  });
  if (onlyFor.length) res.for = [...new Set(onlyFor)];

  const content = words.filter((w, i) => !nameIdx.has(i) && !STOP.has(lower[i]) && !/^\d+$/.test(w));
  res.cat = findCategory(content.map((w) => w.toLowerCase()));

  let note = content.join(' ').slice(0, 80);
  if (note) note = note.charAt(0).toUpperCase() + note.slice(1);
  res.note = note;
  return res;
}

function dayOffset(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return today(d);
}
