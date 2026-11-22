<!--
	@component
	Diagrama de acorde en SVG (cuerdas verticales, 6ª a la izquierda).
	Muestra dedos numerados, cuerdas al aire (○), apagadas (×) y cejillas.
-->
<script lang="ts">
	import { getChord } from '#lib/instruments/music/chords.ts';

	interface Props {
		chord: string | null;
		size?: number;
		showGesture?: boolean;
	}

	let { chord, size = 96, showGesture = false }: Props = $props();

	const def = $derived(getChord(chord));
	const FRETS = 4;
	const W = 60;
	const H = 72;
	const left = 8;
	const top = 14;
	const sx = (W - left * 2) / 5;
	const fy = (H - top - 6) / FRETS;

	const frettedValues = $derived((def?.frets ?? []).filter((f): f is number => f !== null && f > 0));
	const baseFret = $derived(Math.max(...frettedValues, 0) > FRETS ? Math.min(...frettedValues) : 1);

	/** Cejilla: el dedo 1 pisa el mismo traste en ≥2 cuerdas. */
	const barre = $derived.by(() => {
		if (!def) return null;
		const idx = def.fingers.map((f, i) => (f === 1 ? i : -1)).filter((i) => i >= 0);
		if (idx.length < 2) return null;
		const fret = def.frets[idx[0] ?? 0];
		if (fret == null || idx.some((i) => def.frets[i] !== fret)) return null;
		return { from: Math.min(...idx), to: Math.max(...idx), fret };
	});
</script>

{#if def}
	<figure class="flex flex-col items-center gap-1" aria-label={`Diagrama del acorde ${def.label}`}>
		<svg viewBox={`0 0 ${W} ${H}`} width={size} height={(size * H) / W} role="img">
			<title>{def.label} ({def.name})</title>
			{#if baseFret === 1}
				<rect x={left - 1} y={top - 2} width={W - left * 2 + 2} height="2.5" rx="1" fill="#e4e4e7" />
			{:else}
				<text x="1" y={top + fy / 2 + 2} font-size="6" fill="#a1a1aa">{baseFret}</text>
			{/if}
			{#each Array.from({ length: FRETS + 1 }, (_, i) => i) as i (i)}
				<line x1={left} x2={W - left} y1={top + i * fy} y2={top + i * fy} stroke="#52525b" stroke-width="0.8" />
			{/each}
			{#each def.frets as fret, s (s)}
				<line x1={left + s * sx} x2={left + s * sx} y1={top} y2={top + FRETS * fy} stroke="#a1a1aa" stroke-width={1.3 - s * 0.12} />
				{#if fret === null}
					<text x={left + s * sx} y={top - 5} font-size="6" text-anchor="middle" fill="#f87171">×</text>
				{:else if fret === 0}
					<circle cx={left + s * sx} cy={top - 6.5} r="2" fill="none" stroke="#d4d4d8" stroke-width="0.8" />
				{/if}
			{/each}
			{#if barre}
				<rect
					x={left + barre.from * sx - 3}
					y={top + (barre.fret - baseFret + 0.5) * fy - 3}
					width={(barre.to - barre.from) * sx + 6}
					height="6"
					rx="3"
					fill="#f59e0b"
				/>
			{/if}
			{#each def.frets as fret, s (s)}
				{#if fret && fret > 0 && !(barre && def.fingers[s] === 1 && fret === barre.fret)}
					<circle cx={left + s * sx} cy={top + (fret - baseFret + 0.5) * fy} r="3.6" fill="#f59e0b" />
					<text x={left + s * sx} y={top + (fret - baseFret + 0.5) * fy + 2} font-size="5" font-weight="700" text-anchor="middle" fill="#09090b">
						{def.fingers[s] ?? ''}
					</text>
				{/if}
			{/each}
		</svg>
		{#if showGesture}
			<figcaption class="flex items-center gap-1 text-[11px] text-zinc-300">
				<span aria-hidden="true" class="text-base">{def.gestureEmoji}</span>
				{def.gestureHint}
			</figcaption>
		{/if}
	</figure>
{/if}
