import { colorGroup, displayName, type Group } from "../lib/grouping";
import type { ListItem } from "../model/types";
import { CheckIcon } from "./icons";

interface Props {
	groups: Group[];
	showHeaders: boolean;
	onOpen: (item: ListItem) => void;
	onToggleFound: (item: ListItem) => void;
}

export function NameList({ groups, showHeaders, onOpen, onToggleFound }: Props) {
	return (
		<>
			{groups.map((group) => (
				<section key={group.key} class="group">
					{showHeaders && (
						<h2 class={`group-header color-${group.key}`}>
							{group.label} <span class="group-count">{group.items.length}</span>
						</h2>
					)}
					<ul class="names">
						{group.items.map((item) => (
							<li key={item.key} class={`name-row${item.found ? " is-found" : ""}`}>
								<button
									type="button"
									class="name-check"
									role="checkbox"
									aria-checked={item.found}
									aria-label={`Marcar ${displayName(item)} como encontrada`}
									onClick={() => onToggleFound(item)}
								>
									{item.found && <CheckIcon size={18} />}
								</button>
								<button type="button" class="name-main" onClick={() => onOpen(item)}>
									<span class={`pip color-${colorGroup(item.card)}`} aria-hidden="true" />
									<span class="name-text">{displayName(item)}</span>
									{item.quantity > 1 && <span class="name-qty">×{item.quantity}</span>}
								</button>
							</li>
						))}
					</ul>
				</section>
			))}
		</>
	);
}
