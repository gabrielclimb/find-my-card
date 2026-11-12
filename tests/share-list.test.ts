import { describe, expect, it } from "vitest";
import { parseCardList } from "../src/import/parse-list";
import type { CardInfo, ListItem } from "../src/model/types";
import { decodeShare, encodeShare, listToText } from "../src/share/share-list";

function card(name: string, set: string, collectorNumber: string): CardInfo {
	return { id: `${set}-${collectorNumber}`, name, colors: [], typeLine: "Instant", set, collectorNumber, faces: [{ name }] };
}

function item(name: string, order: number, extra: Partial<ListItem> = {}): ListItem {
	return { key: name.toLowerCase(), name, quantity: 1, found: false, order, ...extra };
}

describe("listToText", () => {
	const items: ListItem[] = [
		item("Counterspell", 1, { quantity: 2, card: card("Counterspell", "mh2", "267"), set: "mh2", collectorNumber: "267" }),
		item("Lightning Bolt", 0, { quantity: 4, card: card("Lightning Bolt", "m10", "146"), found: true }),
		item("Opt", 2, { card: card("Opt", "xln", "65"), artChosen: true }),
		item("Typo Card", 3, { error: "Carta não encontrada no Scryfall." }),
		item("Jötun Grunt", 4, { card: card("Jötun Grunt", "csp", "8") }),
	];

	it("mantém a ordem de importação e só fixa impressões escolhidas", () => {
		expect(listToText({ items })).toBe(
			["4 Lightning Bolt", "2 Counterspell (MH2) 267", "1 Opt (XLN) 65", "1 Typo Card", "1 Jötun Grunt"].join("\n"),
		);
	});

	it("usa a impressão resolvida quando a importada não existia", () => {
		const fallback = item("Shock", 0, { set: "zzz", collectorNumber: "999", card: card("Shock", "m19", "156") });
		expect(listToText({ items: [fallback] })).toBe("1 Shock (M19) 156");
	});

	it("volta a ser lido pelo parser sem erros", () => {
		const parsed = parseCardList(listToText({ items }));
		expect(parsed.errors).toEqual([]);
		expect(parsed.entries.map((e) => [e.quantity, e.name, e.set, e.collectorNumber])).toEqual([
			[4, "Lightning Bolt", undefined, undefined],
			[2, "Counterspell", "mh2", "267"],
			[1, "Opt", "xln", "65"],
			[1, "Typo Card", undefined, undefined],
			[1, "Jötun Grunt", undefined, undefined],
		]);
	});
});

describe("encodeShare / decodeShare", () => {
	it("ida e volta, com acentos e emoji, em formato seguro para URL", async () => {
		const shared = { name: "Lista do Zé ✨", text: "2 Jötun Grunt\n1 Counterspell (MH2) 267" };
		const payload = await encodeShare(shared);
		expect(payload).toMatch(/^1\.[A-Za-z0-9_-]+$/);
		expect(await decodeShare(payload)).toEqual(shared);
	});

	it("comprime listas grandes", async () => {
		const text = Array.from({ length: 300 }, (_, i) => `1 Card Number ${i} (SET) ${i}`).join("\n");
		const payload = await encodeShare({ name: "Grande", text });
		expect(payload.length).toBeLessThan(text.length / 2);
	});

	it("rejeita links inválidos", async () => {
		await expect(decodeShare("garbage")).rejects.toThrow();
		await expect(decodeShare("2.abc")).rejects.toThrow();
		await expect(decodeShare("1.!!!!")).rejects.toThrow();
		await expect(decodeShare("1.AAAA")).rejects.toThrow();
	});
});
