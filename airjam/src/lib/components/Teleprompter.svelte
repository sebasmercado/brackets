<!--
	@component
	Teleprompter de acordes estilo "Guitar Hero" minimalista: línea de tiempo
	horizontal que se desplaza al BPM, acorde actual resaltado con progreso del
	compás, próximos acordes entrando y diagrama de digitación/gesto.
-->
<script lang="ts">
	import Pause from '@lucide/svelte/icons/pause';
	import Play from '@lucide/svelte/icons/play';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import { SONGS } from '#lib/songs/index.ts';
	import type { PlaybackSpeed, SongPlayer } from '#lib/songs/SongPlayer.svelte.ts';
	import ChordDiagram from './ChordDiagram.svelte';
	import Segmented from './Segmented.svelte';

	interface Props {
		player: SongPlayer;
		autoChord: boolean;
		/** En modo manual: si el gesto actual coincide con el acorde pedido. */
		matched: boolean | null;
		onsongchange?: (id: string) => void;
		onautochordchange?: (auto: boolean) => void;
	}

	let { player, autoChord, matched, onsongchange, onautochordchange }: Props = $props();

	const PX_PER_BEAT = 30;
	const WINDOW_BEATS = { before: 6, after: 40 };

	const visible = $derived(
		player.timeline.events.filter(
			(e) =>
				e.startBeat + e.beats >= player.position - WINDOW_BEATS.before &&
				e.startBeat <= player.position + WINDOW_BEATS.after
		)
	);

	const diagramChord = $derived(
		player.countingIn ? (player.timeline.events[0]?.chord ?? null) : (player.current?.chord ?? null)
	);
	const countdown = $derived(player.countingIn ? Math.ceil(-player.position) : null);

	const speedOptions = [
		{ value: 0.75, label: '0.75×' },
		{ value: 1, label: '1×' }
	] as const satisfies readonly { value: PlaybackSpeed; label: string }[];

	const modeOptions = [
		{ value: 'auto', label: 'Auto-Acorde' },
		{ value: 'manual', label: 'Manual' }
	] as const;
</script>

<section aria-label="Teleprompter de acordes" class="glass pointer-events-auto mx-auto w-full max-w-4xl rounded-3xl p-3 shadow-2xl shadow-black/40">
	<!-- Controles -->
	<div class="flex flex-wrap items-center gap-2">
		<button
			type="button"
			onclick={() => player.toggle()}
			aria-label={player.playing ? 'Pausar' : 'Reproducir'}
			class="grid size-11 shrink-0 place-items-center rounded-full bg-amber-500 text-zinc-950 shadow-lg shadow-amber-500/30 transition-transform hover:scale-105 active:scale-95"
		>
			{#if player.playing}<Pause size={20} fill="currentColor" />{:else}<Play size={20} fill="currentColor" class="translate-x-px" />{/if}
		</button>
		<button
			type="button"
			onclick={() => player.restart()}
			aria-label="Reiniciar canción"
			class="grid size-11 shrink-0 place-items-center rounded-full text-zinc-300 transition-colors hover:bg-white/10"
		>
			<RotateCcw size={18} />
		</button>

		<label class="min-w-0 flex-1">
			<span class="sr-only">Canción</span>
			<select
				value={player.song.id}
				onchange={(e) => onsongchange?.(e.currentTarget.value)}
				class="w-full min-w-0 truncate rounded-full border-0 bg-white/5 px-4 py-2.5 text-sm font-semibold text-zinc-100 focus:ring-2 focus:ring-amber-500"
			>
				{#each SONGS as song (song.id)}
					<option value={song.id} class="bg-zinc-900">{song.title} — {song.artist}</option>
				{/each}
			</select>
		</label>

		<Segmented
			label="Velocidad"
			value={player.speed}
			options={speedOptions}
			onchange={(v) => player.setSpeed(v)}
		/>
		<Segmented
			label="Modo de acordes"
			value={autoChord ? 'auto' : 'manual'}
			options={modeOptions}
			onchange={(v) => onautochordchange?.(v === 'auto')}
		/>
	</div>

	<!-- Línea de tiempo + diagrama -->
	<div class="mt-3 flex items-stretch gap-3">
		<div class="relative h-20 min-w-0 flex-1 overflow-hidden rounded-2xl bg-black/30" aria-live="off">
			<!-- Cabezal de reproducción -->
			<div class="absolute inset-y-0 left-[18%] z-10 w-0.5 bg-amber-400 shadow-[0_0_12px_2px_rgba(251,191,36,0.6)]"></div>

			<div
				class="absolute inset-y-0 left-[18%] will-change-transform"
				style:transform={`translate3d(${-player.position * PX_PER_BEAT}px,0,0)`}
			>
				{#each visible as event (event.index)}
					{@const isCurrent = event.index === player.currentIndex && !player.countingIn}
					{@const isPast = event.startBeat + event.beats <= player.position}
					<div
						class="absolute top-2 bottom-2 flex flex-col justify-center overflow-hidden rounded-xl border px-2 transition-[background-color,border-color,opacity] duration-200
						{isCurrent
							? matched === false && !autoChord
								? 'border-red-400/70 bg-red-500/25'
								: 'border-amber-400/80 bg-amber-500/25'
							: 'border-white/10 bg-white/5'}
						{isPast ? 'opacity-30' : ''}"
						style:left={`${event.startBeat * PX_PER_BEAT}px`}
						style:width={`${event.beats * PX_PER_BEAT - 4}px`}
					>
						{#if isCurrent}
							<div class="absolute inset-y-0 left-0 bg-amber-400/25" style:width={`${player.chordProgress * 100}%`}></div>
						{/if}
						<span class="relative text-lg leading-none font-bold {isCurrent ? 'text-white' : 'text-zinc-300'}">{event.chord}</span>
						<span class="relative mt-1 truncate text-[10px] tracking-wide text-zinc-400 uppercase">{event.section}</span>
					</div>
				{/each}
			</div>

			<!-- Progreso del compás -->
			<div class="absolute inset-x-0 bottom-0 h-1 bg-white/5">
				<div class="h-full bg-amber-400/80" style:width={`${player.barProgress * 100}%`}></div>
			</div>

			{#if countdown !== null}
				<div class="absolute inset-0 z-20 grid place-items-center bg-black/40 text-4xl font-black text-amber-400" aria-live="assertive">
					{countdown}
				</div>
			{/if}
		</div>

		<div class="hidden shrink-0 flex-col items-center justify-center rounded-2xl bg-black/30 px-3 py-1 sm:flex">
			<ChordDiagram chord={diagramChord} size={64} showGesture={!autoChord} />
		</div>
	</div>

	<p class="mt-2 flex flex-wrap items-center justify-between gap-x-3 px-1 text-[11px] text-zinc-400">
		<span>{player.song.bpm} BPM · Rasgueo: <span class="text-zinc-200">{player.song.strumPattern}</span></span>
		<span class="truncate">{player.song.arrangement}</span>
	</p>
</section>
