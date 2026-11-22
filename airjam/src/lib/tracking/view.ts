/**
 * Cálculo de la transformación video → canvas equivalente a `object-fit: cover`,
 * para que lo dibujado coincida exactamente con el video mostrado.
 */
import type { ViewTransform } from '#lib/instruments/types.ts';

export function coverTransform(
	videoWidth: number,
	videoHeight: number,
	canvasWidth: number,
	canvasHeight: number,
	devicePixelRatio: number
): ViewTransform {
	const scale = Math.max(canvasWidth / Math.max(1, videoWidth), canvasHeight / Math.max(1, videoHeight));
	return {
		scale,
		offsetX: (canvasWidth - videoWidth * scale) / 2,
		offsetY: (canvasHeight - videoHeight * scale) / 2,
		width: canvasWidth,
		height: canvasHeight,
		devicePixelRatio
	};
}
