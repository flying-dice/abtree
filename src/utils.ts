export function flattenObject(
	obj: Record<string, unknown>,
	prefix = "",
): Array<[string, unknown]> {
	const entries: Array<[string, unknown]> = [];
	for (const [k, v] of Object.entries(obj)) {
		const path = prefix ? `${prefix}.${k}` : k;
		if (v && typeof v === "object" && !Array.isArray(v)) {
			entries.push(...flattenObject(v as Record<string, unknown>, path));
		} else {
			entries.push([path, v]);
		}
	}
	return entries;
}

export function out(data: unknown) {
	console.log(JSON.stringify(data, null, 2));
}

export function die(msg: string): never {
	console.error(`error: ${msg}`);
	process.exit(1);
}
