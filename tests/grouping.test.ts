import { describe, expect, it } from "vitest";
import { colorGroup, countQuantities, filterItems, groupItems } from "../src/lib/grouping";
import { toCardInfo } from "../src/model/card-info";
import type { CardInfo, ListItem } from "../src/model/types";

function card(name: string, colors: string[], typeLine = "Instant"): CardInfo {
	return { id: name, name, colors, typeLine, set: "tst", collectorNumber: "1", faces: [{ name }] };
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
