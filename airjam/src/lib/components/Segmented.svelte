<!--
	@component
	Control segmentado accesible (radiogroup) genérico.
-->
<script lang="ts" generics="T extends string | number">
	interface Option {
		value: T;
		label: string;
	}

	interface Props {
		value: T;
		options: readonly Option[];
		label: string;
		onchange?: (value: T) => void;
	}

	let { value = $bindable(), options, label, onchange }: Props = $props();

	function select(v: T) {
		value = v;
		onchange?.(v);
	}

	function onkeydown(event: KeyboardEvent) {
		const i = options.findIndex((o) => o.value === value);
		const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
		if (!delta) return;
		event.preventDefault();
		const next = options[(i + delta + options.length) % options.length];
		if (next) select(next.value);
	}
</script>

<div role="radiogroup" aria-label={label} tabindex="-1" class="flex rounded-full bg-white/5 p-1" {onkeydown}>
	{#each options as option (option.value)}
		<button
			type="button"
			role="radio"
			aria-checked={option.value === value}
			tabindex={option.value === value ? 0 : -1}
			onclick={() => select(option.value)}
			class="min-h-9 rounded-full px-3 text-xs font-semibold transition-all duration-200 {option.value === value
				? 'bg-white text-zinc-950 shadow'
				: 'text-zinc-400 hover:text-zinc-100'}"
		>
			{option.label}
		</button>
	{/each}
</div>
