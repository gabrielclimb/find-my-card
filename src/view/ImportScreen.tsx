import { useEffect, useMemo, useState } from "preact/hooks";
import { navigate } from "../app";
import { findMoxfieldUrl, parseMarkdownList } from "../import/parse-markdown";
import { itemsFromEntries, mergeWithPrevious, resolveItems, type ResolveProgress } from "../model/resolve";
import { getList, newListId, saveList } from "../model/store";
import type { CardList } from "../model/types";
import { BackIcon } from "./icons";

function defaultName(): string {
	return `Lista de ${new Date().toLocaleDateString("pt-BR")}`;
}

export function ImportScreen({ listId }: { listId?: string }) {
	const [existing, setExisting] = useState<CardList | null>(null);
	const [name, setName] = useState("");
	const [source, setSource] = useState("");
	const [progress, setProgress] = useState<ResolveProgress | null>(null);
	const [failure, setFailure] = useState<string | null>(null);

	useEffect(() => {
		if (!listId) return;
		void getList(listId).then((list) => {
			if (!list) return navigate("/", true);
			setExisting(list);
			setName(list.name);
			setSource(list.source);
		});
	}, [listId]);

	const parsed = useMemo(() => parseMarkdownList(source), [source]);
	const busy = progress !== null;

	const onFile = async (e: Event) => {
		const file = (e.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;
		const text = await file.text();
		setSource(text);
		if (!name) setName(parseMarkdownList(text).title ?? file.name.replace(/\.(md|markdown|txt)$/i, ""));
	};

	const onSubmit = async (e: Event) => {
		e.preventDefault();
		if (parsed.entries.length === 0 || busy) return;
		setFailure(null);
		const fresh = itemsFromEntries(parsed.entries);
		const items = existing ? mergeWithPrevious(fresh, existing.items) : fresh;
		try {
			setProgress({ done: 0, total: items.filter((i) => !i.card).length });
			const resolved = await resolveItems(items, setProgress);
			const now = Date.now();
			const list: CardList = {
				id: existing?.id ?? newListId(),
				name: name.trim() || parsed.title || defaultName(),
				source,
				items: resolved,
				offline: existing?.offline ?? false,
				createdAt: existing?.createdAt ?? now,
				updatedAt: now,
			};
			await saveList(list);
			navigate(`/list/${encodeURIComponent(list.id)}`, true);
		} catch {
			setFailure("Não foi possível falar com o Scryfall. Verifique a conexão e tente de novo.");
			setProgress(null);
		}
	};

	const moxfieldUrl = findMoxfieldUrl(source);
	const lineErrors = moxfieldUrl ? parsed.errors.filter((err) => !findMoxfieldUrl(err.rawLine)) : parsed.errors;
	const totalCopies = parsed.entries.reduce((n, e) => n + e.quantity, 0);

	return (
		<div class="screen">
			<header class="topbar">
				<button class="icon-btn" aria-label="Voltar" onClick={() => navigate(existing ? `/list/${encodeURIComponent(existing.id)}` : "/", true)}>
					<BackIcon />
				</button>
				<h1 class="topbar-title">{existing ? "Editar lista" : "Nova lista"}</h1>
			</header>
			<form class="import" onSubmit={onSubmit}>
				<label class="field">
					<span>Nome</span>
					<input
						type="text"
						value={name}
						placeholder={parsed.title ?? defaultName()}
						onInput={(e) => setName(e.currentTarget.value)}
						disabled={busy}
					/>
				</label>
				<label class="field">
					<span>Cartas em Markdown</span>
					<textarea
						value={source}
						rows={12}
						spellcheck={false}
						autocapitalize="off"
						placeholder={"2 Lightning Bolt\n1 Counterspell (MH2) 267\nDelver of Secrets"}
						onInput={(e) => setSource(e.currentTarget.value)}
						disabled={busy}
					/>
				</label>
				<label class="btn btn-secondary file-btn">
					Abrir arquivo .md
					<input type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" onChange={onFile} disabled={busy} />
				</label>

				<p class="import-summary">
					{parsed.entries.length} cartas diferentes · {totalCopies} cópias
					{parsed.entries.some((e) => e.found) && ` · ${parsed.entries.filter((e) => e.found).length} já marcadas [x]`}
				</p>
				{moxfieldUrl && (
					<div class="callout">
						<p>
							<strong>Link do Moxfield detectado.</strong> O Moxfield não deixa apps web lerem decks pelo link, mas dá para trazer
							as cartas em três passos:
						</p>
						<ol>
							<li>
								<a href={moxfieldUrl} target="_blank" rel="noopener noreferrer">
									Abra o deck no Moxfield
								</a>
							</li>
							<li>
								Toque em <strong>Export</strong> (ou <strong>More → Export</strong>) e depois em <strong>Copy for Moxfield</strong>
							</li>
							<li>Volte aqui e cole o texto no lugar do link</li>
						</ol>
					</div>
				)}
				{lineErrors.length > 0 && (
					<details class="import-errors" open>
						<summary>{lineErrors.length} linhas não reconhecidas (serão ignoradas)</summary>
						<ul>
							{lineErrors.map((err) => (
								<li key={err.lineNumber}>
									<code>
										{err.lineNumber}: {err.rawLine.trim()}
									</code>{" "}
									— {err.message}
								</li>
							))}
						</ul>
					</details>
				)}
				{failure && <p class="error-text">{failure}</p>}

				<button class="btn btn-primary btn-block" type="submit" disabled={busy || parsed.entries.length === 0}>
					{busy
						? `Buscando cartas… ${progress.done}/${progress.total}`
						: existing
							? "Salvar e atualizar"
							: "Importar"}
				</button>
				{busy && <progress class="progress" value={progress.done} max={Math.max(1, progress.total)} />}
			</form>
		</div>
	);
}
