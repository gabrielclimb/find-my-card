import type { Group } from "../lib/grouping";
import { displayName } from "../lib/grouping";
import { formatPrice } from "../lib/price";
import type { Currency, ListItem } from "../model/types";
import { pressHandlers } from "./hooks";
import { CheckIcon } from "./icons";

interface Props {
	groups: Group[];
	showHeaders: boolean;
	currency: Currency;
	onOpen: (item: ListItem) => void;
	onToggleFound: (item: ListItem) => void;
}

export function CardGrid({ groups, showHeaders, currency, onOpen, onToggleFound }: Props) {
	return (
		<>
			{groups.map((group) => (
				<section key={group.key} class="group">
					{showHeaders && (
						<h2 class={`group-header color-${group.key}`}>
							{group.label} <span class="group-count">{group.items.length}</span>
						</h2>
					)}
					<div class="grid">
						{group.items.map((item) => (
							<CardTile key={item.key} item={item} currency={currency} onOpen={onOpen} onToggleFound={onToggleFound} />
						))}
					</div>
				</section>
			))}
		</>
	);
}

function CardTile({ item, currency, onOpen, onToggleFound }: { item: ListItem; currency: Currency; onOpen: Props["onOpen"]; onToggleFound: Props["onToggleFound"] }) {
	const image = item.card?.faces[0]?.image;
	const name = displayName(item);
	const price = formatPrice(item.card, currency);
	return (
		<button
			type="button"
			class={`tile${item.found ? " is-found" : ""}`}
			aria-label={`${name}${item.quantity > 1 ? `, ${item.quantity} cópias` : ""}${price ? `, ${price}` : ""}${item.found ? ", encontrada" : ""}`}
			{...pressHandlers(
				() => onOpen(item),
				() => onToggleFound(item),
			)}
		>
			<span class="tile-art">
				{image ? (
					<img src={image} alt="" loading="lazy" decoding="async" draggable={false} />
				) : (
					<span class="tile-missing">
						<span>?</span>
						<small>{item.error ? "não encontrada" : "sem imagem"}</small>
					</span>
				)}
				{item.quantity > 1 && <span class="qty-badge">×{item.quantity}</span>}
				{item.found && (
					<span class="found-mark">
						<CheckIcon size={28} />
					</span>
				)}
			</span>
			<span class="tile-name">{name}</span>
			{item.card && <span class="tile-price">{price ?? "sem preço"}</span>}
		</button>
	);
}
