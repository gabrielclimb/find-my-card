export interface CardFaceInfo {
	name: string;
	/** Imagem `normal` (488×680) do Scryfall. */
	image?: string;
	small?: string;
}

/** Recorte dos dados do Scryfall guardado junto com o item, para a lista funcionar offline. */
export interface CardInfo {
	id: string;
	name: string;
	/** Cores da face frontal, ex.: ["U", "R"]. */
	colors: string[];
	/** Linha de tipo da face frontal. */
	typeLine: string;
	set: string;
	setName?: string;
	collectorNumber: string;
	faces: CardFaceInfo[];
	printsUri?: string;
}

export interface ListItem {
	/** Chave estável derivada do nome/impressão importados (ver `entryKey`). */
	key: string;
	/** Nome como escrito no Markdown. */
	name: string;
	quantity: number;
	set?: string;
	collectorNumber?: string;
	found: boolean;
	/** Ordem de importação. */
	order: number;
	card?: CardInfo;
	/** Arte escolhida pelo usuário em "Outras artes". */
	artChosen?: boolean;
	error?: string;
}

export interface CardList {
	id: string;
	name: string;
	source: string;
	items: ListItem[];
	offline: boolean;
	createdAt: number;
	updatedAt: number;
}
