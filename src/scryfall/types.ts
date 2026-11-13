// Subconjunto dos tipos de mtg-deck-visualizer/src/scryfall/types.ts usado aqui.

export interface ScryfallImageUris {
	small?: string;
	normal?: string;
	large?: string;
}

/** Preços do dia, como strings decimais; `null` quando não há oferta. */
export interface ScryfallPrices {
	usd?: string | null;
	usd_foil?: string | null;
	usd_etched?: string | null;
	eur?: string | null;
	eur_foil?: string | null;
	eur_etched?: string | null;
}

export interface ScryfallCardFace {
	name?: string;
	type_line?: string;
	image_uris?: ScryfallImageUris;
	colors?: string[];
}

export interface ScryfallCard {
	id: string;
	name: string;
	type_line?: string;
	colors?: string[];
	set?: string;
	set_name?: string;
	collector_number?: string;
	image_uris?: ScryfallImageUris;
	card_faces?: ScryfallCardFace[];
	prints_search_uri?: string;
	released_at?: string;
	rarity?: string;
	prices?: ScryfallPrices;
}

export interface ScryfallList<T> {
	object: "list";
	data: T[];
	has_more?: boolean;
	next_page?: string;
	not_found?: CollectionIdentifier[];
}

export type CollectionIdentifier = { id: string } | { name: string } | { set: string; collector_number: string };
