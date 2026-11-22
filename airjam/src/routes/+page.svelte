<script lang="ts">
	import { onMount } from 'svelte';
	import { asset } from '$app/paths';
	import ChordHud from '#lib/components/ChordHud.svelte';
	import ControlBar from '#lib/components/ControlBar.svelte';
	import Stage from '#lib/components/Stage.svelte';
	import Teleprompter from '#lib/components/Teleprompter.svelte';
	import WelcomeScreen from '#lib/components/WelcomeScreen.svelte';
	import { AudioEngine } from '#lib/instruments/engine/AudioEngine.ts';
	import type { InstrumentHud } from '#lib/instruments/types.ts';
	import { SongPlayer } from '#lib/songs/SongPlayer.svelte.ts';
	import { Settings } from '#lib/state/settings.svelte.ts';
	import { CameraError } from '#lib/tracking/camera.ts';

	type Phase = 'welcome' | 'loading' | 'playing';

	const settings = new Settings();
	const player = new SongPlayer();

	let phase = $state<Phase>('welcome');
	let status = $state<string | null>(null);
	let error = $state<string | null>(null);
	let hud = $state<InstrumentHud | null>(null);
	let fps = $state(0);
	let fullscreen = $state(false);
	let hydrated = $state(false);
	let stage = $state<ReturnType<typeof Stage>>();

	const targetChord = $derived(settings.appMode === 'songs' ? (player.current?.chord ?? null) : null);

	onMount(() => {
		settings.hydrate();
		player.select(settings.songId);
		hydrated = true;
	});

	// Persistencia de preferencias (después de hidratar para no pisar lo guardado).
	$effect(() => {
		if (hydrated) settings.persist();
	});

	// Al salir del modo Canciones, se detiene la reproducción.
	$effect(() => {
		if (settings.appMode === 'free') player.stop();
	});

	async function start() {
		if (phase !== 'welcome') return;
		error = null;
		phase = 'loading';
		status = 'Activando audio…';
		try {
			// Debe ejecutarse dentro del gesto del usuario (política de autoplay).
			await AudioEngine.get().unlock();
			await stage?.start((s) => (status = s));
			phase = 'playing';
		} catch (e) {
			console.error(e);
			error =
				e instanceof CameraError
					? e.message
					: 'No se pudo iniciar AirJam. Revisá tu conexión (la primera vez se descargan los modelos) y volvé a intentar.';
			phase = 'welcome';
		}
	}

	function selectSong(id: string) {
		settings.songId = id;
		player.select(id);
	}

	async function toggleFullscreen() {
		try {
			if (document.fullscreenElement) await document.exitFullscreen();
			else await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
		} catch {
			/* iOS Safari no soporta Fullscreen API en elementos arbitrarios */
		}
	}
</script>

<svelte:head>
	<title>AirJam — Air Guitar acústica en tiempo real con tu cámara</title>
	<meta
		name="description"
		content="Tocá una guitarra acústica en el aire con tu cámara web: tracking de manos con IA en el navegador, sonido Karplus-Strong de baja latencia y modo canciones con teleprompter de acordes."
	/>
	<meta property="og:type" content="website" />
	<meta property="og:title" content="AirJam — Air Guitar acústica" />
	<meta property="og:description" content="Guitarra virtual controlada con tus manos. Gratis, offline y sin instalar nada." />
	<meta property="og:image" content={asset('icons/icon-512.png')} />
	<meta property="og:locale" content="es_AR" />
	<meta name="twitter:card" content="summary" />
	{@html `<script type="application/ld+json">${JSON.stringify({
		'@context': 'https://schema.org',
		'@type': 'WebApplication',
		name: 'AirJam',
		applicationCategory: 'MusicApplication',
		operatingSystem: 'Any',
		browserRequirements: 'Requiere cámara, WebGL y Web Audio API',
		inLanguage: 'es',
		offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
		description: 'Air guitar acústica en tiempo real con computer vision y síntesis física de cuerdas.'
	})}</script>`}
</svelte:head>

<svelte:document onfullscreenchange={() => (fullscreen = !!document.fullscreenElement)} />

<div class="fixed inset-0 overflow-hidden select-none">
	<Stage bind:this={stage} bind:hud bind:fps {settings} {player} />

	{#if phase === 'playing'}
		<div class="pointer-events-none absolute inset-0 flex flex-col justify-between">
			<header class="safe-top px-3">
				{#if settings.appMode === 'songs'}
					<Teleprompter
						{player}
						autoChord={settings.autoChord}
						matched={hud?.matched ?? null}
						onsongchange={selectSong}
						onautochordchange={(auto) => (settings.autoChord = auto)}
					/>
				{:else}
					<div class="flex items-center justify-between">
						<span class="glass rounded-full px-4 py-2 text-sm font-black tracking-tight">
							Air<span class="text-amber-400">Jam</span>
						</span>
						<span class="glass rounded-full px-3 py-1.5 text-[11px] text-zinc-400 tabular-nums">{fps} fps</span>
					</div>
				{/if}
			</header>

			<footer class="safe-bottom flex flex-col items-center gap-3 px-3">
				{#if hud}
					<div class="w-full max-w-4xl">
						<ChordHud {hud} mode={settings.playMode} {targetChord} />
					</div>
				{/if}
				<ControlBar {settings} {fullscreen} ontogglefullscreen={toggleFullscreen} />
			</footer>
		</div>
	{:else}
		<div class="absolute inset-0 overflow-y-auto bg-zinc-950">
			<WelcomeScreen loading={phase === 'loading'} {status} {error} onstart={start} />
		</div>
	{/if}
</div>
