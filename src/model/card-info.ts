import type { ScryfallCard } from "../scryfall/types";
import type { CardInfo } from "./types";

export function toCardInfo(card: ScryfallCard): CardInfo {
	const front = card.card_faces?.[0];
	// Cartas de duas faces "transform"/MDFC trazem imagens por face; split/adventure trazem uma imagem só.
	const facesWithImages = card.card_faces?.filter((f) => f.image_uris) ?? [];
	const faces =
		!card.image_uris && facesWithImages.length > 0
			? facesWithImages.map((f) => ({
					name: f.name ?? card.name,
					image: f.image_uris?.normal,
					small: f.image_uris?.small,
				}))
			: [{ name: card.name, image: card.image_uris?.normal, small: card.image_uris?.small }];

	return {
		id: card.id,
		name: card.name,
		colors: card.colors ?? front?.colors ?? [],
		typeLine: front?.type_line ?? card.type_line ?? "",
		set: card.set ?? "",
		setName: card.set_name,
		collectorNumber: card.collector_number ?? "",
		faces,
		printsUri: card.prints_search_uri,
	};
}

export function cardImages(card: CardInfo | undefined): string[] {
	return card?.faces.flatMap((f) => (f.image ? [f.image] : [])) ?? [];
}
