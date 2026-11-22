/**
 * Genera iconos PNG placeholder para la PWA sin dependencias externas
 * (rasterizado manual + codificación PNG con zlib).
 *
 * Diseño: fondo zinc-950, boca de guitarra ámbar y 6 cuerdas.
 * Uso: `npm run icons`
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const out = resolve(dirname(fileURLToPath(import.meta.url)), '../static/icons');
mkdirSync(out, { recursive: true });

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
	let c = n;
	for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	return c >>> 0;
});
const crc32 = (buf) => {
	let c = 0xffffffff;
	for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
	const len = Buffer.alloc(4);
	len.writeUInt32BE(data.length);
	const td = Buffer.concat([Buffer.from(type), data]);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(td));
	return Buffer.concat([len, td, crc]);
};

function png(size, pixel) {
	const raw = Buffer.alloc((size * 4 + 1) * size);
	for (let y = 0; y < size; y++) {
		raw[y * (size * 4 + 1)] = 0;
		for (let x = 0; x < size; x++) {
			const [r, g, b, a] = pixel(x / size, y / size);
			const i = y * (size * 4 + 1) + 1 + x * 4;
			raw[i] = r;
			raw[i + 1] = g;
			raw[i + 2] = b;
			raw[i + 3] = a;
		}
	}
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(size, 0);
	ihdr.writeUInt32BE(size, 4);
	ihdr[8] = 8;
	ihdr[9] = 6;
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk('IHDR', ihdr),
		chunk('IDAT', deflateSync(raw)),
		chunk('IEND', Buffer.alloc(0))
	]);
}

/** @param {number} scale tamaño relativo del motivo (maskable usa zona segura del 80%). */
const icon = (scale, rounded) => (u, v) => {
	const cx = u - 0.5;
	const cy = v - 0.5;
	if (rounded) {
		const r = 0.22;
		const qx = Math.max(Math.abs(cx) - (0.5 - r), 0);
		const qy = Math.max(Math.abs(cy) - (0.5 - r), 0);
		if (Math.hypot(qx, qy) > r) return [0, 0, 0, 0];
	}
	const d = Math.hypot(cx, cy) / scale;
	let col = [9, 9, 11];
	if (d < 0.34) col = [245, 158, 11]; // ámbar
	if (d < 0.27) col = [24, 24, 27];
	// 6 cuerdas verticales
	for (let s = 0; s < 6; s++) {
		const sx = (s - 2.5) * 0.045 * scale;
		if (Math.abs(cx - sx) < 0.006 * scale + 0.002 && Math.abs(cy) < 0.42 * scale)
			col = [244, 244, 245];
	}
	return [...col, 255];
};

writeFileSync(resolve(out, 'icon-192.png'), png(192, icon(1, true)));
writeFileSync(resolve(out, 'icon-512.png'), png(512, icon(1, true)));
writeFileSync(resolve(out, 'icon-maskable-512.png'), png(512, icon(0.8, false)));
writeFileSync(resolve(out, 'apple-touch-icon.png'), png(180, icon(0.85, false)));
console.log('[airjam] Iconos generados en static/icons');
