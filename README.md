# Olf-Pay 🦦

Ausgaben teilen, ganz otterleicht. Ohne Anmeldung, ohne Werbung, ohne Build-Schritt.

- **Events** für Alltag, Urlaub, Wohnung, Hochzeit …
- **Ausgabe eintragen in drei Tipps:** Betrag, Kategorie, Speichern. „Bezahlt von“ steht auf dir, aufgeteilt wird auf alle. Notiz und Datum sind optional.
- **Auswertung:** wer wem was schuldet (mit „Ausgleichen“-Knopf), Ausgaben pro Kategorie und Person, insgesamt oder pro Monat.
- **Mitmachen per Link:** Wer den Event-Link hat, ist dabei. Auch Freunde im Urlaub.
- **Als App installierbar** (iPhone, Android, Chrome) und offline nutzbar. Offline eingetragene Ausgaben werden nachgeschickt.

## Einrichten (einmalig, ca. 10 Minuten)

### 1. Seite veröffentlichen (GitHub Pages)

Im Repository: **Settings → Pages → Build and deployment → Source: „Deploy from a branch“ → Branch `main`, Ordner `/ (root)` → Save.**
Nach ein, zwei Minuten läuft die App unter `https://sipoweon.github.io/olf-pay/`.

Ohne Schritt 2 funktioniert sie schon, speichert aber nur auf dem jeweiligen Gerät.

### 2. Sync einschalten (Firebase Realtime Database, kostenlos)

Damit ihr beide dieselben Daten seht, braucht es einen kleinen gemeinsamen Speicher:

1. Auf <https://console.firebase.google.com> ein Projekt anlegen (Google Analytics kann aus bleiben).
2. Im Projekt: **Build → Realtime Database → Datenbank erstellen**, Standort z. B. Belgien (`europe-west1`), im gesperrten Modus starten.
3. Reiter **Regeln**: Inhalt von [`database.rules.json`](database.rules.json) einfügen und veröffentlichen.
4. Die Datenbank-URL kopieren (steht oben im Reiter „Daten“, z. B. `https://halbehalbe-12345-default-rtdb.europe-west1.firebasedatabase.app`) und in [`config.js`](config.js) eintragen:

   ```js
   export const FIREBASE_DB_URL = "https://…firebasedatabase.app";
   ```

5. Änderung committen. Fertig.

Der kostenlose Spark-Tarif (1 GB Speicher, 10 GB Transfer pro Monat) reicht dafür locker.

### 3. Aufs Handy holen

- **iPhone (Safari):** Seite öffnen → Teilen → „Zum Home-Bildschirm“.
- **Android / Chrome:** Menü ⋮ → „App installieren“ bzw. „Zum Startbildschirm hinzufügen“.

Auf dem iPhone hat die installierte App einen eigenen Speicher. Ein Event, das du vorher in Safari geöffnet hast, holst du in der App über **„Ich habe einen Link bekommen“** dazu (Link gibt es im Event unter 👥).

## Gut zu wissen

- **Sicherheit:** Es gibt kein Login. Der Event-Link enthält einen zufälligen 20-stelligen Code und ist der Schlüssel: Wer ihn kennt, kann lesen und schreiben. Die Datenbankregeln verhindern, dass jemand alle Events auflisten kann. Also den Link nur an Leute geben, die mitmachen sollen.
- **Aufteilung:** immer zu gleichen Teilen auf die ausgewählten Personen. „Nur für Anna“ geht, indem du dich selbst bei „Aufgeteilt auf“ abwählst.
- **„Vom Gerät entfernen“** löscht ein Event nur aus der Liste dieses Geräts, nicht für die anderen.

## Entwickeln

```bash
npm start
```

startet einen lokalen Server auf <http://localhost:8080>.

```bash
npm test
```

prüft die Rechenlogik (`js/calc.js`).

| Datei | Inhalt |
| --- | --- |
| `js/app.js` | Oberfläche, Formulare, Navigation |
| `js/calc.js` | Beträge, Salden, Ausgleich, Statistik |
| `js/store.js` | Speichern im Browser, Sync über Firebase-REST, Offline-Warteschlange |
| `js/otter.js` | der Otter (selbst gezeichnetes SVG) |
| `sw.js` | Service Worker für Offline-Betrieb |
