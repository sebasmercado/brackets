<!--
	@component
	HUD del acorde activo: nombre grande, estado de coincidencia (modo manual),
	gesto detectado y mensajes de guía.
-->
<script lang="ts">
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import { getChord } from '#lib/instruments/music/chords.ts';
	import type { InstrumentHud, PlayMode } from '#lib/instruments/types.ts';
	import ChordDiagram from './ChordDiagram.svelte';

	interface Props {
		hud: InstrumentHud;
		mode: PlayMode;
		targetChord: string | null;
	}

	let { hud, mode, targetChord }: Props = $props();

	const shown = $derived(mode === 'song-manual' ? targetChord : hud.activeChord);
	const def = $derived(getChord(shown));
	const detected = $derived(getChord(hud.detectedChord));
</script>

<div class="pointer-events-none flex items-end gap-3" aria-live="polite">
	<div class="glass flex items-center gap-3 rounded-3xl px-4 py-3">
		<div class="flex flex-col">
			<span class="text-[10px] font-semibold tracking-[0.2em] text-zinc-400 uppercase">
				{mode === 'song-manual' ? 'Formá' : 'Acorde'}
			</span>
			<span
				class="text-5xl leading-none font-black tracking-tight tabular-nums transition-colors {hud.matched === false
					? 'text-red-400'
					: hud.matched
						? 'text-emerald-400'
						: 'text-white'}"
			>
				{shown ?? '—'}
			</span>
			{#if def}<span class="mt-1 text-xs text-zinc-400">{def.label}</span>{/if}
		</div>

		{#if mode !== 'song-auto' && def}
			<div class="hidden border-l border-white/10 pl-3 sm:block">
				<ChordDiagram chord={shown} size={56} />
			</div>
		{/if}

		{#if mode === 'song-manual' && hud.matched !== null}
			<div class="flex flex-col items-center gap-1 border-l border-white/10 pl-3 text-xs">
				{#if hud.matched}
					<CircleCheck class="text-emerald-400" size={22} />
					<span class="text-emerald-300">¡Bien!</span>
				{:else}
					<TriangleAlert class="text-red-400" size={22} />
					<span class="text-zinc-300">
						{def ? `${def.gestureEmoji} ${def.gestureHint}` : ''}
					</span>
					{#if detected}<span class="text-zinc-500">Detectado: {detected.name}</span>{/if}
				{/if}
			</div>
		{/if}
	</div>

	{#if hud.hint}
		<p class="glass mb-1 rounded-full px-4 py-2 text-sm text-zinc-200">{hud.hint}</p>
	{/if}
</div>
