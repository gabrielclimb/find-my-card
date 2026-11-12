import type { CardList, ListItem } from "../model/types";

/**
 * Compartilhamento sem servidor: a lista vai no fragmento da URL (`#/import/<payload>`),
 * comprimida com deflate e codificada em base64url. O fragmento não é enviado ao servidor,
 * então o limite prático é o do app usado para mandar o link.
 */

const VERSION = "1";

/** Acima disso o link pode ser cortado ou não virar link clicável em alguns apps. */
export const LONG_LINK_CHARS = 8000;

export interface SharedList {
	name: string;
	/** Uma carta por linha, no formato aceito por `parseCardList`. */
	text: string;
}

/** Impressão a fixar: a importada com `(SET) número` ou a escolhida em "Outras artes". */
function printing(item: ListItem): { set: string; number: string } | undefined {
	const pinned = item.artChosen || (item.set && item.collectorNumber);
	if (!pinned) return undefined;
	// Prefere a impressão resolvida: se a importada não existia, o Scryfall caiu em outra.
	if (item.card?.set && item.card.collectorNumber) return { set: item.card.set, number: item.card.collectorNumber };
	if (item.set && item.collectorNumber) return { set: item.set, number: item.collectorNumber };
	return undefined;
}

export function listToText(list: Pick<CardList, "items">): string {
	return [...list.items]
		.sort((a, b) => a.order - b.order)
		.map((item) => {
			const p = printing(item);
			return `${item.quantity} ${item.name}${p ? ` (${p.set.toUpperCase()}) ${p.number}` : ""}`;
		})
		.join("\n");
}

function toBase64Url(bytes: Uint8Array): string {
	let bin = "";
	for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
	const b64 = text.replace(/-/g, "+").replace(/_/g, "/");
	const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
	return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function transform(bytes: Uint8Array<ArrayBuffer>, stream: CompressionStream | DecompressionStream): Promise<Uint8Array<ArrayBuffer>> {
	const out = new Response(new Blob([bytes]).stream().pipeThrough(stream));
	return new Uint8Array(await out.arrayBuffer());
}

export async function encodeShare(shared: SharedList): Promise<string> {
	const json = new TextEncoder().encode(JSON.stringify({ n: shared.name, t: shared.text }));
	return `${VERSION}.${toBase64Url(await transform(json, new CompressionStream("deflate-raw")))}`;
}

/** Lança erro se o conteúdo não for um link de lista válido. */
export async function decodeShare(payload: string): Promise<SharedList> {
	const [version, data] = payload.split(".", 2);
	if (version !== VERSION || !data) throw new Error("Link de lista inválido.");
	const bytes = await transform(fromBase64Url(data), new DecompressionStream("deflate-raw"));
	const parsed = JSON.parse(new TextDecoder().decode(bytes)) as { n?: unknown; t?: unknown };
	if (typeof parsed.t !== "string") throw new Error("Link de lista inválido.");
	return { name: typeof parsed.n === "string" ? parsed.n : "", text: parsed.t };
}

export async function shareUrl(list: Pick<CardList, "name" | "items">): Promise<string> {
	const payload = await encodeShare({ name: list.name, text: listToText(list) });
	return `${location.origin}${location.pathname}#/import/${payload}`;
}
