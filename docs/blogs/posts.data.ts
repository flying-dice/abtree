import { createContentLoader } from "vitepress";

export interface Post {
	title: string;
	description: string;
	url: string;
}

declare const data: Post[];

export { data };

export default createContentLoader("blogs/*.md", {
	transform(raw): Post[] {
		return raw
			.filter(({ url }) => url !== "/blogs/" && url !== "/blogs")
			.map(({ url, frontmatter }) => ({
				title: frontmatter.title ?? url,
				description: frontmatter.description ?? "",
				url,
			}))
			.sort((a, b) => a.title.localeCompare(b.title));
	},
});
