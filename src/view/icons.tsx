// Ícones em linha (24×24, traço), para não depender de fontes externas.
import type { ComponentChildren } from "preact";
type Props = { size?: number };

const svg = (path: ComponentChildren) =>
	function Icon({ size = 24 }: Props) {
		return (
			<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
				{path}
			</svg>
		);
	};

export const BackIcon = svg(<path d="M15 18l-6-6 6-6" />);
export const SearchIcon = svg(<><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>);
export const CloseIcon = svg(<path d="M18 6L6 18M6 6l12 12" />);
export const GridIcon = svg(<><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="9" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>);
export const ListIcon = svg(<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />);
export const MenuIcon = svg(<><circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" /></>);
export const CheckIcon = svg(<path d="M20 6L9 17l-5-5" />);
export const FlipIcon = svg(<><path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 014-4h14" /><path d="M7 23l-4-4 4-4" /><path d="M21 13v2a4 4 0 01-4 4H3" /></>);
export const ArtIcon = svg(<><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></>);
export const PlusIcon = svg(<path d="M12 5v14M5 12h14" />);
export const OfflineIcon = svg(<><path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M5 21h14" /></>);
export const SunIcon = svg(<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></>);
export const SunOffIcon = svg(<><circle cx="12" cy="12" r="4" /><path d="M3 3l18 18" /></>);
