import type { CardInfo, CardPrices, Currency } from "../model/types";
import type { ScryfallPrices } from "../scryfall/types";

export const CURRENCIES: readonly Currency[] = ["usd", "eur"];

/** O Scryfall atualiza os preços uma vez por dia. */
export const PRICE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function num(value: string | null | undefined): number | undefined {
	const n = value ? Number.parseFloat(value) : Number.NaN;
	return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function pricesFromScryfall(prices: ScryfallPrices | undefined): CardPrices {
	if (!prices) return {};
	const out: CardPrices = {
		usd: num(prices.usd),
		usdFoil: num(prices.usd_foil) ?? num(prices.usd_etched),
		eur: num(prices.eur),
		eurFoil: num(prices.eur_foil) ?? num(prices.eur_etched),
	};
	for (const k of Object.keys(out) as (keyof CardPrices)[]) if (out[k] === undefined) delete out[k];
	return out;
}

/** Preço normal; se a impressão só existe em foil, o preço foil. */
export function priceOf(card: Pick<CardInfo, "prices"> | undefined, currency: Currency): { value: number; foil: boolean } | undefined {
	const p = card?.prices;
	if (!p) return undefined;
	const normal = currency === "usd" ? p.usd : p.eur;
	if (normal !== undefined) return { value: normal, foil: false };
	const foil = currency === "usd" ? p.usdFoil : p.eurFoil;
	return foil !== undefined ? { value: foil, foil: true } : undefined;
}

const formatters: Record<Currency, Intl.NumberFormat> = {
	usd: new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD" }),
	eur: new Intl.NumberFormat("pt-BR", { style: "currency", currency: "EUR" }),
};

/** "US$ 1,23", "€ 4,50 foil" ou `undefined` sem preço. */
export function formatPrice(card: Pick<CardInfo, "prices"> | undefined, currency: Currency): string | undefined {
	const p = priceOf(card, currency);
	if (!p) return undefined;
	return `${formatters[currency].format(p.value).replace(/ /g, " ")}${p.foil ? " foil" : ""}`;
}

export function pricesStale(card: CardInfo, now: number): boolean {
	return !card.pricesAt || now - card.pricesAt > PRICE_MAX_AGE_MS;
}
