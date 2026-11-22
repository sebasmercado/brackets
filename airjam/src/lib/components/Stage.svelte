<!--
	@component
	Escenario en tiempo real: `<video>` espejado + `<canvas>` superpuesto.

	Loop único (requestAnimationFrame):
	  1. Reloj del SongPlayer   → acorde objetivo
	  2. VisionTracker.detect() → TrackingFrame
	  3. plugin.update()        → TriggerEvent[] → AudioEngine.dispatch()
	  4. render (esqueleto + instrumento) y HUD
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { AudioEngine } from '#lib/instruments/engine/AudioEngine.ts';
	import type { KarplusStrongSynth } from '#lib/instruments/engine/KarplusStrongSynth.ts';
	import { findInstrument } from '#lib/instruments/registry.ts';
	import type { InstrumentHud, InstrumentPlugin, TrackingFrame } from '#lib/instruments/types.ts';
	import type { SongPlayer } from '#lib/songs/SongPlayer.svelte.ts';
	import type { Settings } from '#lib/state/settings.svelte.ts';
	import { startCamera, stopCamera } from '#lib/tracking/camera.ts';
	import { drawSkeleton } from '#lib/tracking/skeleton.ts';
	import { coverTransform } from '#lib/tracking/view.ts';
	import type { TrackerStage, VisionTracker } from '#lib/tracking/VisionTracker.ts';

	interface Props {
		settings: Settings;
		player: SongPlayer;
		instrumentId?: string;
		hud?: InstrumentHud | null;
		fps?: number;
	}

	let {
		settings,
		player,
		instrumentId = 'acoustic-guitar',
		hud = $bindable(null),
		fps = $bindable(0)
	}: Props = $props();

	let video: HTMLVideoElement;
	let canvas: HTMLCanvasElement;
	let container: HTMLDivElement;
	let running = $state(false);

	const engine = AudioEngine.get();
	let plugin: InstrumentPlugin | null = null;
	let tracker: VisionTracker | null = null;
	let stream: MediaStream | null = null;
	let raf = 0;
	let lastFrame: TrackingFrame | null = null;
	let fpsCounter = { frames: 0, since: 0 };
	let resizeObserver: ResizeObserver | null = null;
	let cssSize = { width: 0, height: 0, dpr: 1 };

	const STAGE_LABELS: Record<TrackerStage, string> = {
		runtime: 'Cargando motor de visión…',
		'pose-model': 'Cargando modelo de pose…',
		'hand-model': 'Cargando modelo de manos…',
		ready: 'Listo'
	};

	/**
	 * Arranca cámara, modelos e instrumento. El audio debe haberse desbloqueado
	 * antes (dentro del gesto del usuario).
	 */
	export async function start(onStatus: (status: string) => void): Promise<void> {
		onStatus('Solicitando cámara…');
		stream = await startCamera(video);

		const descriptor = findInstrument(instrumentId);
		if (!descriptor) throw new Error(`Instrumento desconocido: ${instrumentId}`);
		plugin = await descriptor.load();
		syncPluginConfig();

		const { VisionTracker } = await import('#lib/tracking/VisionTracker.ts');
		tracker = new VisionTracker({ onStage: (s) => onStatus(STAGE_LABELS[s]) });
		await tracker.init();

		warmupAudio();
		observeSize();
		player.onBeat = ({ beatInBar, countIn }) => {
			if (!countIn && !settings.metronome) return;
			engine.trigger({
				instrumentId: 'metronome',
				synth: 'click',
				channel: 0,
				frequency: 0,
				velocity: countIn ? 0.9 : 0.55,
				delay: 0,
				articulation: beatInBar === 0 ? 'accent' : 'normal'
			});
		};

		running = true;
		raf = requestAnimationFrame(loop);
	}

	function syncPluginConfig() {
		plugin?.configure({
			mode: settings.playMode,
			leftHanded: settings.leftHanded,
			chordInput: settings.chordInput,
			targetChord: settings.appMode === 'songs' ? (player.current?.chord ?? player.timeline.events[0]?.chord ?? null) : null
		});
	}

	// Reconfigura el plugin cuando cambian preferencias o el acorde de la canción.
	$effect(() => {
		void settings.playMode;
		void settings.leftHanded;
		void settings.chordInput;
		void player.current;
		syncPluginConfig();
	});

	/** Pre-renderiza buffers Karplus-Strong en tiempo ocioso. */
	async function warmupAudio() {
		const synth = engine.getSynth<KarplusStrongSynth>('karplus-strong');
		if (!synth) return;
		const { guitarWarmupFrequencies } = await import('#lib/instruments/plugins/AcousticGuitarPlugin.ts');
		const queue = guitarWarmupFrequencies();
		const idle = (cb: () => void) =>
			'requestIdleCallback' in window ? requestIdleCallback(cb, { timeout: 500 }) : setTimeout(cb, 16);
		const step = () => {
			const batch = queue.splice(0, 2);
			if (batch.length === 0) return;
			synth.warmup(batch);
			idle(step);
		};
		idle(step);
	}

	function observeSize() {
		const apply = () => {
			const rect = container.getBoundingClientRect();
			const dpr = Math.min(2, window.devicePixelRatio || 1);
			cssSize = { width: rect.width, height: rect.height, dpr };
			canvas.width = Math.round(rect.width * dpr);
			canvas.height = Math.round(rect.height * dpr);
		};
		resizeObserver = new ResizeObserver(apply);
		resizeObserver.observe(container);
		apply();
	}

	function loop(now: number) {
		raf = requestAnimationFrame(loop);
		if (!plugin || !tracker) return;

		player.tick(now);

		const frame = tracker.detect(video, now);
		if (frame) {
			lastFrame = frame;
			const events = plugin.update(frame);
			if (events.length) engine.dispatch(events);
			countFps(now);
		}

		const ctx = canvas.getContext('2d');
		if (ctx && video.videoWidth) {
			ctx.setTransform(1, 0, 0, 1, 0, 0);
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			const view = coverTransform(video.videoWidth, video.videoHeight, cssSize.width, cssSize.height, cssSize.dpr);
			if (settings.showSkeleton && lastFrame) drawSkeleton(ctx, view, lastFrame);
			plugin.render(ctx, view, now);
		}

		const next = plugin.getHud();
		if (next !== hud) hud = next;
	}

	function countFps(now: number) {
		fpsCounter.frames++;
		if (now - fpsCounter.since >= 1000) {
			fps = Math.round((fpsCounter.frames * 1000) / (now - fpsCounter.since));
			fpsCounter = { frames: 0, since: now };
		}
	}

	function onVisibilityChange() {
		if (!running) return;
		if (document.hidden) {
			player.pause();
			void engine.suspend();
		} else {
			void engine.resume();
		}
	}

	// Limpieza solo en el cliente (onMount no corre durante el prerender).
	onMount(() => () => {
		cancelAnimationFrame(raf);
		resizeObserver?.disconnect();
		stopCamera(stream);
		tracker?.dispose();
		plugin?.dispose();
		player.onBeat = null;
	});
</script>

<svelte:document onvisibilitychange={onVisibilityChange} />

<div bind:this={container} class="absolute inset-0 overflow-hidden bg-black" class:invisible={!running}>
	<!-- svelte-ignore a11y_media_has_caption -->
	<video
		bind:this={video}
		class="absolute inset-0 size-full -scale-x-100 object-cover opacity-80"
		playsinline
		muted
		aria-hidden="true"
	></video>
	<div aria-hidden="true" class="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/60"></div>
	<canvas
		bind:this={canvas}
		class="absolute inset-0 size-full"
		aria-label="Guitarra virtual superpuesta a la cámara"
	></canvas>
</div>
