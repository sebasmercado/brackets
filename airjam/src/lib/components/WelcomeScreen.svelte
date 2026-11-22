<!--
	@component
	Pantalla de bienvenida: explica la experiencia, pide permisos y desbloquea
	el AudioContext con un gesto explícito del usuario.
-->
<script lang="ts">
	import Camera from '@lucide/svelte/icons/camera';
	import Guitar from '@lucide/svelte/icons/guitar';
	import Hand from '@lucide/svelte/icons/hand';
	import ListMusic from '@lucide/svelte/icons/list-music';
	import LoaderCircle from '@lucide/svelte/icons/loader-circle';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import Volume2 from '@lucide/svelte/icons/volume-2';

	interface Props {
		loading: boolean;
		status: string | null;
		error: string | null;
		onstart: () => void;
	}

	let { loading, status, error, onstart }: Props = $props();

	const features = [
		{ icon: Hand, title: 'Tracking de manos', text: 'MediaPipe en tu dispositivo: nada sale de tu navegador.' },
		{ icon: Volume2, title: 'Audio de baja latencia', text: 'Síntesis física Karplus-Strong con caja acústica.' },
		{ icon: ListMusic, title: 'Modo Canciones', text: 'Teleprompter de acordes con Auto-Acorde o Manual.' }
	] as const;
</script>

<main class="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-10">
	<!-- Fondo decorativo -->
	<div aria-hidden="true" class="pointer-events-none absolute inset-0">
		<div class="absolute -top-40 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-amber-500/15 blur-3xl"></div>
		<div class="absolute right-0 bottom-0 size-80 rounded-full bg-sky-500/10 blur-3xl"></div>
		<div class="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent_0,transparent_calc(16.66%-1px),rgba(255,255,255,0.03)_calc(16.66%-1px),rgba(255,255,255,0.03)_16.66%)]"></div>
	</div>

	<div class="relative flex w-full max-w-xl flex-col items-center text-center">
		<div class="mb-6 grid size-16 place-items-center rounded-2xl bg-amber-500 text-zinc-950 shadow-xl shadow-amber-500/30">
			<Guitar size={34} strokeWidth={2.2} />
		</div>

		<h1 class="text-5xl font-black tracking-tight text-balance sm:text-6xl">
			Air<span class="text-amber-400">Jam</span>
		</h1>
		<p class="mt-4 max-w-md text-lg text-pretty text-zinc-300">
			Tocá una <strong class="text-white">guitarra acústica en el aire</strong>. Una mano sostiene el mástil, la otra
			rasguea: tu cámara hace el resto.
		</p>

		<ul class="mt-8 grid w-full gap-3 text-left sm:grid-cols-3">
			{#each features as feature (feature.title)}
				<li class="glass rounded-2xl p-4">
					<feature.icon size={20} class="text-amber-400" />
					<h2 class="mt-2 text-sm font-semibold text-white">{feature.title}</h2>
					<p class="mt-1 text-xs text-zinc-400">{feature.text}</p>
				</li>
			{/each}
		</ul>

		<button
			type="button"
			onclick={onstart}
			disabled={loading}
			class="group mt-10 inline-flex min-h-14 items-center gap-3 rounded-full bg-amber-500 px-8 text-base font-bold text-zinc-950 shadow-xl shadow-amber-500/30 transition-all hover:bg-amber-400 hover:shadow-amber-400/40 active:scale-[0.98] disabled:cursor-wait disabled:opacity-80"
		>
			{#if loading}
				<LoaderCircle size={22} class="animate-spin" />
				<span>{status ?? 'Preparando…'}</span>
			{:else}
				<Camera size={22} class="transition-transform group-hover:scale-110" />
				<span>Iniciar Audio & Cámara</span>
			{/if}
		</button>

		{#if error}
			<p role="alert" class="mt-5 flex items-start gap-2 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-left text-sm text-red-200">
				<TriangleAlert size={18} class="mt-0.5 shrink-0" />
				<span>{error}</span>
			</p>
		{/if}

		<p class="mt-6 text-xs text-zinc-500">
			Consejo: alejate ~1,5 m, con buena luz y hombros visibles. Usá auriculares para evitar retorno.
		</p>
	</div>
</main>
