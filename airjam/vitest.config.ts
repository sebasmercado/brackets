import type { OxcOptions } from 'vite';
import { defineConfig } from 'vitest/config';

// Config separada de `vite.config.ts` para testear la lógica pura sin levantar SvelteKit/PWA.
export default defineConfig({
	// Kit 3 usa `extends: "$app/tsconfig"`, que el transformador oxc no resuelve:
	// para los tests basta con quitar tipos sin leer el tsconfig. (`tsconfig` existe en
	// runtime pero Vite lo omite del tipo público, de ahí la aserción.)
	oxc: { tsconfig: false } as OxcOptions,
	test: {
		include: ['src/**/*.test.ts'],
		environment: 'node'
	}
});
