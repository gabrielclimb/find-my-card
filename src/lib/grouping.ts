import type { CardInfo, ListItem, Rarity } from "../model/types";

export type SortMode = "color-name" | "rarity-name" | "name";

export const SORT_MODES: readonly SortMode[] = ["color-name", "rarity-name", "name"];

export type ColorGroup = "W" | "U" | "B" | "R" | "G" | "M" | "C" | "L" | "X";

export const GROUP_ORDER: ColorGroup[] = ["W", "U", "B", "R", "G", "M", "C", "L", "X"];

export const GROUP_LABELS: Record<ColorGroup, string> = {
	W: "Branco",
	U: "Azul",
	B: "Preto",
	R: "Vermelho",
	G: "Verde",
	M: "Multicolor",
	C: "Incolor",
	L: "Terrenos",
	X: "Não encontradas",
};

/** Chaves com prefixo para não colidir com as de cor (ex.: "M" já é Multicolor). */
export type RarityGroup = "r-mythic" | "r-rare" | "r-uncommon" | "r-common" | "r-special" | "r-none" | "X";

export const RARITY_GROUP_ORDER: RarityGroup[] = ["r-mythic", "r-rare", "r-uncommon", "r-common", "r-special", "r-none", "X"];

export const RARITY_GROUP_LABELS: Record<RarityGroup, string> = {
	"r-mythic": "Mítica",
	"r-rare": "Rara",
	"r-uncommon": "Incomum",
	"r-common": "Comum",
	"r-special": "Especial",
	"r-none": "Sem raridade",
	X: "Não encontradas",
};

/** Raridades oferecidas no filtro, com o rótulo curto usado nos chips. */
export const RARITY_FILTERS: { value: Rarity; label: string }[] = [
	{ value: "common", label: "Comum" },
	{ value: "uncommon", label: "Incomum" },
	{ value: "rare", label: "Rara" },
	{ value: "mythic", label: "Mítica" },
];

/** Grupo pela raridade da impressão. "special" e "bonus" ficam juntas em Especial. */
export function rarityGroup(card: CardInfo | undefined): RarityGroup {
	if (!card) return "X";
	switch (card.rarity) {
		case "mythic":
			return "r-mythic";
		case "rare":
			return "r-rare";
		case "uncommon":
			return "r-uncommon";
		case "common":
			return "r-common";
		case "special":
		case "bonus":
			return "r-special";
		default:
			return "r-none";
	}
}

/** Grupo pela cor da carta (face frontal). Terrenos têm precedência sobre a cor. */
export function colorGroup(card: CardInfo | undefined): ColorGroup {
	if (!card) return "X";
	if (/\bLand\b/.test(card.typeLine)) return "L";
	const colors = card.colors.filter((c) => "WUBRG".includes(c));
	if (colors.length === 0) return "C";
	if (colors.length > 1) return "M";
	return colors[0] as ColorGroup;
}

export function normalizeText(text: string): string {
	return text.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
}

export function displayName(item: ListItem): string {
	return item.card?.name ?? item.name;
}

const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });

function byName(a: ListItem, b: ListItem): number {
	return collator.compare(displayName(a), displayName(b)) || a.order - b.order;
}

export interface Group {
	key: ColorGroup | RarityGroup | "all";
	label: string;
	items: ListItem[];
}

export interface ViewFilter {
	query?: string;
	hideFound?: boolean;
	/** Vazio ou ausente: todas as raridades. */
	rarities?: readonly Rarity[];
}

export function filterItems(items: ListItem[], { query, hideFound, rarities }: ViewFilter): ListItem[] {
	const q = query ? normalizeText(query) : "";
	const wanted = rarities && rarities.length > 0 ? new Set(rarities) : null;
	return items.filter((item) => {
		if (hideFound && item.found) return false;
		if (wanted && !(item.card?.rarity && wanted.has(item.card.rarity))) return false;
		if (!q) return true;
		return normalizeText(displayName(item)).includes(q) || normalizeText(item.name).includes(q);
	});
}

/** Agrupa e ordena. Grupos vazios são omitidos. */
export function groupItems(items: ListItem[], mode: SortMode): Group[] {
	if (mode === "name") {
		return [{ key: "all", label: "Todas", items: [...items].sort(byName) }];
	}
	if (mode === "rarity-name") {
		return bucketBy(items, (i) => rarityGroup(i.card), RARITY_GROUP_ORDER, RARITY_GROUP_LABELS);
	}
	return bucketBy(items, (i) => colorGroup(i.card), GROUP_ORDER, GROUP_LABELS);
}

function bucketBy<K extends Group["key"]>(items: ListItem[], keyOf: (item: ListItem) => K, order: K[], labels: Record<K, string>): Group[] {
	const buckets = new Map<K, ListItem[]>();
	for (const item of items) {
		const k = keyOf(item);
		const bucket = buckets.get(k);
		if (bucket) bucket.push(item);
		else buckets.set(k, [item]);
	}
	return order.flatMap((key) => {
		const bucket = buckets.get(key);
		if (!bucket) return [];
		return [{ key, label: labels[key], items: bucket.sort(byName) }];
	});
}

export function countQuantities(items: ListItem[]): { found: number; total: number } {
	return items.reduce(
		(acc, i) => ({ found: acc.found + (i.found ? i.quantity : 0), total: acc.total + i.quantity }),
		{ found: 0, total: 0 },
	);
}
