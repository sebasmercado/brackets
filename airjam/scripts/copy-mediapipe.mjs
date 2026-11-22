/**
 * Copia el runtime WASM de @mediapipe/tasks-vision a `static/mediapipe/wasm`
 * para servirlo desde el mismo origen (sin CDN de terceros, cacheable por el SW).
 */
import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = resolve(root, 'node_modules/@mediapipe/tasks-vision/wasm');
const dest = resolve(root, 'static/mediapipe/wasm');

if (!existsSync(src)) {
	console.warn('[airjam] @mediapipe/tasks-vision no instalado; se omite la copia del WASM.');
	process.exit(0);
}
// Solo la variante clásica (no-module) que usa `FilesetResolver.forVisionTasks(path)`.
const FILES = ['vision_wasm_internal.js', 'vision_wasm_internal.wasm'];
rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
for (const file of FILES) copyFileSync(resolve(src, file), resolve(dest, file));
console.log('[airjam] MediaPipe WASM copiado a static/mediapipe/wasm');
