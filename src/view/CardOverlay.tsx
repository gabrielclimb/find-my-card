import { useEffect, useRef, useState } from "preact/hooks";
import { displayName } from "../lib/grouping";
import { toCardInfo } from "../model/card-info";
import { resolveItems } from "../model/resolve";
import type { CardInfo, ListItem } from "../model/types";
import { fetchPrints } from "../scryfall/client";
import type { ScryfallCard } from "../scryfall/types";
import { ArtIcon, BackIcon, CheckIcon, CloseIcon, FlipIcon } from "./icons";

export interface OverlayNav {
	index: number;
	total: number;
	onPrev?: () => void;
	onNext?: () => void;
	/** Lado de onde a carta entra, para a animação após deslizar. */
	enterFrom?: "left" | "right";
}

/** Distância mínima, em px, para um arrasto horizontal contar como troca de carta. */
const SWIPE_THRESHOLD_PX = 60;

interface Props {
	item: ListItem;
	nav: OverlayNav;
	onClose: () => void;
	onToggleFound: () => void;
	onChangeCard: (card: CardInfo) => void;
	onReplaceItem: (item: ListItem) => void;
	onRemove: () => void;
}

export function CardOverlay({ item, nav, onClose, onToggleFound, onChangeCard, onReplaceItem, onRemove }: Props) {
	const [face, setFace] = useState(0);
	const [mode, setMode] = useState<"card" | "prints">("card");
	const [dragX, setDragX] = useState(0);
	const drag = useRef<{ x: number; y: number; horizontal?: boolean; moved: boolean } | null>(null);

	useEffect(() => {
		document.body.classList.add("no-scroll");
		return () => document.body.classList.remove("no-scroll");
	}, []);

	useEffect(() => {
		if (mode !== "card") return;
		const onKey = (e: KeyboardEvent) => {
			if (e.target instanceof HTMLInputElement) return;
			if (e.key === "ArrowLeft") nav.onPrev?.();
			if (e.key === "ArrowRight") nav.onNext?.();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [mode, nav]);

	const swipe = {
		onPointerDown(e: PointerEvent) {
			drag.current = { x: e.clientX, y: e.clientY, moved: false };
		},
		onPointerMove(e: PointerEvent) {
			const d = drag.current;
			if (!d) return;
			const dx = e.clientX - d.x;
			const dy = e.clientY - d.y;
			if (d.horizontal === undefined && Math.hypot(dx, dy) > 8) {
				d.horizontal = Math.abs(dx) > Math.abs(dy);
				// Só captura depois de reconhecer o deslize, para não desviar toques em botões e na imagem.
				if (d.horizontal) (e.currentTarget as Element).setPointerCapture(e.pointerId);
			}
			if (!d.horizontal) return;
			d.moved = true;
			// Resistência na primeira/última carta.
			const atEdge = (dx > 0 && !nav.onPrev) || (dx < 0 && !nav.onNext);
			setDragX(atEdge ? dx / 4 : dx);
		},
		onPointerUp(e: PointerEvent) {
			const d = drag.current;
			if (d?.horizontal) {
				const dx = e.clientX - d.x;
				if (dx <= -SWIPE_THRESHOLD_PX && nav.onNext) nav.onNext();
				else if (dx >= SWIPE_THRESHOLD_PX && nav.onPrev) nav.onPrev();
			}
			setDragX(0);
			// Mantém `moved` até o click que vem logo depois do pointerup.
			setTimeout(() => (drag.current = null), 0);
		},
		onPointerCancel() {
			drag.current = null;
			setDragX(0);
		},
	};
	const wasSwipe = () => drag.current?.moved === true;

	const card = item.card;
	const faces = card?.faces ?? [];
	const current = faces[face] ?? faces[0];

	return (
		<div class="overlay" role="dialog" aria-modal="true" aria-label={displayName(item)}>
			<div class="overlay-top">
				<div class="overlay-title">
					<strong>{current?.name ?? displayName(item)}</strong>
					<small>
						{nav.total > 1 ? `${nav.index + 1} de ${nav.total} · ` : ""}
						{item.quantity > 1 ? `${item.quantity} cópias · ` : ""}
						{card ? `${card.setName ?? card.set.toUpperCase()} #${card.collectorNumber}` : ""}
					</small>
				</div>
				<button class="icon-btn" aria-label="Fechar" onClick={onClose}>
					<CloseIcon />
				</button>
			</div>

			{mode === "prints" && card?.printsUri ? (
				<PrintPicker
					printsUri={card.printsUri}
					currentId={card.id}
					onPick={(print) => {
						onChangeCard(toCardInfo(print));
						setFace(0);
						setMode("card");
					}}
					onCancel={() => setMode("card")}
				/>
			) : card ? (
				<>
					<div
						class="overlay-body"
						{...swipe}
						onClick={(e) => !wasSwipe() && e.target === e.currentTarget && onClose()}
					>
						{nav.onPrev && (
							<button class="nav-btn nav-prev" aria-label="Carta anterior" onClick={nav.onPrev}>
								<BackIcon />
							</button>
						)}
						{current?.image ? (
							<img
								class={`overlay-img${dragX === 0 && nav.enterFrom ? ` enter-${nav.enterFrom}` : ""}`}
								style={dragX ? { transform: `translateX(${dragX}px)`, transition: "none" } : undefined}
								src={current.image}
								alt={current.name}
								draggable={false}
								onClick={() => !wasSwipe() && faces.length > 1 && setFace((face + 1) % faces.length)}
							/>
						) : (
							<p class="muted">Sem imagem disponível.</p>
						)}
						{nav.onNext && (
							<button class="nav-btn nav-next" aria-label="Próxima carta" onClick={nav.onNext}>
								<BackIcon />
							</button>
						)}
					</div>
					<div class="overlay-actions">
						<button class={`btn ${item.found ? "btn-found" : "btn-secondary"}`} onClick={onToggleFound} aria-pressed={item.found}>
							<CheckIcon size={20} /> {item.found ? "Encontrada" : "Marcar encontrada"}
						</button>
						{faces.length > 1 && (
							<button class="btn btn-secondary" onClick={() => setFace((face + 1) % faces.length)}>
								<FlipIcon size={20} /> Virar
							</button>
						)}
						{card.printsUri && (
							<button class="btn btn-secondary" onClick={() => setMode("prints")}>
								<ArtIcon size={20} /> Outras artes
							</button>
						)}
					</div>
				</>
			) : (
				<FixMissing item={item} onReplaceItem={onReplaceItem} onRemove={onRemove} />
			)}
		</div>
	);
}

function PrintPicker({
	printsUri,
	currentId,
	onPick,
	onCancel,
}: {
	printsUri: string;
	currentId: string;
	onPick: (card: ScryfallCard) => void;
	onCancel: () => void;
}) {
	const [prints, setPrints] = useState<ScryfallCard[] | null>(null);
	const [error, setError] = useState(false);

	useEffect(() => {
		let alive = true;
		fetchPrints(printsUri).then(
			(p) => alive && setPrints(p),
			() => alive && setError(true),
		);
		return () => {
			alive = false;
		};
	}, [printsUri]);

	return (
		<div class="prints">
			<div class="prints-head">
				<span>{prints ? `${prints.length} impressões` : error ? "" : "Carregando impressões…"}</span>
				<button class="btn btn-secondary btn-small" onClick={onCancel}>
					Voltar
				</button>
			</div>
			{error && <p class="error-text">Não foi possível carregar as impressões (sem internet?).</p>}
			<div class="prints-grid">
				{prints?.map((p) => {
					const uris = p.image_uris ?? p.card_faces?.[0]?.image_uris;
					return (
						<button
							key={p.id}
							class={`print${p.id === currentId ? " is-current" : ""}`}
							onClick={() => onPick(p)}
							aria-label={`${p.set_name} #${p.collector_number}`}
						>
							{uris?.small || uris?.normal ? (
								<img
									src={uris.normal ?? uris.small}
									srcset={[uris.small && `${uris.small} 146w`, uris.normal && `${uris.normal} 488w`].filter(Boolean).join(", ")}
									sizes="33vw"
									alt=""
									loading="lazy"
								/>
							) : (
								<span class="tile-missing">?</span>
							)}
							<small>
								{p.set?.toUpperCase()} #{p.collector_number}
							</small>
						</button>
					);
				})}
			</div>
		</div>
	);
}

function FixMissing({
	item,
	onReplaceItem,
	onRemove,
}: {
	item: ListItem;
	onReplaceItem: (item: ListItem) => void;
	onRemove: () => void;
}) {
	const [name, setName] = useState(item.name);
	const [state, setState] = useState<"idle" | "busy" | "notfound" | "offline">("idle");

	const retry = async (e: Event) => {
		e.preventDefault();
		setState("busy");
		try {
			const [resolved] = await resolveItems([{ ...item, name: name.trim(), set: undefined, collectorNumber: undefined }]);
			if (resolved?.card) onReplaceItem(resolved);
			else setState("notfound");
		} catch {
			setState("offline");
		}
	};

	return (
		<form class="fix" onSubmit={retry}>
			<p>
				<strong>“{item.name}”</strong> não foi encontrada no Scryfall. Corrija o nome (em inglês) e tente de novo.
			</p>
			<input type="text" value={name} onInput={(e) => setName(e.currentTarget.value)} autocapitalize="words" />
			{state === "notfound" && <p class="error-text">Ainda não encontrada.</p>}
			{state === "offline" && <p class="error-text">Sem conexão com o Scryfall.</p>}
			<button class="btn btn-primary btn-block" type="submit" disabled={state === "busy" || !name.trim()}>
				{state === "busy" ? "Buscando…" : "Buscar"}
			</button>
			<button class="btn btn-danger btn-block" type="button" onClick={onRemove}>
				Remover da lista
			</button>
		</form>
	);
}
