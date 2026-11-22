/**
 * Acceso a la cámara frontal con errores tipados y mensajes en español.
 */

export type CameraErrorCode = 'unsupported' | 'denied' | 'not-found' | 'in-use' | 'unknown';

export class CameraError extends Error {
	constructor(
		readonly code: CameraErrorCode,
		message: string
	) {
		super(message);
		this.name = 'CameraError';
	}
}

export async function startCamera(video: HTMLVideoElement): Promise<MediaStream> {
	if (!navigator.mediaDevices?.getUserMedia) {
		throw new CameraError('unsupported', 'Tu navegador no permite acceder a la cámara (se requiere HTTPS).');
	}
	let stream: MediaStream;
	try {
		stream = await navigator.mediaDevices.getUserMedia({
			audio: false,
			video: {
				facingMode: 'user',
				width: { ideal: 1280 },
				height: { ideal: 720 },
				frameRate: { ideal: 60, max: 60 }
			}
		});
	} catch (error) {
		const name = error instanceof DOMException ? error.name : '';
		if (name === 'NotAllowedError' || name === 'SecurityError')
			throw new CameraError('denied', 'Permiso de cámara denegado. Habilitalo en la configuración del sitio.');
		if (name === 'NotFoundError' || name === 'OverconstrainedError')
			throw new CameraError('not-found', 'No se encontró ninguna cámara.');
		if (name === 'NotReadableError')
			throw new CameraError('in-use', 'La cámara está siendo usada por otra aplicación.');
		throw new CameraError('unknown', 'No se pudo iniciar la cámara.');
	}

	video.srcObject = stream;
	video.muted = true;
	video.playsInline = true;
	await video.play();
	if (video.readyState < 2) {
		await new Promise<void>((resolve) => video.addEventListener('loadeddata', () => resolve(), { once: true }));
	}
	return stream;
}

export function stopCamera(stream: MediaStream | null): void {
	stream?.getTracks().forEach((t) => t.stop());
}
