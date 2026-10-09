import type { CardInfo, ListItem } from "../model/types";

export type SortMode = "color-name" | "name";

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
	key: ColorGroup | "all";
	label: string;
	items: ListItem[];
}

export interface ViewFilter {
	query?: string;
	hideFound?: boolean;
}

export function filterItems(items: ListItem[], { query, hideFound }: ViewFilter): ListItem[] {
	const q = query ? normalizeText(query) : "";
	return items.filter((item) => {
		if (hideFound && item.found) return false;
		if (!q) return true;
		return normalizeText(displayName(item)).includes(q) || normalizeText(item.name).includes(q);
	});
}

/** Agrupa e ordena. Grupos vazios são omitidos. */
export function groupItems(items: ListItem[], mode: SortMode): Group[] {
	if (mode === "name") {
		return [{ key: "all", label: "Todas", items: [...items].sort(byName) }];
	}
	const buckets = new Map<ColorGroup, ListItem[]>();
	for (const item of items) {
		const g = colorGroup(item.card);
		const bucket = buckets.get(g);
		if (bucket) bucket.push(item);
		else buckets.set(g, [item]);
	}
	return GROUP_ORDER.flatMap((key) => {
		const bucket = buckets.get(key);
		if (!bucket) return [];
		return [{ key, label: GROUP_LABELS[key], items: bucket.sort(byName) }];
	});
}

export function countQuantities(items: ListItem[]): { found: number; total: number } {
	return items.reduce(
		(acc, i) => ({ found: acc.found + (i.found ? i.quantity : 0), total: acc.total + i.quantity }),
		{ found: 0, total: 0 },
	);
}
