# 🎸 AirJam — Air Guitar acústica en tiempo real

PWA que convierte tu cámara en una guitarra acústica: una mano sostiene el mástil, la otra rasguea en el aire. El tracking corre **100% en el navegador** (MediaPipe sobre WebGL/GPU) y el sonido se genera con **síntesis física Karplus-Strong** sobre Web Audio API, sin samples.

La arquitectura está pensada para sumar otros instrumentos de cuerda (bajo, ukelele, eléctrica) y de percusión (batería, cajón, pads) como **plugins**.

---

## Características

| | |
|---|---|
| **Tracking** | `PoseLandmarker` lite (hombros/caderas) cada 2 frames + `HandLandmarker` (2 manos) en cada frame. Las manos se asignan a izquierda/derecha emparejándolas con las muñecas de la pose. Delegate GPU con fallback automático a CPU. |
| **Audio** | Karplus-Strong con retardo fraccional (afinación ±1.5%, verificada por test), excitación con filtro peine de posición de púa, T60 dependiente de la frecuencia, caja acústica (peaking ~100 Hz + pasa-banda ~220 Hz + shelving), reverb convolucional con IR sintética y compresor. Buffers cacheados (LRU) y pre-renderizados en tiempo ocioso: **el rasgueo no hace trabajo de CPU en el camino crítico**. |
| **Rasgueo** | Intersección de segmentos entre la posición anterior y actual de la "púa" (punto medio pulgar-índice) y cada cuerda. Cooldown de 90 ms por cuerda, dirección ↓/↑, velocidad → volumen y brillo, ataques escalonados según el instante real de cruce. |
| **Modos** | `free` (gestos o zonas), `song-auto` (Auto-Acorde), `song-manual` (formá el gesto del acorde pedido; si no coincide suena apagado y el mástil se pone rojo). |
| **Canciones** | Teleprompter horizontal al BPM con cuenta regresiva, progreso del compás, próximos acordes, diagrama de digitación + gesto, velocidad 0.75×/1×, metrónomo. |
| **PWA** | Instalable, pantalla completa, offline: app precacheada; runtime WASM y modelos de MediaPipe cacheados en el primer uso (CacheFirst). |

### Gestos de la mano del mástil (Modo Libre y Manual)

| Acorde | Gesto | | Acorde | Gesto |
|---|---|---|---|---|
| **C** | ☝️ Solo índice | | **Em** | ✊ Puño |
| **G** | ✌️ Índice + medio | | **E** | 👍 Solo pulgar |
| **Am** | 🤟 Índice + medio + anular | | **A** | 🤙 Pulgar + meñique |
| **F** | 🖖 Cuatro dedos (sin pulgar) | | **Bm** | 🤘 Índice + meñique |
| **D** | 🖐️ Mano abierta | | | |

En **Modo Zonas**, el acorde depende de cuánto estirás el brazo del mástil (8 zonas: Em, G, C, D, Am, E, A, F), con un indicador sobre el mástil.

---

## Stack

- **SvelteKit 3** + **Svelte 5 Runes** (`$state`, `$derived`, `$effect`) + TypeScript estricto (`noUncheckedIndexedAccess`)
- **Tailwind CSS 4** (plugin de Vite) + **Lucide** (`@lucide/svelte`, el paquete oficial para Svelte 5; reemplaza a `lucide-svelte`)
- **@vite-pwa/sveltekit 2** (Workbox `generateSW`)
- **@mediapipe/tasks-vision** (WASM servido desde el propio origen)
- **Vitest** para la lógica pura

> **Nota SvelteKit 3:** ya no existe `svelte.config.js` — la configuración de Kit se pasa en `vite.config.ts` (acá, a través de `withPwa(kitConfig, pwaOptions)`). El alias `$lib` se reemplazó por los *subpath imports* de Node: `#lib/...` (definido en `package.json → imports`), que requiere extensión explícita (`#lib/instruments/types.ts`).

## Inicio rápido

```bash
cd airjam
npm install          # copia también el WASM de MediaPipe a static/mediapipe/wasm
npm run dev          # http://localhost:5173
```

La cámara requiere **HTTPS o localhost**. Para probar en el celular dentro de tu red: `npm run dev -- --host` y abrir vía un túnel HTTPS (ej. `cloudflared`), o hacer `npm run build` y servir `build/` con HTTPS.

| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build estático (adapter-static) + Service Worker en `build/` |
| `npm run preview` | Sirve el build |
| `npm run check` | `svelte-check` (TypeScript + Svelte) |
| `npm test` | Tests unitarios (Vitest) |
| `npm run icons` | Regenera los iconos PNG placeholder |

### Publicar en GitHub Pages

El workflow `.github/workflows/airjam-pages.yml` (en la raíz del repo) hace type-check, tests, build con `BASE_PATH=/<repo>` y publica en `https://<usuario>.github.io/<repo>/`. Solo hace falta activar **Settings → Pages → Source: GitHub Actions** una vez. Para probar localmente con ruta base: `BASE_PATH=/brackets npm run build && BASE_PATH=/brackets npm run preview`.

**Consejos de uso:** alejate ~1,5 m con los hombros visibles, buena luz frontal y auriculares (evita que el micrófono/parlante del entorno moleste). El brazo del mástil se estira hacia el costado; la mano de rasgueo cruza las cuerdas sobre la boca de la guitarra.

---

## Arquitectura

```
src/
├── lib/
│   ├── instruments/                 ← dominio, sin dependencias de UI ni de MediaPipe
│   │   ├── types.ts                 ← InstrumentPlugin, TrackingFrame, TriggerEvent, ChordDefinition, PlayMode, Synthesizer
│   │   ├── registry.ts              ← instrumentos disponibles (carga diferida)
│   │   ├── engine/
│   │   │   ├── AudioEngine.ts       ← singleton: AudioContext, desbloqueo, bus master, enrutado de eventos → sintetizadores
│   │   │   ├── KarplusStrongSynth.ts← cuerdas pulsadas + caja acústica
│   │   │   ├── ClickSynth.ts        ← metrónomo (referencia para percusión ruido/envolvente)
│   │   │   └── impulse.ts           ← IR sintética para la reverb
│   │   ├── music/                   ← notas MIDI y librería de acordes + gestos
│   │   ├── utils/                   ← vectores 2D, filtro One-Euro
│   │   └── plugins/
│   │       ├── AcousticGuitarPlugin.ts
│   │       └── guitar/              ← geometry · gestures · StrumDetector · effects · renderer · constants
│   ├── tracking/                    ← adaptador MediaPipe → TrackingFrame, cámara, esqueleto, transform cover
│   ├── songs/                       ← JSON de canciones, timeline, SongPlayer (runes)
│   ├── state/settings.svelte.ts     ← preferencias persistidas
│   └── components/                  ← Stage, Teleprompter, ChordHud, ControlBar, WelcomeScreen, ChordDiagram…
└── routes/+page.svelte              ← orquestación de la experiencia
```

### Flujo por frame (un solo `requestAnimationFrame`)

```
SongPlayer.tick(now) ──► acorde objetivo ──► plugin.configure({ targetChord })
VisionTracker.detect(video) ──► TrackingFrame (px del video espejado, manos por lado anatómico)
plugin.update(frame) ──► TriggerEvent[] ──► AudioEngine.dispatch() ──► Synthesizer.trigger(event, when)
plugin.render(ctx, view, now) + drawSkeleton()      plugin.getHud() ──► UI reactiva
```

Principios:

- **Los plugins no tocan Web Audio.** Emiten `TriggerEvent { synth, channel, frequency, velocity, delay, articulation, … }` y el `AudioEngine` los enruta al sintetizador registrado con ese `synth`.
- **Los plugins no conocen MediaPipe.** Reciben un `TrackingFrame` normalizado; cambiar de librería de visión solo afecta a `tracking/VisionTracker.ts`.
- **La UI no conoce la física.** Lee `getHud()` (objeto inmutable que solo cambia de referencia si cambió algo) y escribe configuración con `configure()`.

---

## Cómo agregar un instrumento

### 1. Instrumento de cuerda (ej. `BassPlugin.ts`)

Reutiliza la geometría, el detector de rasgueo y el sintetizador Karplus-Strong; solo cambian la afinación, la cantidad de cuerdas y el render.

```ts
// src/lib/instruments/plugins/BassPlugin.ts
import type { InstrumentHud, InstrumentPlugin, InstrumentSettings, PlayMode, TrackingFrame, TriggerEvent, ViewTransform } from '../types';
import { midiToFrequency } from '../music/notes';
import { StrumDetector } from './guitar/StrumDetector';
import { GuitarGeometrySolver } from './guitar/geometry';

const BASS_TUNING = [28, 33, 38, 43]; // E1 A1 D2 G2

export class BassPlugin implements InstrumentPlugin {
	readonly id = 'bass';
	readonly name = 'Bajo';
	readonly family = 'string' as const;
	readonly supportedModes: readonly PlayMode[] = ['free', 'song-auto'];

	private solver = new GuitarGeometrySolver(); // generalizá STRING_COUNT si lo necesitás
	private strum = new StrumDetector(BASS_TUNING.length);
	private settings: InstrumentSettings = { mode: 'free', leftHanded: false, targetChord: null, chordInput: 'gesture' };
	private hud: InstrumentHud = { ready: false, activeChord: null, detectedChord: null, matched: null, hint: null, lastStrum: null };

	configure(s: Partial<InstrumentSettings>) { this.settings = { ...this.settings, ...s }; }

	update(frame: TrackingFrame): TriggerEvent[] {
		// 1) geometría  2) detectar cruces  3) mapear cuerda → nota (raíz del acorde)
		return [/* { instrumentId: this.id, synth: 'karplus-strong', channel, frequency: midiToFrequency(...), ... } */];
	}

	render(ctx: CanvasRenderingContext2D, view: ViewTransform, now: number) { /* 4 cuerdas gruesas */ }
	getHud() { return this.hud; }
	reset() { this.strum.reset(); this.solver.reset(); }
	dispose() { this.reset(); }
}
```

### 2. Instrumento de percusión (ej. `DrumsPlugin.ts`) con su propio sintetizador

```ts
// a) Sintetizador: implementá `Synthesizer`
import type { Synthesizer, TriggerEvent } from '../types';

export class DrumSynth implements Synthesizer {
	readonly id = 'drum-kit';
	constructor(private ctx: AudioContext, private out: AudioNode) {}
	trigger(e: TriggerEvent, when: number) {
		// channel 0 = bombo (seno con pitch-drop), 1 = caja (ruido + bandpass), 2 = hi-hat (ruido + highpass)…
	}
	stopAll() {}
	dispose() {}
}

// b) Registrarlo una vez (por ejemplo al cargar el plugin):
AudioEngine.get().registerSynth('drum-kit', (ctx, out) => new DrumSynth(ctx, out));

// c) El plugin detecta "golpes" (velocidad vertical de la muñeca que cruza una zona/pad)
//    y emite eventos { synth: 'drum-kit', channel: padIndex, velocity, frequency: 0, … }
```

### 3. Registrarlo

```ts
// src/lib/instruments/registry.ts
{ id: 'drums', name: 'Batería', family: 'percussion',
  load: async () => new (await import('./plugins/DrumsPlugin')).DrumsPlugin() }
```

`Stage.svelte` recibe `instrumentId`; agregá un selector en `ControlBar` para cambiar de instrumento. Cada plugin se carga con `import()` dinámico, así el bundle inicial no crece.

### 4. Testearlo

Los plugins son lógica pura: alimentalos con `TrackingFrame` sintéticos (ver `src/lib/instruments/__tests__/fixtures.ts`) y verificá los `TriggerEvent` que devuelven.

---

## Agregar canciones

Creá un JSON en `src/lib/songs/data/` y sumalo a `SONGS` en `src/lib/songs/index.ts`:

```json
{
	"id": "mi-cancion",
	"title": "Mi Canción",
	"artist": "Artista",
	"bpm": 100,
	"beatsPerBar": 4,
	"difficulty": "fácil",
	"strumPattern": "↓ ↓ ↑ ↑ ↓ ↑",
	"arrangement": "Notas sobre el arreglo",
	"sections": [
		{ "name": "Estrofa", "bars": [["G"], ["D"], ["Em", "C"]], "repeat": 2 }
	]
}
```

Cada compás es una lista de acordes que se reparten el compás en partes iguales. Los acordes deben existir en `music/chords.ts` (hay un test que lo verifica). Las 4 canciones incluidas son **arreglos simplificados de fogón** (solo progresiones de acordes, sin letra); ajustalos libremente.

---

## Rendimiento y latencia

- `AudioContext({ latencyHint: 'interactive' })`; los eventos se agendan en `currentTime + delay`.
- Sin asignaciones grandes por frame; pool acotado de partículas; inferencia solo cuando el video tiene un frame nuevo.
- El canvas usa `devicePixelRatio` limitado a 2.
- La latencia total percibida depende sobre todo de la cámara (~33 ms a 30 fps) y de la salida de audio del sistema (`AudioEngine.getLatency()`); usar auriculares con cable reduce la latencia de salida respecto de Bluetooth.

## SEO y accesibilidad

La pantalla de bienvenida se prerenderiza (HTML estático con `<title>`, meta description, Open Graph y JSON-LD `WebApplication`). Antes de publicar, agregá `<link rel="canonical">` y URLs absolutas de `og:image` con tu dominio. Controles con roles ARIA (`switch`, `radiogroup`), foco visible, objetivos táctiles ≥44 px y respeto de `prefers-reduced-motion`.

## Limitaciones conocidas

- La lateralidad sin pose visible se infiere de la etiqueta de MediaPipe (menos fiable).
- Los gestos de dedos dependen de la orientación de la mano; mostrá la palma o el dorso a la cámara.
- En iOS Safari la Fullscreen API no está disponible para páginas (instalá la PWA para pantalla completa).
