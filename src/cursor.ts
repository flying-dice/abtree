// The cursor is the small piece of state cmdNext / cmdEval / cmdSubmit
// share to remember "we last emitted this evaluate/instruct, so when the
// agent calls back, replay or advance from here". It's persisted as a
// string in `doc.cursor` so the JSON file format stays simple. The
// encode/decode helpers below are the one place that owns that format —
// callers should never JSON.stringify({path,step}) by hand.

export type Cursor = { path: number[]; step: number } | null;

const NULL_ENCODED = "null";
const EMPTY_ENCODED = "[]";

export function encodeCursor(cursor: Cursor): string {
	if (cursor === null) return NULL_ENCODED;
	return JSON.stringify({ path: cursor.path, step: cursor.step });
}

export function decodeCursor(encoded: string): Cursor {
	const parsed = JSON.parse(encoded);
	if (parsed === null || Array.isArray(parsed)) return null;
	return { path: parsed.path, step: parsed.step };
}

// Sentinel emitted at execution-create time, before any tick has run.
// Distinct from `null` to keep the original "[]" semantics for callers
// that grep the file format.
export const INITIAL_CURSOR = EMPTY_ENCODED;
export const NULL_CURSOR = NULL_ENCODED;
