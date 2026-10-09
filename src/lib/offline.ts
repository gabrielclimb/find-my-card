import { cardImages } from "../model/card-info";
import type { CardList } from "../model/types";
import { OFFLINE_CACHE } from "./cache-names";

export function listImageUrls(list: Pick<CardList, "items">): string[] {
	return [...new Set(list.items.flatMap((i) => cardImages(i.card)))];
}

export function offlineSupported(): boolean {
	return typeof caches !== "undefined";
}

/** Baixa as imagens que ainda faltam no cache. Retorna quantas falharam. */
export async function cacheImages(
	urls: string[],
	onProgress?: (done: number, total: number) => void,
	concurrency = 6,
): Promise<number> {
	const cache = await caches.open(OFFLINE_CACHE);
	let done = 0;
	let failed = 0;
	const queue = [...urls];
	onProgress?.(0, urls.length);

	const worker = async () => {
		for (let url = queue.shift(); url; url = queue.shift()) {
			try {
				if (!(await cache.match(url))) {
					const response = await fetch(url, { mode: "cors" });
					if (!response.ok) throw new Error(String(response.status));
					await cache.put(url, response);
				}
			} catch {
				failed++;
			}
			onProgress?.(++done, urls.length);
		}
	};
	await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, worker));
	return failed;
}

/** Remove as imagens da lista que nenhuma outra lista offline usa. */
export async function releaseImages(list: CardList, otherOfflineLists: CardList[]): Promise<void> {
	const keep = new Set(otherOfflineLists.flatMap(listImageUrls));
	const cache = await caches.open(OFFLINE_CACHE);
	await Promise.all(listImageUrls(list).filter((u) => !keep.has(u)).map((u) => cache.delete(u)));
}

/** Pede ao navegador para não apagar o armazenamento sob pressão de espaço. */
export async function requestPersistentStorage(): Promise<boolean> {
	try {
		if (await navigator.storage?.persisted?.()) return true;
		return (await navigator.storage?.persist?.()) ?? false;
	} catch {
		return false;
	}
}

export async function storageEstimate(): Promise<{ usage: number; quota: number } | null> {
	try {
		const est = await navigator.storage?.estimate?.();
		return est ? { usage: est.usage ?? 0, quota: est.quota ?? 0 } : null;
	} catch {
		return null;
	}
}
