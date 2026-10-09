import type { CollectionIdentifier, ScryfallCard, ScryfallList } from "./types";

// Mesmas regras de mtg-deck-visualizer/src/scryfall/client.ts: fila com espaçamento
// entre requisições e novas tentativas com backoff em 429/5xx.
const API = "https://api.scryfall.com";
const REQUEST_SPACING_MS = 100;
const RETRY_MAX_ATTEMPTS = 4;
const RETRY_BACKOFF_BASE_MS = 500;
const RETRY_BACKOFF_MAX_MS = 8000;
export const COLLECTION_BATCH_SIZE = 75;

let queue: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function enqueue<T>(task: () => Promise<T>): Promise<T> {
	const next = queue.then(async () => {
		const wait = Math.max(0, REQUEST_SPACING_MS - (Date.now() - lastRequestAt));
		if (wait > 0) await sleep(wait);
		lastRequestAt = Date.now();
		return task();
	});
	queue = next.catch(() => undefined);
	return next;
}

function isThrottleStatus(status: number): boolean {
	return status === 429 || status === 502 || status === 503 || status === 504;
}

function backoffDelay(attempt: number, retryAfter: string | null): number {
	const header = retryAfter ? Number.parseInt(retryAfter, 10) * 1000 : 0;
	const exp = RETRY_BACKOFF_BASE_MS * 2 ** attempt + Math.floor(Math.random() * 250);
	return Math.min(RETRY_BACKOFF_MAX_MS, Math.max(Number.isFinite(header) ? header : 0, exp));
}

/** Retorna `null` em 404; lança erro em falhas de rede ou respostas inesperadas. */
async function request<T>(url: string, init?: RequestInit): Promise<T | null> {
	for (let attempt = 0; ; attempt++) {
		const response = await enqueue(() =>
			fetch(url, { ...init, headers: { Accept: "application/json", ...(init?.headers ?? {}) } }),
		);
		if (response.status === 404) return null;
		if (isThrottleStatus(response.status) && attempt < RETRY_MAX_ATTEMPTS) {
			await sleep(backoffDelay(attempt, response.headers.get("retry-after")));
			continue;
		}
		if (!response.ok) throw new Error(`Scryfall respondeu ${response.status}`);
		return (await response.json()) as T;
	}
}

export async function fetchCollection(
	identifiers: CollectionIdentifier[],
): Promise<{ cards: ScryfallCard[]; notFound: CollectionIdentifier[] }> {
	const result = await request<ScryfallList<ScryfallCard>>(`${API}/cards/collection`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ identifiers }),
	});
	return { cards: result?.data ?? [], notFound: result?.not_found ?? [] };
}

/** Busca aproximada pelo nome; tolera erros de digitação. */
export async function fetchNamedFuzzy(name: string): Promise<ScryfallCard | null> {
	return request<ScryfallCard>(`${API}/cards/named?fuzzy=${encodeURIComponent(name)}`);
}

/** Todas as impressões (em inglês) de uma carta, a partir de `prints_search_uri`. */
export async function fetchPrints(printsSearchUri: string, limit = 175): Promise<ScryfallCard[]> {
	const out: ScryfallCard[] = [];
	let url: string | undefined = printsSearchUri;
	while (url && out.length < limit) {
		const page: ScryfallList<ScryfallCard> | null = await request<ScryfallList<ScryfallCard>>(url);
		if (!page) break;
		out.push(...page.data);
		url = page.has_more ? page.next_page : undefined;
	}
	return out;
}
