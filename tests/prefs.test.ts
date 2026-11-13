import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadPrefs } from "../src/lib/prefs";

describe("loadPrefs", () => {
	let store: Record<string, string>;
	beforeEach(() => {
		store = {};
		vi.stubGlobal("localStorage", { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => (store[k] = v) });
	});

	it("troca modos removidos pelo padrão e mantém raridade", () => {
		store["fmc:prefs:a"] = JSON.stringify({ sort: "color" });
		store["fmc:prefs:b"] = JSON.stringify({ sort: "rarity-name" });
		expect(loadPrefs("a").sort).toBe("color-name");
		expect(loadPrefs("b").sort).toBe("rarity-name");
	});

	it("limpa o filtro de raridade salvo", () => {
		store["fmc:prefs:a"] = JSON.stringify({ rarities: ["rare", "bogus", "rare", 3] });
		store["fmc:prefs:b"] = JSON.stringify({ rarities: "rare" });
		expect(loadPrefs("a").rarities).toEqual(["rare"]);
		expect(loadPrefs("b").rarities).toEqual([]);
		expect(loadPrefs("c").rarities).toEqual([]);
	});

	it("aceita só moedas conhecidas", () => {
		store["fmc:prefs:a"] = JSON.stringify({ currency: "eur" });
		store["fmc:prefs:b"] = JSON.stringify({ currency: "brl" });
		expect(loadPrefs("a").currency).toBe("eur");
		expect(loadPrefs("b").currency).toBe("usd");
	});
});
