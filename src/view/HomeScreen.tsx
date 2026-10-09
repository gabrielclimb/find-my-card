import { useEffect, useState } from "preact/hooks";
import { navigate } from "../app";
import { countQuantities } from "../lib/grouping";
import { getAllLists } from "../model/store";
import type { CardList } from "../model/types";
import { OfflineIcon, PlusIcon } from "./icons";

export function HomeScreen() {
	const [lists, setLists] = useState<CardList[] | null>(null);

	useEffect(() => {
		getAllLists().then(setLists, () => setLists([]));
	}, []);

	return (
		<div class="screen">
			<header class="topbar">
				<h1 class="topbar-title">Find My Card</h1>
			</header>
			<main class="home">
				{lists === null ? null : lists.length === 0 ? (
					<div class="empty">
						<p class="empty-title">Nenhuma lista ainda</p>
						<p>Cole uma lista com uma carta por linha e consulte as imagens enquanto procura no bulk.</p>
						<pre class="example">{"2 Lightning Bolt\n1 Counterspell (MH2) 267\nDelver of Secrets"}</pre>
					</div>
				) : (
					<ul class="list-index">
						{lists.map((list) => {
							const { found, total } = countQuantities(list.items);
							return (
								<li key={list.id}>
									<a class="list-link" href={`#/list/${encodeURIComponent(list.id)}`}>
										<span class="list-link-name">{list.name}</span>
										<span class="list-link-meta">
											{found} de {total} encontradas · {list.items.length} cartas
											{list.offline && (
												<span class="badge" title="Disponível offline">
													<OfflineIcon size={14} /> offline
												</span>
											)}
										</span>
									</a>
								</li>
							);
						})}
					</ul>
				)}
				<button class="btn btn-primary btn-block" onClick={() => navigate("/new")}>
					<PlusIcon size={20} /> Nova lista
				</button>
			</main>
		</div>
	);
}
