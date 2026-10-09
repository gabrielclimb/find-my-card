import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import { navigate } from "../app";
import { countQuantities, filterItems, groupItems } from "../lib/grouping";
import { cacheImages, listImageUrls, releaseImages, requestPersistentStorage } from "../lib/offline";
import { forgetPrefs, loadPrefs, savePrefs, type ViewPrefs } from "../lib/prefs";
import { useWakeLock } from "../lib/wake-lock";
import { cardImages } from "../model/card-info";
import { deleteList, getAllLists, getList, saveList } from "../model/store";
import type { CardInfo, CardList, ListItem } from "../model/types";
import { CardGrid } from "./CardGrid";
import { CardOverlay } from "./CardOverlay";
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
	const openItem = useCallback((item: ListItem) => setOpenKey(item.key), []);
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
		() => (list ? groupItems(filterItems(list.items, { query, hideFound: prefs.hideFound }), prefs.sort) : []),
		[list, query, prefs.hideFound, prefs.sort],
	);

	if (!list) return <div class="screen" />;

	const { found, total } = countQuantities(list.items);
	const openItemData = openKey ? list.items.find((i) => i.key === openKey) : undefined;
	const showHeaders = prefs.sort !== "name";
	const visibleCount = visible.reduce((n, g) => n + g.items.length, 0);

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

			{!online && !list.offline && <div class="banner">Sem internet: imagens não salvas podem não aparecer.</div>}

			<main class={`content view-${prefs.view}`}>
				{visibleCount === 0 ? (
					<p class="empty">{query ? `Nenhuma carta com “${query}”.` : prefs.hideFound && list.items.length > 0 ? "Todas as cartas foram encontradas. 🎉" : "Lista vazia."}</p>
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
