declare module "*.md" {
	const content: string;
	export default content;
}

// JSON files imported with `with { type: "text" }` come through as a raw
// string, not the parsed JSON object the default JSON module type implies.
declare module "*.json" {
	const content: string;
	export default content;
}
