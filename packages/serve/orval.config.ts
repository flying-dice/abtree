import { defineConfig } from "orval";

export default defineConfig({
	"abtree-serve": {
		output: {
			target: "src/client/api.ts",
			client: "swr",
			override: {
				mutator: {
					path: "src/client/fetcher.ts",
					name: "customFetch",
				},
			},
		},
		input: {
			target: "openapi.json",
		},
	},
});
