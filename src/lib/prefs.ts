import type { SortMode } from "./grouping";

export type ViewMode = "images" | "names";

export interface ViewPrefs {
	view: ViewMode;
	sort: SortMode;
	columns: number;
	hideFound: boolean;
	keepAwake: boolean;
}

export const DEFAULT_PREFS: ViewPrefs = {
	view: "images",
	sort: "color-name",
	columns: 3,
	hideFound: false,
	keepAwake: true,
};

export const MIN_COLUMNS = 2;
export const MAX_COLUMNS = 6;

const GLOBAL_KEY = "fmc:prefs";
const listKey = (id: string) => `fmc:prefs:${id}`;

function read(key: string): Partial<ViewPrefs> {
	try {
		const raw = localStorage.getItem(key);
		return raw ? (JSON.parse(raw) as Partial<ViewPrefs>) : {};
	} catch {
		return {};
	}
}

function write(key: string, value: ViewPrefs): void {
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch {
		// Armazenamento indisponível: as preferências valem só nesta sessão.
	}
}

/** Preferências da lista; listas novas herdam as últimas usadas. */
export function loadPrefs(listId: string): ViewPrefs {
	const prefs = { ...DEFAULT_PREFS, ...read(GLOBAL_KEY), ...read(listKey(listId)) };
	// O modo "color" (só cor, ordem de importação) foi removido; vira "color-name".
	if (prefs.sort !== "name") prefs.sort = "color-name";
	return prefs;
}

export function savePrefs(listId: string, prefs: ViewPrefs): void {
	write(listKey(listId), prefs);
	write(GLOBAL_KEY, prefs);
}

export function forgetPrefs(listId: string): void {
	try {
		localStorage.removeItem(listKey(listId));
	} catch {
		// ignorado
	}
}
