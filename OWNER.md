# Owner-Konsole — wie eine Nachricht bei Ali ankommt

RonalJarvis läuft als statische Seite auf GitHub Pages. Es gibt keinen Server
dahinter, also gibt es auch keinen klassischen Live-Chat mit Websockets. Statt
das zu behaupten, nutzt der Direktkanal zwei Wege, die auf einer statischen
Seite wirklich funktionieren.

## Einmal einrichten

1. Auf **deinem** Gerät: `SETTINGS → Owner Console → IM MENÜ ZEIGEN: AN`.
2. Im Menü erscheint **OWNER**. Beim ersten Öffnen setzt du einen eigenen Code.
   Er wird nur als Prüfsumme in deinem Browser abgelegt, nie im Klartext und
   nie im Repo.
3. Auf Alis Gerät bleibt der Schalter aus — dort existiert der Menüpunkt nicht.

## Weg 1 — sofort, per Link

Nachricht schreiben → **Nachricht erstellen** → **Teilen-Link kopieren** →
Ali über WhatsApp oder Discord schicken. Er öffnet den Link, die Nachricht ist
da. Kein Deploy, keine Wartezeit. Sprachnachricht und Filmposter reisen mit.

Der Link wird lang, wenn eine lange Sprachnachricht dranhängt — bei mehr als
etwa 200 KB lieber Weg 2 nehmen.

## Weg 2 — dauerhaft, über `comms.json`

Nachricht schreiben → **Nachricht erstellen** → **Ganzes comms.json kopieren**
→ Inhalt von `public/comms.json` damit ersetzen → committen und pushen.

Nach dem Deploy holt sich jedes Gerät die Nachricht von selbst: die App fragt
`comms.json` alle 90 Sekunden ab. Ali muss nichts anklicken — er sieht das
Abzeichen am Menü und bekommt die Nachricht vorgelesen, wenn die Stimme an ist.

## Antworten von Ali

Ali kann im Direktkanal antworten. Weil es keinen Server gibt, wird aus seiner
Antwort ebenfalls ein Link, den er dir zurückschickt. Öffnest du ihn, steht
seine Antwort in deinem Kanal.

## Später auf einen echten Server umsteigen

Alles läuft über `src/lib/ownerFeed.ts`. Ein echtes Backend (Supabase,
Firebase, ein kleiner Worker) ersetzt genau eine Funktion — `fetchRemoteFeed`
— und der Rest der App bleibt unverändert.
