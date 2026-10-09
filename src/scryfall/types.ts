// Subconjunto dos tipos de mtg-deck-visualizer/src/scryfall/types.ts usado aqui.

export interface ScryfallImageUris {
	small?: string;
	normal?: string;
	large?: string;
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
}

export interface ScryfallList<T> {
	object: "list";
	data: T[];
	has_more?: boolean;
	next_page?: string;
	not_found?: CollectionIdentifier[];
}

export type CollectionIdentifier = { name: string } | { set: string; collector_number: string };
