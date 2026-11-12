import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import { navigate } from "../app";
import { countQuantities, filterItems, groupItems, RARITY_FILTERS, type Group } from "../lib/grouping";
import { cacheImages, listImageUrls, releaseImages, requestPersistentStorage } from "../lib/offline";
import { forgetPrefs, loadPrefs, savePrefs, type ViewPrefs } from "../lib/prefs";
import { useWakeLock } from "../lib/wake-lock";
import { cardImages } from "../model/card-info";
import { fetchMissingRarities } from "../model/resolve";
import { deleteList, getAllLists, getList, saveList } from "../model/store";
import type { CardInfo, CardList, ListItem } from "../model/types";
import { LONG_LINK_CHARS, listToText, shareUrl } from "../share/share-list";
import { CardGrid } from "./CardGrid";
import { CardOverlay, type OverlayNav } from "./CardOverlay";
import { useBackDismiss } from "./hooks";
import { BackIcon, CloseIcon, GridIcon, ListIcon, MenuIcon, SearchIcon, SunIcon, SunOffIcon } from "./icons";
import { MenuSheet, type OfflineStatus } from "./MenuSheet";
import { NameList } from "./NameList";

export function ListScreen({ listId }: { listId: string }) {
	const [list, setList] = useState<CardList | null>(null);
	const [prefs, setPrefs] = useState<ViewPrefs>(() => loadPrefs(listId));
	const [query, setQuery] = useState("");
	const [searchOpen, setSearchOpen] = useState(false);
	const [openKey, setOpenKey] = useState<string | null>(null);
	// Ordem das cartas ao abrir o overlay; fica fixa enquanto ele está aberto.
	const [navKeys, setNavKeys] = useState<string[]>([]);
	const [enterFrom, setEnterFrom] = useState<OverlayNav["enterFrom"]>();
	const visibleRef = useRef<Group[]>([]);
	const [menuOpen, setMenuOpen] = useState(false);
	const [offline, setOffline] = useState<OfflineStatus>({ busy: false, done: 0, total: 0, failed: 0 });
	const [toast, setToast] = useState<string | null>(null);
	const [online, setOnline] = useState(() => navigator.onLine);
	const listRef = useRef<CardList | null>(null);
	listRef.current = list;

	const wake = useWakeLock(prefs.keepAwake);

	useEffect(() => {
		void getList(listId).then((l) => (l ? setList(l) : navigate("/", true)));
	}, [listId]);

	useEffect(() => {
		const update = () => setOnline(navigator.onLine);
		window.addEventListener("online", update);
		window.addEventListener("offline", update);
		return () => {
			window.removeEventListener("online", update);
			window.removeEventListener("offline", update);
		};
	}, []);

	useEffect(() => {
		if (!toast) return;
		const t = setTimeout(() => setToast(null), 2200);
		return () => clearTimeout(t);
	}, [toast]);

	const updateList = useCallback((fn: (l: CardList) => CardList) => {
		const current = listRef.current;
		if (!current) return;
		const next = fn(current);
		listRef.current = next;
		setList(next);
		void saveList(next);
	}, []);

	const updateItem = useCallback(
		(key: string, fn: (i: ListItem) => ListItem) =>
			updateList((l) => ({ ...l, items: l.items.map((i) => (i.key === key ? fn(i) : i)) })),
		[updateList],
	);

	const downloadImages = useCallback(async (urls: string[]) => {
		if (urls.length === 0) return;
		setOffline({ busy: true, done: 0, total: urls.length, failed: 0 });
		const failed = await cacheImages(urls, (done, total) => setOffline((s) => ({ ...s, done, total })));
		setOffline((s) => ({ ...s, busy: false, failed }));
	}, []);

	// Listas salvas antes da raridade existir: completa a raridade uma vez ao abrir.
	const listLoaded = list !== null;
	useEffect(() => {
		const current = listRef.current;
		if (!current || !navigator.onLine || !current.items.some((i) => i.card && !i.card.rarity)) return;
		void fetchMissingRarities(current.items)
			.then((rarities) => {
				if (rarities.size === 0) return;
				updateList((l) => ({
					...l,
					items: l.items.map((i) => {
						const rarity = i.card && !i.card.rarity ? rarities.get(i.card.id) : undefined;
						return rarity && i.card ? { ...i, card: { ...i.card, rarity } } : i;
					}),
				}));
			})
			.catch(() => undefined);
	}, [listLoaded, updateList]);

	// Lista offline: ao abrir, completa imagens que faltem (após reimportar ou trocar arte).
	const offlineEnabled = list?.offline ?? false;
	useEffect(() => {
		if (offlineEnabled && listRef.current && navigator.onLine) void downloadImages(listImageUrls(listRef.current));
	}, [offlineEnabled, downloadImages]);

	const changePrefs = (patch: Partial<ViewPrefs>) => {
		const next = { ...prefs, ...patch };
		setPrefs(next);
		savePrefs(listId, next);
	};

	const toggleFound = useCallback((item: ListItem) => updateItem(item.key, (i) => ({ ...i, found: !i.found })), [updateItem]);
	const openItem = useCallback((item: ListItem) => {
		setNavKeys(visibleRef.current.flatMap((g) => g.items.map((i) => i.key)));
		setEnterFrom(undefined);
		setOpenKey(item.key);
	}, []);
	const closeOverlay = useCallback(() => setOpenKey(null), []);
	const closeMenu = useCallback(() => setMenuOpen(false), []);
	useBackDismiss(openKey !== null, closeOverlay);
	useBackDismiss(menuOpen, closeMenu);

	const toggleWake = () => {
		if (wake === "unsupported") {
			setToast("Este navegador não permite manter a tela acesa");
			return;
		}
		changePrefs({ keepAwake: !prefs.keepAwake });
		setToast(prefs.keepAwake ? "A tela pode apagar normalmente" : "A tela vai ficar acesa");
	};

	const toggleOffline = async (on: boolean) => {
		const current = listRef.current;
		if (!current) return;
		if (on) {
			await requestPersistentStorage();
			updateList((l) => ({ ...l, offline: true }));
		} else {
			const others = (await getAllLists()).filter((l) => l.offline && l.id !== current.id);
			await releaseImages(current, others);
			updateList((l) => ({ ...l, offline: false }));
			setOffline({ busy: false, done: 0, total: 0, failed: 0 });
		}
	};

	const shareLink = async () => {
		const current = listRef.current;
		if (!current) return;
		const url = await shareUrl(current);
		if (url.length > LONG_LINK_CHARS && !confirm("Lista grande: o link pode não abrir em alguns apps. Prefira “Copiar texto”. Compartilhar o link mesmo assim?")) return;
		if (navigator.share) {
			try {
				await navigator.share({ title: current.name, url });
				return;
			} catch (e) {
				if (e instanceof DOMException && e.name === "AbortError") return;
				// Outro erro (ex.: navegador recusou): copia o link.
			}
		}
		await copy(url, "Link copiado");
	};

	const copy = async (text: string, done: string) => {
		try {
			await navigator.clipboard.writeText(text);
			setToast(done);
		} catch {
			setToast("Não foi possível copiar");
		}
	};

	const removeList = async () => {
		const current = listRef.current;
		if (!current || !confirm(`Excluir a lista “${current.name}”?`)) return;
		if (current.offline) {
			const others = (await getAllLists()).filter((l) => l.offline && l.id !== current.id);
			await releaseImages(current, others);
		}
		await deleteList(current.id);
		forgetPrefs(current.id);
		navigate("/", true);
	};

	const visible = useMemo(
		() => (list ? groupItems(filterItems(list.items, { query, hideFound: prefs.hideFound, rarities: prefs.rarities }), prefs.sort) : []),
		[list, query, prefs.hideFound, prefs.rarities, prefs.sort],
	);

	visibleRef.current = visible;

	// Pré-carrega as imagens vizinhas para a troca por deslize ser instantânea.
	useEffect(() => {
		if (!openKey || !list) return;
		const i = navKeys.indexOf(openKey);
		for (const key of [navKeys[i - 1], navKeys[i + 1]]) {
			const src = key ? list.items.find((it) => it.key === key)?.card?.faces[0]?.image : undefined;
			if (src) new Image().src = src;
		}
	}, [openKey, navKeys, list]);

	if (!list) return <div class="screen" />;

	const { found, total } = countQuantities(list.items);
	const openItemData = openKey ? list.items.find((i) => i.key === openKey) : undefined;
	const navSeq = navKeys.filter((k) => list.items.some((i) => i.key === k));
	const navIndex = openKey ? navSeq.indexOf(openKey) : -1;
	const goTo = (offset: -1 | 1) => () => {
		const key = navSeq[navIndex + offset];
		if (!key) return;
		setEnterFrom(offset > 0 ? "right" : "left");
		setOpenKey(key);
	};
	const nav: OverlayNav = {
		index: Math.max(0, navIndex),
		total: navSeq.length,
		onPrev: navIndex > 0 ? goTo(-1) : undefined,
		onNext: navIndex >= 0 && navIndex < navSeq.length - 1 ? goTo(1) : undefined,
		enterFrom,
	};
	const showHeaders = prefs.sort !== "name";
	const visibleCount = visible.reduce((n, g) => n + g.items.length, 0);
	const rarityLabels = RARITY_FILTERS.filter((r) => prefs.rarities.includes(r.value)).map((r) => r.label);
	const emptyMessage = query
		? `Nenhuma carta com “${query}”${rarityLabels.length ? " nas raridades escolhidas" : ""}.`
		: rarityLabels.length && list.items.length > 0
			? `Nenhuma carta ${prefs.hideFound ? "faltando " : ""}com raridade ${rarityLabels.join(", ")}.`
			: prefs.hideFound && list.items.length > 0
				? "Todas as cartas foram encontradas. 🎉"
				: "Lista vazia.";

	return (
		<div class="screen" style={{ "--cols": String(prefs.columns) }}>
			<header class="topbar">
				{searchOpen ? (
					<>
						<SearchIcon size={20} />
						<input
							class="search-input"
							type="search"
							value={query}
							placeholder="Buscar por nome"
							autoFocus
							autocapitalize="off"
							autocomplete="off"
							onInput={(e) => setQuery(e.currentTarget.value)}
						/>
						<button
							class="icon-btn"
							aria-label="Fechar busca"
							onClick={() => {
								setQuery("");
								setSearchOpen(false);
							}}
						>
							<CloseIcon />
						</button>
					</>
				) : (
					<>
						<button class="icon-btn" aria-label="Voltar para as listas" onClick={() => navigate("/")}>
							<BackIcon />
						</button>
						<div class="topbar-title">
							<span class="title-name">{list.name}</span>
							<span class="title-count">
								{found}/{total} encontradas
							</span>
						</div>
						<button class="icon-btn" aria-label="Buscar" onClick={() => setSearchOpen(true)}>
							<SearchIcon />
						</button>
					</>
				)}
				<button
					class="icon-btn"
					aria-label={prefs.view === "images" ? "Ver nomes" : "Ver imagens"}
					onClick={() => changePrefs({ view: prefs.view === "images" ? "names" : "images" })}
				>
					{prefs.view === "images" ? <ListIcon /> : <GridIcon />}
				</button>
				<button
					class={`icon-btn wake wake-${wake}`}
					aria-label={wake === "active" ? "Tela acesa: ativo" : wake === "unsupported" ? "Tela acesa: não suportado" : "Tela acesa: desligado"}
					aria-pressed={wake === "active"}
					onClick={toggleWake}
				>
					{wake === "active" ? <SunIcon /> : <SunOffIcon />}
				</button>
				<button class="icon-btn" aria-label="Opções" onClick={() => setMenuOpen(true)}>
					<MenuIcon />
				</button>
			</header>

			{rarityLabels.length > 0 && (
				<div class="filter-bar">
					<span class="filter-bar-text">Raridade: {rarityLabels.join(", ")}</span>
					<button class="icon-btn" aria-label="Remover filtro de raridade" onClick={() => changePrefs({ rarities: [] })}>
						<CloseIcon size={20} />
					</button>
				</div>
			)}

			{!online && !list.offline && <div class="banner">Sem internet: imagens não salvas podem não aparecer.</div>}

			<main class={`content view-${prefs.view}`}>
				{visibleCount === 0 ? (
					<p class="empty">{emptyMessage}</p>
				) : prefs.view === "images" ? (
					<CardGrid groups={visible} showHeaders={showHeaders} onOpen={openItem} onToggleFound={toggleFound} />
				) : (
					<NameList groups={visible} showHeaders={showHeaders} onOpen={openItem} onToggleFound={toggleFound} />
				)}
				{prefs.view === "images" && visibleCount > 0 && <p class="hint">Toque para ampliar · segure para marcar como encontrada</p>}
			</main>

			{openItemData && (
				<CardOverlay
					key={openItemData.key}
					item={openItemData}
					nav={nav}
					onClose={() => history.back()}
					onToggleFound={() => toggleFound(openItemData)}
					onChangeCard={(card: CardInfo) => {
						updateItem(openItemData.key, (i) => ({ ...i, card, artChosen: true }));
						if (list.offline) void downloadImages(cardImages(card));
					}}
					onReplaceItem={(replacement) => {
						updateItem(openItemData.key, () => ({ ...replacement, key: openItemData.key }));
						if (list.offline) void downloadImages(cardImages(replacement.card));
					}}
					onRemove={() => {
						history.back();
						updateList((l) => ({ ...l, items: l.items.filter((i) => i.key !== openItemData.key) }));
					}}
				/>
			)}

			{menuOpen && (
				<MenuSheet
					list={list}
					prefs={prefs}
					wake={wake}
					offline={offline}
					onPrefs={changePrefs}
					onRename={(name) => updateList((l) => ({ ...l, name }))}
					onToggleOffline={(on) => void toggleOffline(on)}
					onEdit={() => navigate(`/edit/${encodeURIComponent(list.id)}`, true)}
					onResetFound={() => updateList((l) => ({ ...l, items: l.items.map((i) => ({ ...i, found: false })) }))}
					onShareLink={() => void shareLink()}
					onCopyText={() => void copy(listToText(list), "Lista copiada")}
					onDelete={() => void removeList()}
					onClose={() => history.back()}
				/>
			)}

			{toast && (
				<div class="toast" role="status">
					{toast}
				</div>
			)}
		</div>
	);
}
