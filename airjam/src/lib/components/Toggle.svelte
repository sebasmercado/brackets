<!--
	@component
	Switch accesible (role="switch") con etiqueta e ícono opcional.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		checked: boolean;
		label: string;
		icon?: Snippet;
		onchange?: (checked: boolean) => void;
	}

	let { checked = $bindable(), label, icon, onchange }: Props = $props();

	function toggle() {
		checked = !checked;
		onchange?.(checked);
	}
</script>

<button
	type="button"
	role="switch"
	aria-checked={checked}
	onclick={toggle}
	class="flex min-h-11 items-center gap-2 rounded-full px-3 text-xs font-medium text-zinc-300 transition-colors hover:bg-white/5 aria-checked:text-white"
>
	{@render icon?.()}
	<span>{label}</span>
	<span class="relative h-5 w-9 rounded-full bg-zinc-700 transition-colors {checked ? 'bg-amber-500' : ''}">
		<span class="absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform duration-200 ease-(--ease-spring) {checked ? 'translate-x-4' : ''}"></span>
	</span>
</button>
