import { useEffect, useRef } from "preact/hooks";

/**
 * Faz o botão "voltar" do Android fechar uma camada (overlay, menu) em vez de sair da tela.
 * Ao abrir, empilha um estado no histórico; ao fechar pela interface, desempilha.
 */
export function useBackDismiss(open: boolean, close: () => void): void {
	const closeRef = useRef(close);
	closeRef.current = close;

	useEffect(() => {
		if (!open) return;
		history.pushState({ fmcLayer: true }, "");
		let popped = false;
		const onPop = () => {
			popped = true;
			closeRef.current();
		};
		window.addEventListener("popstate", onPop);
		return () => {
			window.removeEventListener("popstate", onPop);
			if (!popped && (history.state as { fmcLayer?: boolean } | null)?.fmcLayer) history.back();
		};
	}, [open]);
}

const LONG_PRESS_MS = 450;
const MOVE_TOLERANCE_PX = 10;

/** Toque curto chama `onTap`; pressionar e segurar chama `onLongPress` (com vibração curta). */
export function pressHandlers(onTap: () => void, onLongPress: () => void) {
	let timer: ReturnType<typeof setTimeout> | undefined;
	let start: { x: number; y: number } | undefined;
	let longFired = false;

	const cancel = () => {
		clearTimeout(timer);
		timer = undefined;
		start = undefined;
	};

	return {
		onPointerDown(e: PointerEvent) {
			if (e.button !== 0) return;
			longFired = false;
			start = { x: e.clientX, y: e.clientY };
			timer = setTimeout(() => {
				longFired = true;
				timer = undefined;
				navigator.vibrate?.(30);
				onLongPress();
			}, LONG_PRESS_MS);
		},
		onPointerMove(e: PointerEvent) {
			if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > MOVE_TOLERANCE_PX) cancel();
		},
		onPointerUp: cancel,
		onPointerCancel: cancel,
		onPointerLeave: cancel,
		onClick(e: MouseEvent) {
			if (longFired) {
				e.preventDefault();
				longFired = false;
				return;
			}
			onTap();
		},
		onContextMenu(e: Event) {
			e.preventDefault();
		},
	};
}
