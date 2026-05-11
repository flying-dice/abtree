import type { NodeModulesRef } from "./types.ts";

const SCHEME = "node-modules:";
const NPM_SEGMENT = /^[a-z0-9][a-z0-9._-]*$/;

export function parseNodeModulesRef(url: string): NodeModulesRef {
	if (!url.startsWith(SCHEME)) {
		throw new Error(`invalid module ref '${url}': expected '${SCHEME}' scheme`);
	}
	const body = url.slice(SCHEME.length);
	if (body.length === 0) {
		throw new Error(`invalid module ref '${url}': missing package name`);
	}

	const { pkgName, subPath } = splitPkgAndSubPath(url, body);
	validatePkgName(url, pkgName);
	return subPath ? { pkgName, subPath } : { pkgName };
}

function splitPkgAndSubPath(
	url: string,
	body: string,
): { pkgName: string; subPath?: string } {
	if (body.startsWith("@")) {
		const firstSlash = body.indexOf("/");
		if (firstSlash === -1 || firstSlash === body.length - 1) {
			throw new Error(
				`invalid module ref '${url}': scoped package missing the name half (expected @scope/name)`,
			);
		}
		const secondSlash = body.indexOf("/", firstSlash + 1);
		if (secondSlash === -1) {
			return { pkgName: body };
		}
		return {
			pkgName: body.slice(0, secondSlash),
			subPath: body.slice(secondSlash + 1),
		};
	}
	const firstSlash = body.indexOf("/");
	if (firstSlash === -1) return { pkgName: body };
	return {
		pkgName: body.slice(0, firstSlash),
		subPath: body.slice(firstSlash + 1),
	};
}

function validatePkgName(url: string, pkgName: string): void {
	const segments = pkgName.startsWith("@")
		? pkgName.slice(1).split("/")
		: [pkgName];
	for (const segment of segments) {
		if (!NPM_SEGMENT.test(segment)) {
			throw new Error(
				`invalid module ref '${url}': package name '${pkgName}' violates npm naming rules`,
			);
		}
	}
}
