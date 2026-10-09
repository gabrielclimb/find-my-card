import { describe, expect, it } from "vitest";
import { findMoxfieldUrl, parseCardList } from "../src/import/parse-list";

describe("parseCardList", () => {
	it("aceita quantidade opcional, 'x' e impressão", () => {
		const { entries, errors } = parseCardList(
			["2 Lightning Bolt", "1x Counterspell (MH2) 267", "Delver of Secrets", "4 Fire // Ice", '1 "Ach! Hans, Run!"'].join("\n"),
		);
		expect(errors).toEqual([]);
		expect(entries.map((e) => [e.name, e.quantity, e.set, e.collectorNumber])).toEqual([
			["Lightning Bolt", 2, undefined, undefined],
			["Counterspell", 1, "mh2", "267"],
			["Delver of Secrets", 1, undefined, undefined],
			["Fire // Ice", 4, undefined, undefined],
			['"Ach! Hans, Run!"', 1, undefined, undefined],
		]);
	});

	it("ignora linhas vazias", () => {
		const { entries, errors } = parseCardList("\n2 Opt\n\n   \n");
		expect(errors).toEqual([]);
		expect(entries).toHaveLength(1);
		expect(entries[0]).toMatchObject({ name: "Opt", quantity: 2 });
	});

	it("soma linhas repetidas da mesma carta", () => {
		const { entries } = parseCardList("2 Lightning Bolt\nSIDEBOARD:\n1 lightning bolt");
		expect(entries).toHaveLength(1);
		expect(entries[0]?.quantity).toBe(3);
	});

	it("mantém impressões diferentes separadas", () => {
		const { entries } = parseCardList("1 Island (NEO) 293\n1 Island (DMU) 262\n1 Island");
		expect(entries).toHaveLength(3);
	});

	it("descarta set sem número de colecionador", () => {
		const { entries } = parseCardList("1 Opt (XLN)");
		expect(entries[0]).toMatchObject({ name: "Opt" });
		expect(entries[0]?.set).toBeUndefined();
	});

	it("rejeita linhas fora do formato", () => {
		const { entries, errors } = parseCardList("- 2 Opt\n# Título\n3\n1 Opt");
		expect(entries.map((e) => e.name)).toEqual(["Opt"]);
		expect(errors.map((e) => e.lineNumber)).toEqual([1, 2, 3]);
	});

	it("entende a exportação do Moxfield", () => {
		const { entries, errors } = parseCardList(
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
		const source = "https://moxfield.com/decks/4czNxGfxT0SbJaHCozAnDQ\nhttps://example.com/x\n1 Opt";
		const { entries, errors } = parseCardList(source);
		expect(entries.map((e) => e.name)).toEqual(["Opt"]);
		expect(errors).toHaveLength(2);
		expect(errors[0]?.message).toMatch(/Moxfield/);
		expect(findMoxfieldUrl(source)).toBe("https://moxfield.com/decks/4czNxGfxT0SbJaHCozAnDQ");
		expect(findMoxfieldUrl("1 Opt")).toBeUndefined();
	});
});
