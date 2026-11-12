import { describe, expect, it } from "vitest";
import { colorGroup, countQuantities, filterItems, groupItems, rarityGroup } from "../src/lib/grouping";
import { toCardInfo } from "../src/model/card-info";
import type { CardInfo, ListItem, Rarity } from "../src/model/types";

function card(name: string, colors: string[], typeLine = "Instant", rarity?: Rarity): CardInfo {
	return { id: name, name, colors, typeLine, set: "tst", collectorNumber: "1", faces: [{ name }], ...(rarity ? { rarity } : {}) };
}

function item(name: string, order: number, c?: CardInfo, extra: Partial<ListItem> = {}): ListItem {
	return { key: name.toLowerCase(), name, quantity: 1, found: false, order, card: c, ...extra };
}

describe("colorGroup", () => {
	it("classifica mono, multi, incolor, terreno e não encontrada", () => {
		expect(colorGroup(card("Opt", ["U"]))).toBe("U");
		expect(colorGroup(card("Fire // Ice", ["U", "R"]))).toBe("M");
		expect(colorGroup(card("Sol Ring", [], "Artifact"))).toBe("C");
		expect(colorGroup(card("Dryad Arbor", ["G"], "Land Creature — Forest Dryad"))).toBe("L");
		expect(colorGroup(card("Island", [], "Basic Land — Island"))).toBe("L");
		expect(colorGroup(undefined)).toBe("X");
	});

	it("usa a face frontal de cartas de duas faces", () => {
		const info = toCardInfo({
			id: "1",
			name: "Delver of Secrets // Insectile Aberration",
			card_faces: [
				{ name: "Delver of Secrets", type_line: "Creature — Human Wizard", colors: ["U"], image_uris: { normal: "a" } },
				{ name: "Insectile Aberration", type_line: "Creature — Human Insect", colors: ["U"], image_uris: { normal: "b" } },
			],
		});
		expect(colorGroup(info)).toBe("U");
		expect(info.faces.map((f) => f.image)).toEqual(["a", "b"]);

		// MDFC com terreno no verso: a frente (mágica) define o grupo.
		const mdfc = toCardInfo({
			id: "2",
			name: "Shatterskull Smashing // Shatterskull, the Hammer Pass",
			card_faces: [
				{ name: "Shatterskull Smashing", type_line: "Sorcery", colors: ["R"] },
				{ name: "Shatterskull, the Hammer Pass", type_line: "Land", colors: [] },
			],
		});
		expect(colorGroup(mdfc)).toBe("R");
	});
});

describe("groupItems", () => {
	const items = [
		item("Shock", 0, card("Shock", ["R"])),
		item("Opt", 1, card("Opt", ["U"])),
		item("Brainstorm", 2, card("Brainstorm", ["U"])),
		item("Typo Card", 3),
		item("Island", 4, card("Island", [], "Basic Land — Island")),
		item("Abrade", 5, card("Abrade", ["R"])),
	];

	it("agrupa por cor e ordena por nome dentro do grupo", () => {
		const groups = groupItems(items, "color-name");
		expect(groups.map((g) => [g.key, g.items.map((i) => i.name)])).toEqual([
			["U", ["Brainstorm", "Opt"]],
			["R", ["Abrade", "Shock"]],
			["L", ["Island"]],
			["X", ["Typo Card"]],
		]);
	});

	it("ordena só por nome em um grupo único", () => {
		const groups = groupItems(items, "name");
		expect(groups).toHaveLength(1);
		expect(groups[0]?.items.map((i) => i.name)).toEqual(["Abrade", "Brainstorm", "Island", "Opt", "Shock", "Typo Card"]);
	});
});

describe("filterItems / countQuantities", () => {
	const items = [
		item("Lightning Bolt", 0, card("Lightning Bolt", ["R"]), { quantity: 4, found: true }),
		item("Jötun Grunt", 1, card("Jötun Grunt", ["W"]), { quantity: 2 }),
	];

	it("busca por parte do nome, sem acento nem caixa", () => {
		expect(filterItems(items, { query: "jotun" }).map((i) => i.name)).toEqual(["Jötun Grunt"]);
		expect(filterItems(items, { query: "BOLT" })).toHaveLength(1);
	});

	it("oculta encontradas mantendo as demais", () => {
		expect(filterItems(items, { hideFound: true }).map((i) => i.name)).toEqual(["Jötun Grunt"]);
	});

	it("conta cópias encontradas", () => {
		expect(countQuantities(items)).toEqual({ found: 4, total: 6 });
	});
});

describe("raridade", () => {
	const items = [
		item("Shock", 0, card("Shock", ["R"], "Instant", "common")),
		item("Ragavan", 1, card("Ragavan", ["R"], "Creature", "mythic")),
		item("Abrade", 2, card("Abrade", ["R"], "Instant", "common")),
		item("Counterspell", 3, card("Counterspell", ["U"], "Instant", "uncommon")),
		item("Old Card", 4, card("Old Card", ["U"])),
		item("Typo Card", 5),
		item("Sol Ring", 6, card("Sol Ring", [], "Artifact", "special")),
		item("Thoughtseize", 7, card("Thoughtseize", ["B"], "Instant", "rare")),
	];

	it("lê a raridade do Scryfall e ignora valores desconhecidos", () => {
		expect(toCardInfo({ id: "1", name: "Opt", rarity: "common" }).rarity).toBe("common");
		expect(toCardInfo({ id: "1", name: "Opt", rarity: "weird" }).rarity).toBeUndefined();
	});

	it("classifica por raridade, com especial e sem dados", () => {
		expect(rarityGroup(card("A", [], "Instant", "bonus"))).toBe("r-special");
		expect(rarityGroup(card("A", []))).toBe("r-none");
		expect(rarityGroup(undefined)).toBe("X");
	});

	it("agrupa da mítica para a comum e ordena por nome", () => {
		const groups = groupItems(items, "rarity-name");
		expect(groups.map((g) => [g.key, g.label, g.items.map((i) => i.name)])).toEqual([
			["r-mythic", "Mítica", ["Ragavan"]],
			["r-rare", "Rara", ["Thoughtseize"]],
			["r-uncommon", "Incomum", ["Counterspell"]],
			["r-common", "Comum", ["Abrade", "Shock"]],
			["r-special", "Especial", ["Sol Ring"]],
			["r-none", "Sem raridade", ["Old Card"]],
			["X", "Não encontradas", ["Typo Card"]],
		]);
	});

	it("filtra pelas raridades escolhidas; vazio mostra todas", () => {
		expect(filterItems(items, { rarities: ["rare", "mythic"] }).map((i) => i.name)).toEqual(["Ragavan", "Thoughtseize"]);
		expect(filterItems(items, { rarities: [] })).toHaveLength(items.length);
		expect(filterItems(items, { rarities: ["common"], query: "sh" }).map((i) => i.name)).toEqual(["Shock"]);
	});
});
