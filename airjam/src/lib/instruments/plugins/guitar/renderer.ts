/**
 * Render en Canvas 2D de la guitarra acústica.
 * Dibuja en coordenadas de video (px) aplicando la `ViewTransform` una sola vez.
 */
import { FREE_MODE_CHORDS } from '../../music/chords';
import type { ViewTransform } from '../../types';
import { add, lerp, scale } from '../../utils/vector';
import { STRING_COUNT, STRUM_ZONE } from './constants';
import type { ParticleSystem, StringVibrations } from './effects';
import type { GuitarGeometry } from './geometry';

export type NeckFeedback = 'neutral' | 'match' | 'miss';

export interface GuitarScene {
	geometry: GuitarGeometry;
	/** Etiqueta por cuerda (nota actual o "×" si está apagada). */
	labels: readonly string[];
	muted: readonly boolean[];
	vibrations: StringVibrations;
	particles: ParticleSystem;
	feedback: NeckFeedback;
	/** Indicador de zonas (modo libre por zonas). */
	zone: { index: number; progress: number } | null;
	now: number;
}

const STRING_WIDTH = [0.012, 0.0102, 0.0086, 0.007, 0.0054, 0.0044] as const;
const WOUND = [true, true, true, true, false, false] as const;

const FEEDBACK_COLORS: Record<NeckFeedback, string> = {
	neutral: 'rgba(255,255,255,0.05)',
	match: 'rgba(52,211,153,0.16)',
	miss: 'rgba(248,113,113,0.2)'
};

export function applyView(ctx: CanvasRenderingContext2D, view: ViewTransform): void {
	const k = view.devicePixelRatio * view.scale;
	ctx.setTransform(k, 0, 0, k, view.devicePixelRatio * view.offsetX, view.devicePixelRatio * view.offsetY);
}

export function drawGuitar(ctx: CanvasRenderingContext2D, view: ViewTransform, scene: GuitarScene): void {
	const { geometry: g } = scene;
	ctx.save();
	applyView(ctx, view);
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';

	drawBody(ctx, g);
	drawNeck(ctx, g, scene.feedback);
	if (scene.zone) drawZoneGauge(ctx, g, scene.zone);
	drawStrings(ctx, g, scene);
	drawLabels(ctx, g, scene);
	drawParticles(ctx, scene);

	ctx.restore();
}

/* -------------------------------------------------------------------------- */

function drawBody(ctx: CanvasRenderingContext2D, g: GuitarGeometry): void {
	const u = g.unit;
	const angle = Math.atan2(-g.axis.y, -g.axis.x); // eje local X → hacia la cejuela

	ctx.save();
	ctx.translate(g.bodyCenter.x, g.bodyCenter.y);
	ctx.rotate(angle);
	ctx.scale(u, u);

	// Silueta de guitarra acústica (dreadnought simplificada), simétrica en Y.
	const o = -0.1;
	ctx.beginPath();
	ctx.moveTo(-0.52 + o, 0);
	ctx.bezierCurveTo(-0.52 + o, -0.3, -0.32 + o, -0.37, -0.14 + o, -0.36);
	ctx.bezierCurveTo(0 + o, -0.35, 0.03 + o, -0.24, 0.12 + o, -0.24);
	ctx.bezierCurveTo(0.2 + o, -0.24, 0.22 + o, -0.29, 0.34 + o, -0.29);
	ctx.bezierCurveTo(0.5 + o, -0.29, 0.56 + o, -0.18, 0.56 + o, 0);
	ctx.bezierCurveTo(0.56 + o, 0.18, 0.5 + o, 0.29, 0.34 + o, 0.29);
	ctx.bezierCurveTo(0.22 + o, 0.29, 0.2 + o, 0.24, 0.12 + o, 0.24);
	ctx.bezierCurveTo(0.03 + o, 0.24, 0 + o, 0.35, -0.14 + o, 0.36);
	ctx.bezierCurveTo(-0.32 + o, 0.37, -0.52 + o, 0.3, -0.52 + o, 0);
	ctx.closePath();

	const grad = ctx.createRadialGradient(0, 0, 0.05, 0, 0, 0.6);
	grad.addColorStop(0, 'rgba(245,158,11,0.16)');
	grad.addColorStop(1, 'rgba(245,158,11,0.04)');
	ctx.fillStyle = grad;
	ctx.fill();
	ctx.lineWidth = 0.008;
	ctx.strokeStyle = 'rgba(253,230,138,0.35)';
	ctx.stroke();

	// Boca (roseta).
	ctx.beginPath();
	ctx.arc(0.16, 0, 0.1, 0, Math.PI * 2);
	ctx.fillStyle = 'rgba(9,9,11,0.45)';
	ctx.fill();
	ctx.lineWidth = 0.012;
	ctx.strokeStyle = 'rgba(253,230,138,0.4)';
	ctx.stroke();

	// Puente.
	ctx.fillStyle = 'rgba(120,53,15,0.55)';
	ctx.fillRect(-0.44, -0.12, 0.05, 0.24);
	ctx.restore();
}

function drawNeck(ctx: CanvasRenderingContext2D, g: GuitarGeometry, feedback: NeckFeedback): void {
	const toNut = scale(g.axis, -1);
	const joint = add(g.bodyCenter, scale(toNut, g.unit * 0.42));
	const jointHalf = g.nutWidth * 0.62 + g.unit * 0.012;
	const nutHalf = g.nutWidth * 0.58;

	// Diapasón.
	ctx.beginPath();
	ctx.moveTo(joint.x + g.up.x * jointHalf, joint.y + g.up.y * jointHalf);
	ctx.lineTo(g.nut.x + g.up.x * nutHalf, g.nut.y + g.up.y * nutHalf);
	ctx.lineTo(g.nut.x - g.up.x * nutHalf, g.nut.y - g.up.y * nutHalf);
	ctx.lineTo(joint.x - g.up.x * jointHalf, joint.y - g.up.y * jointHalf);
	ctx.closePath();
	ctx.fillStyle = FEEDBACK_COLORS[feedback];
	ctx.fill();
	ctx.lineWidth = g.unit * 0.004;
	ctx.strokeStyle = feedback === 'miss' ? 'rgba(248,113,113,0.6)' : 'rgba(255,255,255,0.14)';
	ctx.stroke();

	// Trastes con espaciado de temperamento igual (regla del 17.817).
	const neckLen = Math.hypot(joint.x - g.nut.x, joint.y - g.nut.y);
	ctx.strokeStyle = 'rgba(228,228,231,0.22)';
	ctx.lineWidth = g.unit * 0.003;
	for (let n = 1; n <= 14; n++) {
		const d = g.length * (1 - 2 ** (-n / 12));
		if (d > neckLen) break;
		const p = add(g.nut, scale(g.axis, d));
		const half = nutHalf + (jointHalf - nutHalf) * (d / neckLen);
		ctx.beginPath();
		ctx.moveTo(p.x + g.up.x * half, p.y + g.up.y * half);
		ctx.lineTo(p.x - g.up.x * half, p.y - g.up.y * half);
		ctx.stroke();
	}

	// Cejuela.
	ctx.strokeStyle = 'rgba(250,250,250,0.7)';
	ctx.lineWidth = g.unit * 0.01;
	ctx.beginPath();
	ctx.moveTo(g.nut.x + g.up.x * nutHalf, g.nut.y + g.up.y * nutHalf);
	ctx.lineTo(g.nut.x - g.up.x * nutHalf, g.nut.y - g.up.y * nutHalf);
	ctx.stroke();
}

function drawStrings(ctx: CanvasRenderingContext2D, g: GuitarGeometry, scene: GuitarScene): void {
	const SEGMENTS = 22;
	const ampScale = g.unit * 0.03;

	for (let i = 0; i < STRING_COUNT; i++) {
		const s = g.strings[i];
		if (!s) continue;
		const muted = scene.muted[i] ?? false;
		const energy = scene.vibrations.energy(i, scene.now);
		const width = g.unit * (STRING_WIDTH[i] ?? 0.005);

		ctx.beginPath();
		for (let k = 0; k <= SEGMENTS; k++) {
			const t = k / SEGMENTS;
			const base = lerp(s.a, s.b, t);
			const d = scene.vibrations.displacement(i, t, scene.now) * ampScale;
			const x = base.x + g.up.x * d;
			const y = base.y + g.up.y * d;
			if (k === 0) ctx.moveTo(x, y);
			else ctx.lineTo(x, y);
		}

		// Halo cuando la cuerda vibra.
		if (energy > 0.02) {
			ctx.strokeStyle = `rgba(251,191,36,${Math.min(0.55, energy * 0.6)})`;
			ctx.lineWidth = width * 3.2;
			ctx.stroke();
		}

		ctx.strokeStyle = muted
			? 'rgba(161,161,170,0.35)'
			: scene.feedback === 'miss'
				? 'rgba(252,165,165,0.85)'
				: WOUND[i]
					? 'rgba(222,190,140,0.95)'
					: 'rgba(244,244,245,0.95)';
		ctx.lineWidth = width;
		ctx.stroke();
	}

	// Marca sutil de la zona de rasgueo.
	const z0 = STRUM_ZONE[0];
	const first = g.strings[0];
	const last = g.strings[STRING_COUNT - 1];
	if (first && last) {
		const a = lerp(first.a, first.b, z0);
		const b = lerp(last.a, last.b, z0);
		ctx.setLineDash([g.unit * 0.012, g.unit * 0.012]);
		ctx.strokeStyle = 'rgba(255,255,255,0.12)';
		ctx.lineWidth = g.unit * 0.003;
		ctx.beginPath();
		ctx.moveTo(a.x, a.y);
		ctx.lineTo(b.x, b.y);
		ctx.stroke();
		ctx.setLineDash([]);
	}
}

function drawLabels(ctx: CanvasRenderingContext2D, g: GuitarGeometry, scene: GuitarScene): void {
	const fontSize = Math.max(11, g.unit * 0.05);
	ctx.font = `600 ${fontSize}px Inter, ui-sans-serif, system-ui, sans-serif`;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';

	for (let i = 0; i < STRING_COUNT; i++) {
		const s = g.strings[i];
		const label = scene.labels[i];
		if (!s || !label) continue;
		// Escalonado para que las etiquetas no se superpongan.
		const p = lerp(s.a, s.b, i % 2 === 0 ? 0.16 : 0.25);
		const w = ctx.measureText(label).width + fontSize * 0.7;
		const h = fontSize * 1.25;
		const muted = scene.muted[i] ?? false;
		const active = scene.vibrations.energy(i, scene.now) > 0.05;

		ctx.fillStyle = active ? 'rgba(245,158,11,0.92)' : muted ? 'rgba(39,39,42,0.7)' : 'rgba(9,9,11,0.72)';
		ctx.beginPath();
		ctx.roundRect(p.x - w / 2, p.y - h / 2, w, h, h / 2);
		ctx.fill();
		ctx.fillStyle = active ? '#09090b' : muted ? 'rgba(161,161,170,0.8)' : '#fafafa';
		ctx.fillText(label, p.x, p.y + fontSize * 0.04);
	}
}

function drawZoneGauge(
	ctx: CanvasRenderingContext2D,
	g: GuitarGeometry,
	zone: { index: number; progress: number }
): void {
	const n = FREE_MODE_CHORDS.length;
	const offset = scale(g.up, g.nutWidth * 0.6 + g.unit * 0.07);
	const span = g.length * 0.45;
	const cell = span / n;
	const fontSize = Math.max(8, g.unit * 0.036);
	ctx.font = `600 ${fontSize}px Inter, ui-sans-serif, system-ui, sans-serif`;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';

	for (let k = 0; k < n; k++) {
		// Zona 0 (brazo recogido) cerca del cuerpo, última zona en la cejuela.
		const d = span - (k + 0.5) * cell;
		const p = add(add(g.nut, scale(g.axis, d)), offset);
		const active = k === zone.index;
		ctx.fillStyle = active ? 'rgba(245,158,11,0.95)' : 'rgba(9,9,11,0.55)';
		ctx.beginPath();
		ctx.roundRect(p.x - cell * 0.42, p.y - fontSize * 0.7, cell * 0.84, fontSize * 1.4, fontSize * 0.4);
		ctx.fill();
		ctx.fillStyle = active ? '#09090b' : 'rgba(228,228,231,0.8)';
		ctx.fillText(FREE_MODE_CHORDS[k] ?? '', p.x, p.y);
	}
}

function drawParticles(ctx: CanvasRenderingContext2D, scene: GuitarScene): void {
	if (scene.particles.particles.length === 0) return;
	ctx.save();
	ctx.globalCompositeOperation = 'lighter';
	for (const p of scene.particles.particles) {
		const life = 1 - (scene.now - p.born) / p.life;
		if (life <= 0) continue;
		ctx.fillStyle = `hsla(${p.hue}, 95%, 60%, ${life * 0.85})`;
		ctx.beginPath();
		ctx.arc(p.x, p.y, p.size * (0.5 + life), 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.restore();
}
