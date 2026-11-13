import { describe, expect, it } from "vitest";
import { formatPrice, PRICE_MAX_AGE_MS, pricesFromScryfall, priceOf } from "../src/lib/price";
import { toCardInfo } from "../src/model/card-info";
import { needsRefresh } from "../src/model/resolve";
import type { CardInfo } from "../src/model/types";

const base: CardInfo = { id: "1", name: "Opt", colors: ["U"], typeLine: "Instant", set: "xln", collectorNumber: "65", faces: [{ name: "Opt" }] };

describe("pricesFromScryfall", () => {
	it("converte strings, ignora null e zero, e usa etched quando não há foil", () => {
		expect(pricesFromScryfall({ usd: "1.23", usd_foil: null, usd_etched: "9.50", eur: "0.00", eur_foil: "2" })).toEqual({
			usd: 1.23,
			usdFoil: 9.5,
			eurFoil: 2,
		});
		expect(pricesFromScryfall(undefined)).toEqual({});
	});

	it("toCardInfo guarda preços e o momento da leitura", () => {
		const info = toCardInfo({ id: "1", name: "Opt", prices: { usd: "0.25" } });
		expect(info.prices).toEqual({ usd: 0.25 });
		expect(info.pricesAt).toBeGreaterThan(0);
	});
});

describe("formatPrice", () => {
	it("formata em US$ e €, no padrão brasileiro", () => {
		const card = { prices: { usd: 1234.5, eur: 0.3 } };
		expect(formatPrice(card, "usd")).toBe("US$ 1.234,50");
		expect(formatPrice(card, "eur")).toBe("€ 0,30");
	});

	it("cai para o foil quando a impressão só existe em foil", () => {
		const card = { prices: { usdFoil: 4.5 } };
		expect(priceOf(card, "usd")).toEqual({ value: 4.5, foil: true });
		expect(formatPrice(card, "usd")).toBe("US$ 4,50 foil");
		expect(formatPrice(card, "eur")).toBeUndefined();
		expect(formatPrice(undefined, "usd")).toBeUndefined();
	});
});

describe("needsRefresh", () => {
	const now = 1_800_000_000_000;
	it("atualiza preços com mais de um dia ou sem raridade", () => {
		expect(needsRefresh({ ...base, rarity: "common", pricesAt: now - 1000 }, now)).toBe(false);
		expect(needsRefresh({ ...base, rarity: "common", pricesAt: now - PRICE_MAX_AGE_MS - 1 }, now)).toBe(true);
		expect(needsRefresh({ ...base, rarity: "common" }, now)).toBe(true);
		expect(needsRefresh({ ...base, pricesAt: now }, now)).toBe(true);
		expect(needsRefresh(undefined, now)).toBe(false);
	});
});
