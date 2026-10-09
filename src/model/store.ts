import { createStore, del, get, set, values } from "idb-keyval";
import type { CardList } from "./types";

const store = createStore("find-my-card", "lists");

export async function getAllLists(): Promise<CardList[]> {
	const lists = await values<CardList>(store);
	return lists.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getList(id: string): Promise<CardList | undefined> {
	return get<CardList>(id, store);
}

export async function saveList(list: CardList): Promise<CardList> {
	const saved = { ...list, updatedAt: Date.now() };
	await set(list.id, saved, store);
	return saved;
}

export function deleteList(id: string): Promise<void> {
	return del(id, store);
}

export function newListId(): string {
	return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
