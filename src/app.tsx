import { useEffect, useState } from "preact/hooks";
import { HomeScreen } from "./view/HomeScreen";
import { ImportScreen } from "./view/ImportScreen";
import { ListScreen } from "./view/ListScreen";

export type Route = { name: "home" } | { name: "new" } | { name: "edit"; id: string } | { name: "list"; id: string };

function parseHash(hash: string): Route {
	const [, name, id] = hash.replace(/^#/, "").split("/");
	if (name === "new") return { name: "new" };
	if (name === "edit" && id) return { name: "edit", id: decodeURIComponent(id) };
	if (name === "list" && id) return { name: "list", id: decodeURIComponent(id) };
	return { name: "home" };
}

export function navigate(path: string, replace = false): void {
	const hash = `#${path}`;
	if (replace) {
		history.replaceState(null, "", hash);
		window.dispatchEvent(new HashChangeEvent("hashchange"));
	} else {
		location.hash = hash;
	}
}

export function App() {
	const [route, setRoute] = useState<Route>(() => parseHash(location.hash));

	useEffect(() => {
		const onHash = () => setRoute(parseHash(location.hash));
		window.addEventListener("hashchange", onHash);
		return () => window.removeEventListener("hashchange", onHash);
	}, []);

	switch (route.name) {
		case "new":
			return <ImportScreen />;
		case "edit":
			return <ImportScreen key={route.id} listId={route.id} />;
		case "list":
			return <ListScreen key={route.id} listId={route.id} />;
		default:
			return <HomeScreen />;
	}
}
