import { entryKey, type ParsedEntry } from "../import/parse-list";
import { COLLECTION_BATCH_SIZE, fetchCollection, fetchNamedFuzzy } from "../scryfall/client";
import type { CollectionIdentifier, ScryfallCard } from "../scryfall/types";
import { toCardInfo } from "./card-info";
import { pricesStale } from "../lib/price";
import type { CardInfo, ListItem } from "./types";

function norm(name: string): string {
	return name.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
}

function identifierFor(item: Pick<ListItem, "name" | "set" | "collectorNumber">): CollectionIdentifier {
	return item.set && item.collectorNumber
		? { set: item.set, collector_number: item.collectorNumber }
		: { name: item.name };
}

function matches(item: ListItem, card: ScryfallCard): boolean {
	if (item.set && item.collectorNumber) {
		return card.set === item.set && card.collector_number?.toLowerCase() === item.collectorNumber.toLowerCase();
	}
	const wanted = norm(item.name);
	if (norm(card.name) === wanted) return true;
	return card.name.split(" // ").some((n) => norm(n) === wanted) || (card.card_faces ?? []).some((f) => f.name && norm(f.name) === wanted);
}

export function itemsFromEntries(entries: ParsedEntry[]): ListItem[] {
	return entries.map((e, order) => ({
		key: entryKey(e),
		name: e.name,
		quantity: e.quantity,
		found: false,
		order,
		...(e.set ? { set: e.set, collectorNumber: e.collectorNumber } : {}),
	}));
}

export interface ResolveProgress {
	done: number;
	total: number;
}

/**
 * Preenche `card` nos itens sem dados, consultando o Scryfall em lotes.
 * Nomes não encontrados passam por uma busca aproximada; se ainda falharem, recebem `error`.
 */
export async function resolveItems(items: ListItem[], onProgress?: (p: ResolveProgress) => void): Promise<ListItem[]> {
	const out = items.map((i) => ({ ...i }));
	const pending = out.filter((i) => !i.card);
	const total = pending.length;
	let done = 0;
	onProgress?.({ done, total });

	for (let start = 0; start < pending.length; start += COLLECTION_BATCH_SIZE) {
		const batch = pending.slice(start, start + COLLECTION_BATCH_SIZE);
		const { cards } = await fetchCollection(batch.map(identifierFor));
		for (const item of batch) {
			const card = cards.find((c) => matches(item, c));
			if (card) {
				item.card = toCardInfo(card);
				delete item.error;
			}
		}
		done += batch.filter((i) => i.card).length;
		onProgress?.({ done, total });
	}

	for (const item of pending.filter((i) => !i.card)) {
		// Impressão inexistente: tenta pelo nome antes de desistir.
		const card = await fetchNamedFuzzy(item.name).catch(() => null);
		if (card) {
			item.card = toCardInfo(card);
			delete item.error;
		} else {
			item.error = "Carta não encontrada no Scryfall.";
		}
		done++;
		onProgress?.({ done, total });
	}
	return out;
}

export type CardRefresh = Pick<CardInfo, "rarity" | "prices" | "pricesAt">;

/** Cartas cujos preços passaram de um dia, ou salvas antes de existirem raridade e preço. */
export function needsRefresh(card: CardInfo | undefined, now = Date.now()): card is CardInfo {
	return !!card && (!card.rarity || pricesStale(card, now));
}

/**
 * Atualiza raridade e preços das impressões já escolhidas, pelo id do Scryfall.
 * Retorna id da carta → dados novos; ids que falharem ficam de fora.
 */
export async function fetchCardRefresh(items: ListItem[], now = Date.now()): Promise<Map<string, CardRefresh>> {
	const ids = [...new Set(items.flatMap((i) => (needsRefresh(i.card, now) ? [i.card.id] : [])))];
	const out = new Map<string, CardRefresh>();
	for (let start = 0; start < ids.length; start += COLLECTION_BATCH_SIZE) {
		const batch = ids.slice(start, start + COLLECTION_BATCH_SIZE);
		const { cards } = await fetchCollection(batch.map((id) => ({ id })));
		for (const card of cards) {
			const { rarity, prices, pricesAt } = toCardInfo(card);
			out.set(card.id, { ...(rarity ? { rarity } : {}), prices, pricesAt });
		}
	}
	return out;
}

/** Reimportação: preserva "encontrada" e arte escolhida dos itens que continuam na lista. */
export function mergeWithPrevious(next: ListItem[], previous: ListItem[]): ListItem[] {
	const byKey = new Map(previous.map((i) => [i.key, i]));
	return next.map((item) => {
		const old = byKey.get(item.key);
		if (!old) return item;
		return {
			...item,
			found: item.found || old.found,
			card: old.card,
			artChosen: old.artChosen,
			error: old.card ? undefined : item.error,
		};
	});
}
