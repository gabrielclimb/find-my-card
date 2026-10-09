/// <reference lib="webworker" />
import { clientsClaim } from "workbox-core";
import { cleanupOutdatedCaches, precacheAndRoute, type PrecacheEntry } from "workbox-precaching";
import { OFFLINE_CACHE } from "./lib/cache-names";

declare let self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<PrecacheEntry | string> };

// O app (HTML/JS/CSS/ícones) fica sempre disponível offline.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
self.skipWaiting();
clientsClaim();

// Imagens: usa o cache offline se a lista foi baixada; caso contrário vai à rede
// (e o cache HTTP normal do navegador cuida do resto). Nada é gravado aqui.
self.addEventListener("fetch", (event) => {
	const url = new URL(event.request.url);
	if (event.request.method !== "GET" || url.hostname !== "cards.scryfall.io") return;
	event.respondWith(
		caches
			.open(OFFLINE_CACHE)
			.then((cache) => cache.match(event.request.url))
			.then((hit) => hit ?? fetch(event.request)),
	);
});
