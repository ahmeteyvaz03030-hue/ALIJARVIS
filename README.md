# RONALJARVIS

Alis persönliches, futuristisches KI-Betriebssystem — als lauffähige Web-App.
Kein Website-Gefühl: Boot-Sequenz, Identitäts-Scan, ein lebender HUD-Core,
Radar, animierte Flugroute, 3D-Globus, Live-Systemlogs und Missionsphasen, die
sich am Reisedatum orientieren.

```bash
npm install
npm run dev      # Entwicklung → http://localhost:5173
npm run build    # Produktionsbuild nach dist/
npm run preview  # Build lokal testen
```

## Login (erste Demo)

Der Login ist ein **lokales Demo-Gate**. Der Signaturkode wird nicht im
Klartext ausgeliefert — im Bundle liegt nur sein SHA-256-Digest, damit der Kode
weder im Interface noch in den DevTools oder der Source-Map auftaucht.

* Kode: siehe private Übergabe-Notiz (nicht im Repository).
* Nach 5 Fehlversuchen kühlt das Gate 30 Sekunden ab.
* Die Session hält 12 Stunden (`localStorage`), danach fragt das Gate erneut.

Einen **anderen** Kode setzen:

```bash
node -e "console.log(require('crypto').createHash('sha256').update('RJV:DEIN_KODE').digest('hex'))"
# Ausgabe in .env als VITE_DEMO_PASSCODE_SHA256=... eintragen
```

### Später auf Supabase / Firebase umstellen

Die gesamte Oberfläche kennt nur das Interface `AuthProvider` und das Objekt
`JarvisSession` (`src/lib/auth/types.ts`). Der Austausch ist eine Zeile:

```ts
// src/lib/auth/index.ts
import { createSupabaseAuthProvider } from './supabaseProvider'
export const authProvider: AuthProvider = createSupabaseAuthProvider()
```

Ein Provider muss nur `signIn`, `restore` und `signOut` erfüllen und eine
`JarvisSession` zurückgeben — Scan-Animation, Begrüßung, Zugriffsstufe und alle
Gates hängen an diesem Objekt, nicht am Demo-Code.

## Deployment auf GitHub Pages

Pages darf **nicht** direkt aus dem Branch ausliefern — im Repository liegt
Quellcode, kein fertiges Bundle. `index.html` würde `/src/main.tsx` laden, und
TypeScript kann kein Browser ausführen: die Seite bliebe schwarz.

Stattdessen baut `.github/workflows/deploy-pages.yml` das Projekt bei jedem Push
und veröffentlicht `dist/`. Einmalig nötig:

**Settings → Pages → Build and deployment → Source: `GitHub Actions`**
(statt „Deploy from a branch").

Danach läuft der Workflow bei jedem Push automatisch; Fortschritt und Fehler
stehen im Tab **Actions**.

Der Basis-Pfad wird im Workflow aus dem Repository-Namen gesetzt
(`https://<user>.github.io/<repo>/`). Für eine eigene Domain oder einen Host,
der auf `/` ausliefert:

```bash
VITE_BASE=/ npm run build
```

## Reisedaten anpassen

Alles Reisebezogene steht in `src/lib/config.ts`: Start- und Zielort, Flugnummer,
Abflug-/Ankunfts-/Rückflugzeit, Distanz, Gate, Sitz. Die Missionsphase
(`countdown` → `flight_day` → `in_flight` → `arrived` → `returned`) wird daraus
automatisch abgeleitet.

Für Demos lässt sich jede Phase erzwingen: **SYS → Mission Simulation → Phase**.
Dort liegen auch die Buttons, um Boot-, Flight-Mode- und Arrival-Cinematic
erneut abzuspielen.

## Animationen & Simulationen

| # | Sequenz | Datei |
|---|---------|-------|
| 1 | Boot-Sequenz: Systemzeilen, Cursor, Loading-Bars, Prozent, Datenspalten, Scan | `components/boot/BootSequence.tsx` |
| 2 | Passwort-/Identitäts-Scan mit Scanner-Ring, ACCESS GRANTED, IDENTITY CONFIRMED | `components/auth/AuthGate.tsx`, `auth/ScannerRing.tsx` |
| 3 | Dezente Scan-Linien über Panels | `components/fx/ScanLine.tsx` |
| 4 | RonalJarvis-Core: 5 Ringsysteme, Radar-Sweep, Punkte auf Schienen, Voiceprint | `components/core/JarvisCore.tsx` |
| 5 | Radar „MARMARIS AREA SCAN" mit Kontakt-Blips im Takt des Strahls | `components/sim/Radar.tsx` |
| 6 | Flugroute Deutschland → Marmaris, Flugzeug entlang Großkreis | `components/travel/FlightRoute.tsx` |
| 7 | 3D-Globus (three.js), leuchtende Route, Marker DE/TR, langsame Rotation | `components/travel/Globe3D.tsx` |
| 8 | Partikel-Hintergrund mit Verbindungslinien und Pointer-Parallaxe | `components/fx/ParticleField.tsx` |
| 9 | Dashboard-Entry: SYSTEM UNLOCKED → Module ONLINE → ALL SYSTEMS OPERATIONAL | `components/boot/UnlockSequence.tsx` |
| 10 | Holographische Cards: Tilt, Glow, wandernde Border, Lichtreflexion | `components/hud/HoloCard.tsx` |
| 11 | Buttons: Hover-Wipe, Klick-Energiering, Loading-Scanner | `components/hud/HudButton.tsx` |
| 12 | Page-Transitions zwischen den Modulen | `components/layout/Desktop.tsx`, `lib/motion.ts` |
| 13 | Countdown mit rollenden Ziffern und Tages-Rollover-Animation | `components/travel/Countdown.tsx` |
| 14 | FLIGHT MODE INITIALIZING → ACTIVE + Dauer-Strip am Reisetag | `components/travel/FlightModeBanner.tsx` |
| 15 | Arrival: DESTINATION REACHED / MARMARIS / HOLIDAY MODE + Lichtpartikel | `components/travel/ArrivalSequence.tsx` |
| 16 | Wetter reagiert: Sonnenschein, Regentropfen, Wolkendrift, Blitze, Sterne | `components/weather/WeatherPanel.tsx` |
| 17 | Film-Poster-Hover, kinematisches Modal (Shared Element), Trailer-Overlay | `components/movies/*` |
| 18 | Tony Comms: CONNECTING → PRIVATE CHANNEL → SESSION ACTIVE, Notification-Pulse | `components/comms/TonyComms.tsx` |
| 19 | RonalJarvis: PROCESSING REQUEST → Antwort im Typewriter, Core pulsiert stärker | `components/jarvis/JarvisChat.tsx` |
| 20 | Micro-Interactions, Ticker, Segment-Bars, animierte Zahlen | `components/hud/Readout.tsx` |
|  + | System Monitor mit driftenden Werten und Sparklines | `components/sim/SystemMonitor.tsx` |
|  + | Live System Log (Terminal-Tail, letzte 7 Einträge) | `components/sim/SystemLog.tsx` |

Alle Werte in System Monitor, Log, Wetter, Telemetrie und Tony-Chat sind
**simuliert** — sie driften langsam auf einen Basiswert zu, damit sich das
System lebendig anfühlt, ohne zu flackern.

## Performance

* Animiert wird fast ausschließlich über `transform` und `opacity`.
* Der Core, das Radar und die Scan-Linien laufen als SVG/CSS-Transforms,
  nicht per Frame-für-Frame-JavaScript.
* Die Core-Erregung läuft über einen `MotionValue` — RonalJarvis' Sprechen
  verändert die Animation, ohne React neu zu rendern.
* `three` liegt in einem eigenen, lazy geladenen Chunk: der Boot-Screen wartet
  nie auf den Globus.
* Canvas-Ebenen begrenzen die Pixel-Ratio, pausieren im Hintergrund-Tab und
  reduzieren ihre Dichte auf schwächeren Geräten (`perfTier`).
* Der Globus fährt auf Mobile ein leichteres Mesh und deaktiviert das Ziehen.

### Reduce Motion

`SYS → Interface & Motion → Animationen`:

* **AUTO** folgt `prefers-reduced-motion` des Geräts,
* **FULL** erzwingt alle Animationen,
* **REDUCE** schaltet Dauerbewegung, CRT-Overlay, Partikelbewegung, Tilt,
  Radar-Sweep, Globus-Rotation und Typewriter ab — Inhalte und Layout bleiben
  identisch.

UI-Sounds (synthetisch, ohne Assets) sind standardmäßig **aus** und lassen sich
in der Top-Bar oder in den Settings zuschalten.

## Struktur

```
src/
  lib/            auth (Provider-Interface + Demo-Gate), config, motion, hooks, audio, jarvisBrain
  state/          SystemProvider (Settings, Telemetrie, Log, Core), useComms
  components/
    boot/         Boot- und Unlock-Sequenz
    auth/         Identity Gate + Scanner
    core/         RonalJarvis Core
    fx/           Partikelfeld, Scan-Linien
    hud/          HoloCard, HudButton, Readouts
    sim/          System Monitor, System Log, Radar
    travel/       Countdown, Flugroute, Globus, Flight Mode, Arrival
    weather/      Wetterpanel mit Condition-Effekten
    movies/       Poster-Grid, prozedurale Poster, Modal, Trailer
    comms/        Tony Comms
    jarvis/       Core-Dialog mit Typewriter
    layout/       TopBar, NavRail, Desktop-Shell
  views/          Home, Travel, Marmaris, Movies, Comms, Settings
  data/           Filme, Marmaris-POIs, Wetter
```

## Stack

React 19 · TypeScript · Vite · Framer Motion · three.js · Tailwind CSS 4 ·
Canvas 2D · WebAudio. Keine externen Bild-, Video- oder Audio-Assets — Poster,
Globus, Radar und Sounds werden vollständig im Client erzeugt.
