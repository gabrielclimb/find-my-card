import { useEffect, useState } from "preact/hooks";

export type WakeLockState = "active" | "inactive" | "unsupported";

/**
 * Mantém a tela acesa enquanto `enabled` for verdadeiro.
 * O navegador libera o lock quando a aba fica oculta; ele é readquirido ao voltar.
 */
export function useWakeLock(enabled: boolean): WakeLockState {
	const supported = typeof navigator !== "undefined" && "wakeLock" in navigator;
	const [state, setState] = useState<WakeLockState>(supported ? "inactive" : "unsupported");

	useEffect(() => {
		if (!supported || !enabled) {
			setState(supported ? "inactive" : "unsupported");
			return;
		}
		let sentinel: WakeLockSentinel | null = null;
		let cancelled = false;

		const acquire = async () => {
			if (document.visibilityState !== "visible" || (sentinel && !sentinel.released)) return;
			try {
				const s = await navigator.wakeLock.request("screen");
				if (cancelled) {
					void s.release();
					return;
				}
				sentinel = s;
				setState("active");
				s.addEventListener("release", () => {
					if (!cancelled) setState("inactive");
				});
			} catch {
				setState("inactive");
			}
		};

		const onVisibility = () => void acquire();
		document.addEventListener("visibilitychange", onVisibility);
		void acquire();

		return () => {
			cancelled = true;
			document.removeEventListener("visibilitychange", onVisibility);
			void sentinel?.release();
			setState("inactive");
		};
	}, [enabled, supported]);

	return state;
}
