import type { ErrorData } from "./api.ts";

export interface BadRequestData {
	data: unknown;
	error: unknown[];
	success: boolean;
}

export class BadRequestError extends Error {
	readonly status = 400 as const;
	constructor(public readonly data: BadRequestData) {
		super("Bad Request");
		this.name = "BadRequestError";
	}
}

export class ServerError extends Error {
	constructor(
		public readonly data: ErrorData,
		public readonly status: number,
	) {
		super(data.message ?? "Server Error");
		this.name = "ServerError";
	}
}

const readBody = async <T>(res: Response): Promise<T> => {
	const ct = res.headers.get("content-type");
	if ([204, 205, 304].includes(res.status)) return undefined as T;
	if (ct?.includes("application/json")) return res.json() as Promise<T>;
	return res.text() as unknown as Promise<T>;
};

/**
 * Orval custom mutator. Plain JSON, no auth — this app is local-only.
 * Errors are surfaced as typed exceptions so SWR's `error` slot is
 * actually usable.
 */
export const customFetch = async <T>(
	url: string,
	options?: RequestInit,
): Promise<T> => {
	const res = await fetch(url, options);
	const body = await readBody<unknown>(res);

	if (res.status === 400) throw new BadRequestError(body as BadRequestData);
	if (!res.ok) throw new ServerError(body as ErrorData, res.status);

	return {
		data: body,
		status: res.status,
		headers: res.headers,
	} as T;
};
