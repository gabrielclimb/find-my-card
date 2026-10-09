/**
 * Parser de listas de cartas, uma por linha.
 * Adaptado de mtg-deck-visualizer/src/parser/decklist-parser.ts.
 *
 * Aceita, por linha:
 *   2 Lightning Bolt
 *   1x Counterspell (MH2) 267
 *   1 Sol Ring (PLST) BLC-129 *F*
 *   Delver of Secrets
 * Linhas vazias e cabeçalhos da exportação do Moxfield/Arena ("SIDEBOARD:", "Commander") são ignorados.
 */

export interface ParsedEntry {
	name: string;
	quantity: number;
	/** Código do set em minúsculas, ex.: "mh2". */
	set?: string;
	collectorNumber?: string;
	lineNumber: number;
}

export interface ParseError {
	lineNumber: number;
	rawLine: string;
	message: string;
}

export interface ParseResult {
	entries: ParsedEntry[];
	errors: ParseError[];
}

const MOXFIELD_URL = /moxfield\.com\/decks\/[A-Za-z0-9_-]+/i;
const SECTION_WORDS = /^(deck|main ?deck|sideboard|commanders?|companion|maybeboard|considering|tokens?)$/i;

/** Primeiro link de deck do Moxfield encontrado no texto, se houver. */
export function findMoxfieldUrl(source: string): string | undefined {
	const m = source.match(/https?:\/\/(?:www\.)?moxfield\.com\/decks\/[A-Za-z0-9_-]+/i);
	return m?.[0];
}

/** Marcadores de acabamento do Moxfield: *F*, *E*, *Foil*. */
function stripFinish(rest: string): string {
	return rest.replace(/\s+\*[A-Za-z]+\*\s*$/, "").trim();
}

/** `Ancient Den (MRD) 278` → nome + impressão. */
function extractSetPrinting(rest: string): { name: string; set?: string; collectorNumber?: string } {
	const working = rest.trim();
	const m = working.match(/^(.*\S)\s+\(([A-Za-z0-9]{2,6})\)\s+([0-9A-Za-z][0-9A-Za-z★-]*)$/);
	if (m) {
		return { name: (m[1] ?? "").trim(), set: (m[2] ?? "").toLowerCase(), collectorNumber: (m[3] ?? "").trim() };
	}
	// `Nome (MRD)` sem número: descarta o set, já que só o número identifica a impressão.
	const setOnly = working.match(/^(.*\S)\s+\(([A-Za-z0-9]{2,6})\)$/);
	if (setOnly) return { name: (setOnly[1] ?? "").trim() };
	return { name: working };
}

function parseLine(raw: string, lineNumber: number): ParsedEntry | ParseError | null {
	const line = raw.trim();
	if (!line) return null;
	if (/^https?:\/\//i.test(line)) {
		return {
			lineNumber,
			rawLine: raw,
			message: MOXFIELD_URL.test(line)
				? "Links do Moxfield não podem ser lidos pelo app; cole o texto exportado do deck."
				: "Links não são suportados; cole a lista de cartas.",
		};
	}
	// Cabeçalhos de exportação: "SIDEBOARD:", "Commander", "Deck" (formato Arena).
	if (/^[A-Za-z ]+:$/.test(line) || SECTION_WORDS.test(line)) return null;

	let quantity = 1;
	let rest = line;
	const prefix = line.match(/^(\d+)\s*[xX]?\s+(.+)$/);
	if (prefix) {
		quantity = Number.parseInt(prefix[1] ?? "1", 10);
		rest = prefix[2] ?? "";
	}

	const { name, set, collectorNumber } = extractSetPrinting(stripFinish(rest));
	// Nomes de carta começam com letra (ou aspas, como "Ach! Hans, Run!").
	if (!/^["'A-Za-zÀ-ÿ]/.test(name)) {
		return { lineNumber, rawLine: raw, message: "Formato não reconhecido. Use: 2 Lightning Bolt" };
	}

	return {
		name,
		quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
		lineNumber,
		...(set ? { set, collectorNumber } : {}),
	};
}

export function entryKey(e: { name: string; set?: string; collectorNumber?: string }): string {
	const base = e.name.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
	return e.set && e.collectorNumber ? `${base}|${e.set}|${e.collectorNumber}` : base;
}

export function parseCardList(source: string): ParseResult {
	const entries: ParsedEntry[] = [];
	const errors: ParseError[] = [];
	const byKey = new Map<string, ParsedEntry>();

	source.split(/\r?\n/).forEach((raw, i) => {
		const parsed = parseLine(raw, i + 1);
		if (!parsed) return;
		if ("message" in parsed) {
			errors.push(parsed);
			return;
		}
		// Linhas repetidas da mesma carta (ex.: deck + sideboard) somam a quantidade.
		const key = entryKey(parsed);
		const existing = byKey.get(key);
		if (existing) {
			existing.quantity += parsed.quantity;
			return;
		}
		byKey.set(key, parsed);
		entries.push(parsed);
	});

	return { entries, errors };
}
