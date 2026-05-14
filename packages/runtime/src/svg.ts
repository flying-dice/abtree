import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { EXECUTIONS_DIR, ensureDir } from "./paths.ts";
import { ExecutionStore } from "./repos.ts";
import { TreeSnapshotStore } from "./snapshots.ts";
import { getNodeResult } from "./tree.ts";
import type { NodeStatus, NormalizedNode } from "./types.ts";

// A single event in the walkthrough timeline. `status` semantics:
//   - "success" | "failure" | "running": fade the matching overlay in,
//     fade any other status overlay on the same node out.
//   - "pending": composite has been entered but its children haven't
//     resolved — shown as a pulsating amber pip until a later event
//     clears it (typically with status="success").
//   - "reset": fade every overlay on this node out (used between retries).
//   - undefined: just pulse the pink ring; don't touch status overlays.
export type WalkStatus = NodeStatus | "pending";

export interface WalkEvent {
	path: number[];
	atSec: number;
	status?: WalkStatus | "reset";
	ring?: boolean; // pink halo at this event (default true)
}

export interface WalkthroughScript {
	events: WalkEvent[];
	cycleSec: number;
}

export interface RenderTreeSvgOptions {
	title: string;
	getStatus?: (path: number[]) => NodeStatus | null | undefined;
	// Auto-DFS walkthrough — each node lit in declaration order. Ignored if
	// `walkthroughScript` is also supplied. Live-execution renders leave
	// both off and stay static.
	walkthrough?: boolean;
	// Custom walkthrough timeline — used for scripted demos (e.g. retries).
	walkthroughScript?: WalkthroughScript;
}

// Behaviour trees encode execution order in child ordering, so a
// "left to right" diagram is part of the meaning, not a cosmetic
// preference. This renderer commits to a deterministic layout:
//   - depth determines y (top → down)
//   - declaration order determines x (left → right) within each parent slot

const FONT_STACK =
	'"Inter","SF Pro Text",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif';

const LABEL_SIZE = 14;
const TYPE_SIZE = 10;
const TYPE_TRACKING = 1.2;
const LABEL_CHAR_W = 7.5;
const TYPE_CHAR_W = 6.5;

const PAD_LEFT = 22;
const PAD_RIGHT = 36;
const NODE_HEIGHT = 64;
const NODE_RADIUS = 12;
const ACCENT_W = 3;
const ACCENT_INSET = 10;

const H_GAP = 40;
const V_GAP = 84;
const MARGIN = 56;
const TITLE_HEIGHT = 64;

type NodeKind = "action" | "sequence" | "selector" | "parallel" | "ref";

interface Laid {
	label: string;
	sub: string;
	kind: NodeKind;
	status: NodeStatus | null;
	path: number[];
	width: number;
	subtreeWidth: number;
	x: number;
	y: number;
	children: Laid[];
}

const DRACULA = {
	bg: "#282a36",
	bgDeep: "#1e1f29",
	currentLine: "#44475a",
	comment: "#6272a4",
	fg: "#f8f8f2",
	cyan: "#8be9fd",
	green: "#50fa7b",
	orange: "#ffb86c",
	pink: "#ff79c6",
	purple: "#bd93f9",
	red: "#ff5555",
	yellow: "#f1fa8c",
} as const;

const TYPE_ACCENT: Record<NodeKind, string> = {
	action: DRACULA.cyan,
	sequence: DRACULA.green,
	selector: DRACULA.purple,
	parallel: DRACULA.orange,
	ref: DRACULA.pink,
};

const STATUS_COLOUR: Record<WalkStatus, string> = {
	success: DRACULA.green,
	failure: DRACULA.red,
	running: DRACULA.yellow,
	pending: DRACULA.orange,
};

function describe(node: NormalizedNode): {
	label: string;
	sub: string;
	kind: NodeKind;
} {
	if (node.type === "ref") {
		return { label: `→ ${node.ref}`, sub: "REFERENCE", kind: "ref" };
	}
	const label = node.name ? node.name.replace(/_/g, " ") : node.type;
	return { label, sub: node.type.toUpperCase(), kind: node.type };
}

function measure(label: string, sub: string): number {
	const labelW = label.length * LABEL_CHAR_W;
	const subW =
		sub.length * TYPE_CHAR_W + Math.max(0, sub.length - 1) * TYPE_TRACKING;
	return Math.ceil(Math.max(labelW, subW)) + PAD_LEFT + PAD_RIGHT;
}

function build(
	node: NormalizedNode,
	path: number[],
	getStatus: RenderTreeSvgOptions["getStatus"],
): Laid {
	const { label, sub, kind } = describe(node);
	const status = getStatus?.(path) ?? null;

	const children: Laid[] =
		node.type === "action" || node.type === "ref"
			? []
			: node.children.map((child, i) => build(child, [...path, i], getStatus));

	const childrenWidth = children.length
		? children.reduce((sum, c) => sum + c.subtreeWidth, 0) +
			(children.length - 1) * H_GAP
		: 0;

	const width = measure(label, sub);
	return {
		label,
		sub,
		kind,
		status,
		path,
		width,
		subtreeWidth: Math.max(width, childrenWidth),
		x: 0,
		y: 0,
		children,
	};
}

function position(node: Laid, slotLeft: number, depth: number): number {
	node.x = slotLeft + node.subtreeWidth / 2;
	node.y = MARGIN + TITLE_HEIGHT + depth * (NODE_HEIGHT + V_GAP);

	let maxDepth = depth;
	if (node.children.length > 0) {
		const childrenWidth =
			node.children.reduce((sum, c) => sum + c.subtreeWidth, 0) +
			(node.children.length - 1) * H_GAP;
		let cursor = node.x - childrenWidth / 2;
		for (const child of node.children) {
			const d = position(child, cursor, depth + 1);
			if (d > maxDepth) maxDepth = d;
			cursor += child.subtreeWidth + H_GAP;
		}
	}
	return maxDepth;
}

function findByPath(root: Laid, path: number[]): Laid | null {
	let cur: Laid | null = root;
	for (const i of path) {
		if (!cur || i >= cur.children.length) return null;
		cur = cur.children[i];
	}
	return cur;
}

function allNodes(root: Laid, out: Laid[] = []): Laid[] {
	out.push(root);
	for (const c of root.children) allNodes(c, out);
	return out;
}

function escapeXml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function edgePath(from: Laid, to: Laid): string {
	const px = from.x;
	const py = from.y + NODE_HEIGHT;
	const cx = to.x;
	const cy = to.y;
	const midY = py + (cy - py) / 2;
	const d = `M ${px} ${py} C ${px} ${midY}, ${cx} ${midY}, ${cx} ${cy}`;
	const dashed = to.kind === "ref";
	const stroke = dashed ? "rgba(255,121,198,0.45)" : "rgba(98,114,164,0.45)";
	const dash = dashed ? ` stroke-dasharray="5 6"` : "";
	return `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round"${dash} />`;
}

function statusPipBody(node: Laid, status: WalkStatus): string {
	const cx = node.x + node.width / 2 - 16;
	const cy = node.y + 16;
	const colour = STATUS_COLOUR[status];
	if (status === "running" || status === "pending") {
		return [
			`<circle cx="${cx}" cy="${cy}" r="9" fill="${colour}" opacity="0.18">`,
			`<animate attributeName="r" values="6;11;6" dur="1.6s" repeatCount="indefinite" />`,
			`<animate attributeName="opacity" values="0.35;0;0.35" dur="1.6s" repeatCount="indefinite" />`,
			`</circle>`,
			`<circle cx="${cx}" cy="${cy}" r="5" fill="${colour}" />`,
		].join("");
	}
	const glyph = DRACULA.bgDeep;
	if (status === "success") {
		return [
			`<circle cx="${cx}" cy="${cy}" r="6" fill="${colour}" />`,
			`<path d="M ${cx - 2.6} ${cy + 0.2} L ${cx - 0.6} ${cy + 2.4} L ${cx + 2.8} ${cy - 2.2}" stroke="${glyph}" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round" />`,
		].join("");
	}
	return [
		`<circle cx="${cx}" cy="${cy}" r="6" fill="${colour}" />`,
		`<path d="M ${cx - 2.4} ${cy - 2.4} L ${cx + 2.4} ${cy + 2.4} M ${cx - 2.4} ${cy + 2.4} L ${cx + 2.4} ${cy - 2.4}" stroke="${glyph}" stroke-width="1.6" stroke-linecap="round" />`,
	].join("");
}

// Static card — the body and label. Status border + pip are rendered as
// separate overlays so the walkthrough timeline can animate them.
function cardSvg(node: Laid): string {
	const x = node.x - node.width / 2;
	const y = node.y;
	const w = node.width;
	const h = NODE_HEIGHT;

	const neutralStroke = "rgba(98,114,164,0.32)";
	const baseStroke = node.status ? STATUS_COLOUR[node.status] : neutralStroke;
	const baseStrokeWidth = node.status ? 1.4 : 1;
	const filter = node.status === "running" ? "url(#glow)" : "url(#shadow)";

	const parts: string[] = [];
	parts.push(`<g filter="${filter}">`);
	parts.push(
		`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${NODE_RADIUS}" fill="${DRACULA.bg}" />`,
	);
	parts.push(
		`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${NODE_RADIUS}" fill="url(#card-sheen)" opacity="0.55" />`,
	);
	parts.push(
		`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${NODE_RADIUS}" fill="none" stroke="${baseStroke}" stroke-width="${baseStrokeWidth}" />`,
	);
	parts.push(
		`<rect x="${x + ACCENT_INSET}" y="${y + 14}" width="${ACCENT_W}" height="${h - 28}" rx="${ACCENT_W / 2}" fill="${TYPE_ACCENT[node.kind]}" />`,
	);
	const labelX = x + PAD_LEFT;
	parts.push(
		`<text x="${labelX}" y="${y + 27}" font-size="${LABEL_SIZE}" font-weight="600" fill="${DRACULA.fg}" letter-spacing="-0.1">${escapeXml(node.label)}</text>`,
	);
	parts.push(
		`<text x="${labelX}" y="${y + 47}" font-size="${TYPE_SIZE}" font-weight="600" fill="${DRACULA.comment}" letter-spacing="${TYPE_TRACKING}">${escapeXml(node.sub)}</text>`,
	);
	if (node.status) parts.push(statusPipBody(node, node.status));
	parts.push(`</g>`);
	return parts.join("");
}

function emit(node: Laid, edges: string[], cards: string[]): void {
	for (const child of node.children) {
		edges.push(edgePath(node, child));
		emit(child, edges, cards);
	}
	cards.push(cardSvg(node));
}

function defs(): string {
	return [
		`<defs>`,
		`<linearGradient id="card-sheen" x1="0" y1="0" x2="0" y2="1">`,
		`<stop offset="0" stop-color="${DRACULA.currentLine}" stop-opacity="0.55" />`,
		`<stop offset="1" stop-color="${DRACULA.bg}" stop-opacity="0" />`,
		`</linearGradient>`,
		`<filter id="shadow" x="-20%" y="-20%" width="140%" height="160%">`,
		`<feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#000000" flood-opacity="0.45" />`,
		`</filter>`,
		`<filter id="glow" x="-50%" y="-50%" width="200%" height="200%">`,
		`<feDropShadow dx="0" dy="0" stdDeviation="6" flood-color="${DRACULA.yellow}" flood-opacity="0.55" />`,
		`<feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#000000" flood-opacity="0.45" />`,
		`</filter>`,
		`<filter id="ring-glow" x="-30%" y="-30%" width="160%" height="160%">`,
		`<feDropShadow dx="0" dy="0" stdDeviation="8" flood-color="${DRACULA.pink}" flood-opacity="0.9" />`,
		`<feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="${DRACULA.pink}" flood-opacity="0.9" />`,
		`</filter>`,
		`</defs>`,
	].join("");
}

// Auto walkthrough script: each node lit once in DFS pre-order. Used when
// the caller sets `walkthrough: true` without supplying their own script.
function autoScript(laid: Laid): WalkthroughScript {
	const flat = allNodes(laid);
	const stepSec = 0.7;
	const holdSec = 1.6;
	const cycleSec = flat.length * stepSec + holdSec;
	const events: WalkEvent[] = flat.map((n, i) => ({
		path: n.path,
		atSec: i * stepSec + stepSec * 0.25,
		status: n.status ?? undefined,
		ring: true,
	}));
	return { events, cycleSec };
}

function fmt(n: number): string {
	return Math.max(0, Math.min(1, n)).toFixed(4);
}

// Collapse a list of {at, target ∈ {0,1}} transitions into a SMIL
// keyTimes/values pair. Each transition introduces a fade with `fadeSec`
// duration. The animation always begins at 0 and snaps back to 0 at the
// end of the cycle so the next loop starts clean.
function buildTimeline(
	transitions: Array<{ at: number; target: number }>,
	cycleSec: number,
	fadeSec: number,
): { keyTimes: string; values: string } | null {
	if (transitions.length === 0) return null;
	const kts: number[] = [0];
	const vals: number[] = [0];
	let last = 0;
	for (const t of transitions) {
		const start = t.at / cycleSec;
		const end = Math.min((t.at + fadeSec) / cycleSec, 0.99);
		kts.push(start);
		vals.push(last);
		kts.push(end);
		vals.push(t.target);
		last = t.target;
	}
	kts.push(0.995);
	vals.push(last);
	kts.push(1);
	vals.push(0);
	return { keyTimes: kts.map(fmt).join(";"), values: vals.join(";") };
}

function ringRect(node: Laid, atSec: number, cycleSec: number): string {
	const inset = 8;
	const x = node.x - node.width / 2 - inset;
	const y = node.y - inset;
	const w = node.width + inset * 2;
	const h = NODE_HEIGHT + inset * 2;
	const half = 0.35;
	const tStart = Math.max(0, atSec - half);
	const tPeak = atSec;
	const tEnd = Math.min(cycleSec, atSec + half);
	const kt = `0;${fmt(tStart / cycleSec)};${fmt(tPeak / cycleSec)};${fmt(tEnd / cycleSec)};1`;
	return (
		`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${NODE_RADIUS + inset}" fill="none" stroke="${DRACULA.pink}" stroke-width="3" opacity="0" filter="url(#ring-glow)">` +
		`<animate attributeName="opacity" values="0;0;1;0;0" keyTimes="${kt}" dur="${cycleSec.toFixed(2)}s" repeatCount="indefinite" />` +
		`</rect>`
	);
}

function statusOverlay(
	node: Laid,
	status: WalkStatus,
	keyTimes: string,
	values: string,
	cycleSec: number,
): string {
	const x = node.x - node.width / 2;
	const y = node.y;
	const w = node.width;
	const h = NODE_HEIGHT;
	const colour = STATUS_COLOUR[status];
	const dur = cycleSec.toFixed(2);
	const anim = `<animate attributeName="opacity" values="${values}" keyTimes="${keyTimes}" dur="${dur}s" repeatCount="indefinite" />`;
	const border = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${NODE_RADIUS}" fill="none" stroke="${colour}" stroke-width="1.4" opacity="0">${anim}</rect>`;
	const pip = `<g opacity="0">${statusPipBody(node, status)}${anim}</g>`;
	return border + pip;
}

// Compile a script into the SVG fragment for pink rings + status overlays.
// Cards themselves render in neutral state (see renderTreeSvg below).
function compileScript(
	laid: Laid,
	script: WalkthroughScript,
): { rings: string; overlays: string } {
	const fadeSec = 0.25;
	const byNode = new Map<Laid, WalkEvent[]>();
	for (const ev of script.events) {
		const n = findByPath(laid, ev.path);
		if (!n) continue;
		const existing = byNode.get(n);
		if (existing) {
			existing.push(ev);
		} else {
			byNode.set(n, [ev]);
		}
	}

	const ringParts: string[] = [];
	const overlayParts: string[] = [];

	for (const [node, evs] of byNode) {
		evs.sort((a, b) => a.atSec - b.atSec);

		for (const ev of evs) {
			if (ev.ring !== false)
				ringParts.push(ringRect(node, ev.atSec, script.cycleSec));
		}

		// Determine which status colours need their own overlay timeline.
		const statuses = new Set<WalkStatus>();
		for (const ev of evs) {
			if (ev.status && ev.status !== "reset") statuses.add(ev.status);
		}

		for (const status of statuses) {
			const transitions: Array<{ at: number; target: number }> = [];
			let last = 0;
			for (const ev of evs) {
				if (!ev.status) continue;
				const target = ev.status === status ? 1 : 0;
				if (target !== last) {
					transitions.push({ at: ev.atSec, target });
					last = target;
				}
			}
			const tl = buildTimeline(transitions, script.cycleSec, fadeSec);
			if (!tl) continue;
			overlayParts.push(
				statusOverlay(node, status, tl.keyTimes, tl.values, script.cycleSec),
			);
		}
	}

	return { rings: ringParts.join(""), overlays: overlayParts.join("") };
}

export function renderTreeSvg(
	root: NormalizedNode,
	opts: RenderTreeSvgOptions,
): string {
	const laid = build(root, [], opts.getStatus);
	const maxDepth = position(laid, MARGIN, 0);

	const width = laid.subtreeWidth + MARGIN * 2;
	const levels = maxDepth + 1;
	const height =
		MARGIN * 2 + TITLE_HEIGHT + levels * NODE_HEIGHT + (levels - 1) * V_GAP;

	const script: WalkthroughScript | null = opts.walkthroughScript
		? opts.walkthroughScript
		: opts.walkthrough
			? autoScript(laid)
			: null;

	// When the walkthrough is driving the diagram, status comes from the
	// timeline (overlays) — so the underlying cards render in neutral state
	// and "reveal" by overlay fade-in. Without that wipe, cards would show
	// their final status from the first frame.
	if (script) {
		for (const n of allNodes(laid)) n.status = null;
	}

	const edges: string[] = [];
	const cards: string[] = [];
	emit(laid, edges, cards);

	let rings = "";
	let overlays = "";
	if (script) {
		const compiled = compileScript(laid, script);
		rings = compiled.rings;
		overlays = compiled.overlays;
	}

	const titleY = MARGIN + 24;
	const subtitleY = titleY + 22;

	return [
		`<?xml version="1.0" encoding="UTF-8"?>`,
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" font-family='${FONT_STACK}'>`,
		defs(),
		`<text x="${MARGIN}" y="${titleY}" font-size="20" font-weight="700" fill="${DRACULA.fg}" letter-spacing="-0.4">${escapeXml(opts.title)}</text>`,
		`<text x="${MARGIN}" y="${subtitleY}" font-size="11" font-weight="600" fill="${DRACULA.pink}" letter-spacing="1.4">BEHAVIOUR TREE</text>`,
		...edges,
		...cards,
		rings,
		overlays,
		`</svg>`,
		"",
	].join("\n");
}

export function rebuildSvg(executionId: string): void {
	try {
		const execution = ExecutionStore.findById(executionId);
		if (!execution) return;
		const tree = TreeSnapshotStore.get(execution.snapshot);

		const out = renderTreeSvg(tree.root, {
			title: `${execution.summary} (${execution.status})`,
			getStatus: (path) => getNodeResult(executionId, path),
		});

		ensureDir(EXECUTIONS_DIR);
		writeFileSync(join(EXECUTIONS_DIR, `${executionId}.svg`), out);
	} catch (e) {
		console.error("rebuildSvg failed:", e);
	}
}
