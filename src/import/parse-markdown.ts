/**
 * Parser tolerante de listas em Markdown no estilo decklist.
 * Adaptado de mtg-deck-visualizer/src/parser/decklist-parser.ts.
 *
 * Aceita, por linha:
 *   - [ ] 2 Lightning Bolt
 *   * [x] 1x Counterspell (MH2) 267
 *   3 Delver of Secrets #blue
 *   Brainstorm
 *   Ponder x2
 * Cabeçalhos (#), linhas vazias, comentários (//), citações e separadores de tabela são ignorados.
 */

export interface ParsedEntry {
	name: string;
	quantity: number;
	/** Código do set em minúsculas, ex.: "mh2". */
	set?: string;
	collectorNumber?: string;
	/** Linha marcada como `[x]` no Markdown. */
	found: boolean;
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
	/** Primeiro cabeçalho do texto, útil como nome sugerido da lista. */
	title?: string;
}

const MOXFIELD_URL = /moxfield\.com\/decks\/[A-Za-z0-9_-]+/i;
const SECTION_WORDS = /^(deck|main ?deck|sideboard|commanders?|companion|maybeboard|considering|tokens?)$/i;

/** Primeiro link de deck do Moxfield encontrado no texto, se houver. */
export function findMoxfieldUrl(source: string): string | undefined {
	const m = source.match(/https?:\/\/(?:www\.)?moxfield\.com\/decks\/[A-Za-z0-9_-]+/i);
	return m?.[0];
}

const LIST_MARKER = /^(?:[-*+]|\d+[.)])\s+/;
const CHECKBOX = /^\[([ xX])\]\s*/;

function stripInlineMarkdown(text: string): string {
	return text
		.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // [Nome](url)
		.replace(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g, "$1") // [[Nome]] (wikilink)
		.replace(/(\*\*|__)(.+?)\1/g, "$2")
		.replace(/`([^`]+)`/g, "$1")
		.replace(/~~(.+?)~~/g, "$1");
}

function extractTrailingTags(rest: string): string {
	let working = rest.trim();
	while (true) {
		const m = working.match(/\s+#[A-Za-z][A-Za-z0-9_-]*\s*$/);
		if (!m || m.index === undefined) break;
		working = working.slice(0, m.index).trimEnd();
	}
	// Marcadores de acabamento do Moxfield: *F*, *E*, *Foil*
	return working.replace(/\s+\*[A-Za-z]+\*\s*$/, "").trim();
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
	let line = raw.trim();
	if (!line) return null;
	if (line.startsWith("//")) return null;
	if (/^(?:[-*+]\s+)?<?https?:\/\//i.test(line)) {
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
	if (/^#{1,6}\s/.test(line) || /^#{1,6}$/.test(line)) return null;
	if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) return null;
	if (/^\|?[\s:|-]+\|?$/.test(line) && line.includes("-")) return null;

	line = line.replace(/^>+\s*/, "");
	line = line.replace(LIST_MARKER, "");

	let found = false;
	const checkbox = line.match(CHECKBOX);
	if (checkbox) {
		found = checkbox[1]?.toLowerCase() === "x";
		line = line.slice(checkbox[0].length);
	}

	line = stripInlineMarkdown(line).trim();
	if (!line) return null;

	let quantity = 1;
	let rest = line;
	const prefix = line.match(/^(\d+)\s*[xX]?\s+(.+)$/);
	if (prefix) {
		quantity = Number.parseInt(prefix[1] ?? "1", 10);
		rest = prefix[2] ?? "";
	} else {
		const suffix = line.match(/^(.+?)\s+\(?[xX](\d+)\)?$/) ?? line.match(/^(.+?)\s+\(?(\d+)[xX]\)?$/);
		if (suffix) {
			rest = suffix[1] ?? "";
			quantity = Number.parseInt(suffix[2] ?? "1", 10);
		}
	}

	const { name, set, collectorNumber } = extractSetPrinting(extractTrailingTags(rest));
	if (!name || !/[A-Za-z]/.test(name)) {
		return { lineNumber, rawLine: raw, message: "Não foi possível identificar o nome da carta." };
	}
	if (line.includes("|")) {
		return { lineNumber, rawLine: raw, message: "Tabelas não são suportadas; use uma carta por linha." };
	}

	return {
		name,
		quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
		found,
		lineNumber,
		...(set ? { set, collectorNumber } : {}),
	};
}

export function entryKey(e: { name: string; set?: string; collectorNumber?: string }): string {
	const base = e.name.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
	return e.set && e.collectorNumber ? `${base}|${e.set}|${e.collectorNumber}` : base;
}

export function parseMarkdownList(source: string): ParseResult {
	const entries: ParsedEntry[] = [];
	const errors: ParseError[] = [];
	const byKey = new Map<string, ParsedEntry>();
	let title: string | undefined;

	source.split(/\r?\n/).forEach((raw, i) => {
		if (title === undefined) {
			const h = raw.trim().match(/^#{1,6}\s+(.+)$/);
			if (h) title = (h[1] ?? "").trim() || undefined;
		}
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
			existing.found = existing.found && parsed.found;
			return;
		}
		byKey.set(key, parsed);
		entries.push(parsed);
	});

	return { entries, errors, title };
}
