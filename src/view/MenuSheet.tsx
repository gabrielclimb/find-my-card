import { useEffect, useState } from "preact/hooks";
import { RARITY_FILTERS, type SortMode } from "../lib/grouping";
import { offlineSupported, storageEstimate } from "../lib/offline";
import { MAX_COLUMNS, MIN_COLUMNS, type ViewMode, type ViewPrefs } from "../lib/prefs";
import type { WakeLockState } from "../lib/wake-lock";
import { CopyIcon, ShareIcon } from "./icons";
import type { CardList, Currency, Rarity } from "../model/types";

export interface OfflineStatus {
	busy: boolean;
	done: number;
	total: number;
	failed: number;
}

interface Props {
	list: CardList;
	prefs: ViewPrefs;
	wake: WakeLockState;
	offline: OfflineStatus;
	onPrefs: (patch: Partial<ViewPrefs>) => void;
	onRename: (name: string) => void;
	onToggleOffline: (on: boolean) => void;
	onEdit: () => void;
	onResetFound: () => void;
	onShareLink: () => void;
	onCopyText: () => void;
	onDelete: () => void;
	onClose: () => void;
}

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
	{ value: "color-name", label: "Cor" },
	{ value: "rarity-name", label: "Raridade" },
	{ value: "name", label: "Nome" },
];

const CURRENCY_OPTIONS: { value: Currency; label: string }[] = [
	{ value: "usd", label: "US$ (TCGplayer)" },
	{ value: "eur", label: "€ (Cardmarket)" },
];

const VIEW_OPTIONS: { value: ViewMode; label: string }[] = [
	{ value: "images", label: "Imagens" },
	{ value: "names", label: "Nomes" },
];

function formatMB(bytes: number): string {
	return `${(bytes / 1024 / 1024).toFixed(bytes > 100 * 1024 * 1024 ? 0 : 1)} MB`;
}

export function MenuSheet(props: Props) {
	const { list, prefs, wake, offline, onPrefs, onClose } = props;
	const [name, setName] = useState(list.name);
	const [usage, setUsage] = useState<string | null>(null);

	useEffect(() => {
		if (offline.busy) return;
		void storageEstimate().then((est) => setUsage(est ? formatMB(est.usage) : null));
	}, [offline.busy, list.offline]);

	const commitName = () => {
		const trimmed = name.trim();
		if (trimmed && trimmed !== list.name) props.onRename(trimmed);
		else setName(list.name);
	};

	return (
		<div class="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
			<div class="sheet" role="dialog" aria-modal="true" aria-label="Opções da lista">
				<div class="sheet-handle" aria-hidden="true" />

				<label class="field">
					<span>Nome da lista</span>
					<input type="text" value={name} onInput={(e) => setName(e.currentTarget.value)} onBlur={commitName} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} />
				</label>

				<div class="field">
					<span>Visualização</span>
					<Segmented options={VIEW_OPTIONS} value={prefs.view} onChange={(view) => onPrefs({ view })} />
				</div>

				<div class="field">
					<span>Organizar por</span>
					<Segmented options={SORT_OPTIONS} value={prefs.sort} onChange={(sort) => onPrefs({ sort })} />
				</div>

				<div class="field">
					<span>Filtrar por raridade{prefs.rarities.length === 0 ? " · todas" : ""}</span>
					<RarityChips value={prefs.rarities} onChange={(rarities) => onPrefs({ rarities })} />
				</div>

				<div class="field">
					<span>Preço</span>
					<Segmented options={CURRENCY_OPTIONS} value={prefs.currency} onChange={(currency) => onPrefs({ currency })} />
				</div>

				<label class="field">
					<span>
						Tamanho da grade · {prefs.columns} por linha
					</span>
					<input
						type="range"
						min={MIN_COLUMNS}
						max={MAX_COLUMNS}
						step={1}
						value={MAX_COLUMNS + MIN_COLUMNS - prefs.columns}
						aria-label="Tamanho das imagens"
						onInput={(e) => onPrefs({ columns: MAX_COLUMNS + MIN_COLUMNS - Number(e.currentTarget.value) })}
					/>
					<span class="range-labels">
						<small>menores</small>
						<small>maiores</small>
					</span>
				</label>

				<Toggle label="Ocultar encontradas" checked={prefs.hideFound} onChange={(hideFound) => onPrefs({ hideFound })} />

				<Toggle
					label="Manter tela acesa"
					hint={
						wake === "unsupported"
							? "Este navegador não permite manter a tela acesa."
							: wake === "active"
								? "Ativo agora."
								: prefs.keepAwake
									? "Será reativado ao voltar para o app."
									: undefined
					}
					checked={prefs.keepAwake && wake !== "unsupported"}
					disabled={wake === "unsupported"}
					onChange={(keepAwake) => onPrefs({ keepAwake })}
				/>

				<Toggle
					label="Disponível offline"
					hint={
						!offlineSupported()
							? "Este navegador não suporta armazenamento offline."
							: offline.busy
								? `Baixando imagens… ${offline.done}/${offline.total}`
								: list.offline
									? `Imagens salvas no aparelho${offline.failed ? ` (${offline.failed} falharam; reabra a lista para tentar de novo)` : ""}${usage ? ` · ${usage} usados pelo app` : ""}.`
									: "Baixa as imagens desta lista para consultar sem internet."
					}
					checked={list.offline}
					disabled={!offlineSupported() || offline.busy}
					onChange={props.onToggleOffline}
				/>
				{offline.busy && <progress class="progress" value={offline.done} max={Math.max(1, offline.total)} />}

				<div class="sheet-actions">
					<div class="sheet-actions-row">
						<button class="btn btn-secondary" onClick={props.onShareLink}>
							<ShareIcon size={18} /> Compartilhar link
						</button>
						<button class="btn btn-secondary" onClick={props.onCopyText}>
							<CopyIcon size={18} /> Copiar texto
						</button>
					</div>
					<button class="btn btn-secondary" onClick={props.onEdit}>
						Editar / reimportar
					</button>
					<button class="btn btn-secondary" onClick={props.onResetFound}>
						Desmarcar todas
					</button>
					<button class="btn btn-danger" onClick={props.onDelete}>
						Excluir lista
					</button>
				</div>
			</div>
		</div>
	);
}

function Segmented<T extends string>({
	options,
	value,
	onChange,
}: {
	options: { value: T; label: string }[];
	value: T;
	onChange: (value: T) => void;
}) {
	return (
		<div class="segmented" role="radiogroup">
			{options.map((o) => (
				<button
					key={o.value}
					type="button"
					role="radio"
					aria-checked={o.value === value}
					class={o.value === value ? "is-active" : ""}
					onClick={() => onChange(o.value)}
				>
					{o.label}
				</button>
			))}
		</div>
	);
}

function RarityChips({ value, onChange }: { value: Rarity[]; onChange: (value: Rarity[]) => void }) {
	return (
		<div class="chips" role="group" aria-label="Raridades">
			{RARITY_FILTERS.map((r) => {
				const on = value.includes(r.value);
				return (
					<button
						key={r.value}
						type="button"
						class={`chip rarity-${r.value}${on ? " is-active" : ""}`}
						aria-pressed={on}
						onClick={() => onChange(on ? value.filter((v) => v !== r.value) : [...value, r.value])}
					>
						{r.label}
					</button>
				);
			})}
		</div>
	);
}

function Toggle({
	label,
	hint,
	checked,
	disabled,
	onChange,
}: {
	label: string;
	hint?: string;
	checked: boolean;
	disabled?: boolean;
	onChange: (checked: boolean) => void;
}) {
	return (
		<label class={`toggle${disabled ? " is-disabled" : ""}`}>
			<span class="toggle-text">
				<span>{label}</span>
				{hint && <small>{hint}</small>}
			</span>
			<input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.currentTarget.checked)} />
		</label>
	);
}
