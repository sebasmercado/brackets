<!--
	@component
	Barra flotante de controles: modo (Libre/Canciones), entrada de acordes en
	modo libre (Gestos/Zonas), zurdo, esqueleto, metrónomo y pantalla completa.
-->
<script lang="ts">
	import Bone from '@lucide/svelte/icons/bone';
	import FlipHorizontal from '@lucide/svelte/icons/flip-horizontal-2';
	import Maximize from '@lucide/svelte/icons/maximize';
	import Minimize from '@lucide/svelte/icons/minimize';
	import Timer from '@lucide/svelte/icons/timer';
	import type { AppMode, Settings } from '#lib/state/settings.svelte.ts';
	import type { ChordInputMode } from '#lib/instruments/types.ts';
	import Segmented from './Segmented.svelte';
	import Toggle from './Toggle.svelte';

	interface Props {
		settings: Settings;
		fullscreen: boolean;
		ontogglefullscreen: () => void;
		onchange?: () => void;
	}

	let { settings, fullscreen, ontogglefullscreen, onchange }: Props = $props();

	const appModes = [
		{ value: 'free', label: 'Libre' },
		{ value: 'songs', label: 'Canciones' }
	] as const satisfies readonly { value: AppMode; label: string }[];

	const inputModes = [
		{ value: 'gesture', label: 'Gestos' },
		{ value: 'zone', label: 'Zonas' }
	] as const satisfies readonly { value: ChordInputMode; label: string }[];
</script>

<nav
	aria-label="Controles"
	class="glass pointer-events-auto mx-auto flex max-w-full flex-wrap items-center justify-center gap-1 rounded-full px-2 py-1.5 shadow-2xl shadow-black/40"
>
	<Segmented label="Modo" bind:value={settings.appMode} options={appModes} {onchange} />

	{#if settings.appMode === 'free'}
		<Segmented label="Selección de acordes" bind:value={settings.chordInput} options={inputModes} {onchange} />
	{:else}
		<Toggle label="Metrónomo" bind:checked={settings.metronome} {onchange}>
			{#snippet icon()}<Timer size={16} />{/snippet}
		</Toggle>
	{/if}

	<Toggle label="Zurdo" bind:checked={settings.leftHanded} {onchange}>
		{#snippet icon()}<FlipHorizontal size={16} />{/snippet}
	</Toggle>
	<Toggle label="Esqueleto" bind:checked={settings.showSkeleton} {onchange}>
		{#snippet icon()}<Bone size={16} />{/snippet}
	</Toggle>

	<button
		type="button"
		onclick={ontogglefullscreen}
		aria-label={fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
		class="grid size-11 place-items-center rounded-full text-zinc-300 transition-colors hover:bg-white/10"
	>
		{#if fullscreen}<Minimize size={18} />{:else}<Maximize size={18} />{/if}
	</button>
</nav>
