import { describe, expect, it } from "vitest";
import { findMoxfieldUrl, parseMarkdownList } from "../src/import/parse-markdown";

describe("parseMarkdownList", () => {
	it("aceita bullets, checkboxes, quantidades e impressões", () => {
		const { entries, errors, title } = parseMarkdownList(
			[
				"# Procurando no bulk",
				"",
				"- 2 Lightning Bolt",
				"* [ ] 1x Counterspell (MH2) 267",
				"+ [x] Delver of Secrets",
				"1. Brainstorm",
				"Ponder x3",
				"4 Thoughtseize #removal",
				"1 Sol Ring (C21) 263 *F*",
				"- **[Fire // Ice](https://scryfall.com/card/mh2/290)**",
				"## Sideboard",
				"[[Pyroblast]]",
			].join("\n"),
		);
		expect(errors).toEqual([]);
		expect(title).toBe("Procurando no bulk");
		expect(entries.map((e) => [e.name, e.quantity, e.found, e.set, e.collectorNumber])).toEqual([
			["Lightning Bolt", 2, false, undefined, undefined],
			["Counterspell", 1, false, "mh2", "267"],
			["Delver of Secrets", 1, true, undefined, undefined],
			["Brainstorm", 1, false, undefined, undefined],
			["Ponder", 3, false, undefined, undefined],
			["Thoughtseize", 4, false, undefined, undefined],
			["Sol Ring", 1, false, "c21", "263"],
			["Fire // Ice", 1, false, undefined, undefined],
			["Pyroblast", 1, false, undefined, undefined],
		]);
	});

	it("ignora linhas vazias, comentários, separadores e citações", () => {
		const { entries, errors } = parseMarkdownList("// comentário\n---\n> 2 Opt\n\n   \n");
		expect(errors).toEqual([]);
		expect(entries).toHaveLength(1);
		expect(entries[0]).toMatchObject({ name: "Opt", quantity: 2 });
	});

	it("soma linhas repetidas da mesma carta", () => {
		const { entries } = parseMarkdownList("2 Lightning Bolt\n# Side\n1 lightning bolt");
		expect(entries).toHaveLength(1);
		expect(entries[0]?.quantity).toBe(3);
	});

	it("mantém impressões diferentes separadas", () => {
		const { entries } = parseMarkdownList("1 Island (NEO) 293\n1 Island (DMU) 262\n1 Island");
		expect(entries).toHaveLength(3);
	});

	it("descarta set sem número de colecionador", () => {
		const { entries } = parseMarkdownList("1 Opt (XLN)");
		expect(entries[0]).toMatchObject({ name: "Opt" });
		expect(entries[0]?.set).toBeUndefined();
	});

	it("reporta linhas sem nome reconhecível e tabelas", () => {
		const { entries, errors } = parseMarkdownList("- 3\n| 2 | Opt |\n|---|---|\n- 1 Opt");
		expect(entries).toHaveLength(1);
		expect(errors.map((e) => e.lineNumber)).toEqual([1, 2]);
	});

	it("entende a exportação do Moxfield", () => {
		const { entries, errors } = parseMarkdownList(
			[
				"1 Sol Ring (PLST) BLC-129",
				"1 Lightning Bolt (2X2) 117 *F*",
				"1 Island (SLD) 1503★",
				"",
				"SIDEBOARD:",
				"2 Pyroblast (ICE) 212",
				"Commander",
				"1 Kenrith, the Returned King (ELD) 303",
			].join("\n"),
		);
		expect(errors).toEqual([]);
		expect(entries.map((e) => [e.name, e.quantity, e.set, e.collectorNumber])).toEqual([
			["Sol Ring", 1, "plst", "BLC-129"],
			["Lightning Bolt", 1, "2x2", "117"],
			["Island", 1, "sld", "1503★"],
			["Pyroblast", 2, "ice", "212"],
			["Kenrith, the Returned King", 1, "eld", "303"],
		]);
	});

	it("não transforma links em cartas", () => {
		const source = "https://moxfield.com/decks/4czNxGfxT0SbJaHCozAnDQ\n- https://example.com/x\n1 Opt";
		const { entries, errors } = parseMarkdownList(source);
		expect(entries.map((e) => e.name)).toEqual(["Opt"]);
		expect(errors).toHaveLength(2);
		expect(errors[0]?.message).toMatch(/Moxfield/);
		expect(findMoxfieldUrl(source)).toBe("https://moxfield.com/decks/4czNxGfxT0SbJaHCozAnDQ");
		expect(findMoxfieldUrl("1 Opt")).toBeUndefined();
	});
});
