import adapter from '@sveltejs/adapter-static';
import tailwindcss from '@tailwindcss/vite';
import { withPwa } from '@vite-pwa/sveltekit';
import process from 'node:process';
import { defineConfig } from 'vite';

/**
 * Ruta base del sitio. Vacía en local; `/brackets` en GitHub Pages
 * (la define el workflow de deploy con la variable BASE_PATH).
 */
const base = (process.env.BASE_PATH ?? '') as '' | `/${string}`;

/**
 * SvelteKit 3: la configuración de Kit (antes `svelte.config.js`) se pasa
 * directamente al plugin. `withPwa` envuelve `sveltekit()` e inyecta el
 * Service Worker (Workbox) y el Web App Manifest.
 */
export default defineConfig({
	plugins: [
		tailwindcss(),
		withPwa(
			{
				adapter: adapter({ fallback: '404.html' }),
				paths: { base },
				compilerOptions: { runes: true }
			},
			{
				registerType: 'autoUpdate',
				injectRegister: false,
				manifest: {
					name: 'AirJam — Air Guitar Acústica',
					short_name: 'AirJam',
					description:
						'Tocá una guitarra acústica en el aire con tu cámara: tracking de manos en tiempo real y síntesis de cuerdas Karplus-Strong.',
					lang: 'es',
					start_url: './',
					scope: './',
					display: 'fullscreen',
					display_override: ['fullscreen', 'standalone'],
					orientation: 'any',
					background_color: '#09090b',
					theme_color: '#09090b',
					categories: ['music', 'entertainment', 'education'],
					icons: [
						{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
						{ src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
						{
							src: 'icons/icon-maskable-512.png',
							sizes: '512x512',
							type: 'image/png',
							purpose: 'maskable'
						}
					]
				},
				generateSW: {
					// Rutas relativas al output de Kit (`client/`); el HTML prerenderizado lo agrega el plugin.
					globPatterns: ['client/**/*.{js,css,ico,png,svg,webp,woff2,webmanifest}'],
					// El runtime WASM de MediaPipe (~14 MB) no se precachea: se cachea
					// en el primer uso (CacheFirst) para no inflar la instalación.
					globIgnores: ['**/mediapipe/**'],
					runtimeCaching: [
						{
							urlPattern: ({ url }) => url.pathname.includes('/mediapipe/wasm/'),
							handler: 'CacheFirst',
							options: {
								cacheName: 'airjam-mediapipe-wasm',
								expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 90 }
							}
						},
						{
							urlPattern: ({ url }) => url.hostname === 'storage.googleapis.com',
							handler: 'CacheFirst',
							options: {
								cacheName: 'airjam-mediapipe-models',
								expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 90 },
								cacheableResponse: { statuses: [0, 200] }
							}
						}
					]
				},
				devOptions: { enabled: false }
			}
		)
	]
});
