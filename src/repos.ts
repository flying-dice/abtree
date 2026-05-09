import { join } from "node:path";
import { existsSync, readFileSync, readdirSync, writeFileSync, renameSync, unlinkSync } from "node:fs";
import { FLOWS_DIR, ensureDir } from "./paths.ts";
import type { FlowRow, FlowDoc } from "./types.ts";

const ID_PATTERN = /^[a-z0-9_-]+__[a-z0-9_-]+__\d+$/;

function flowPath(id: string): string {
  if (!ID_PATTERN.test(id)) throw new Error(`Invalid flow id: ${id}`);
  return join(FLOWS_DIR, `${id}.json`);
}

function readDoc(id: string): FlowDoc | null {
  const path = flowPath(id);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch (e) {
    throw new Error(`Corrupt flow file: ${id}`);
  }
}

function writeDoc(doc: FlowDoc): void {
  ensureDir(FLOWS_DIR);
  const path = flowPath(doc.id);
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(doc, null, 2));
  renameSync(tmp, path);
}

function walkPath(obj: Record<string, unknown>, path: string): unknown {
  if (!path) throw new Error("Path required");
  const segs = path.split(".");
  let cur: any = obj;
  for (const seg of segs) {
    if (cur === null || typeof cur !== "object") return null;
    cur = cur[seg];
  }
  return cur ?? null;
}

function setPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  if (!path) throw new Error("Path required");
  const segs = path.split(".");
  let cur: any = obj;
  for (let i = 0; i < segs.length - 1; i++) {
    const seg = segs[i]!;
    if (cur[seg] === null || typeof cur[seg] !== "object") cur[seg] = {};
    cur = cur[seg];
  }
  cur[segs[segs.length - 1]!] = value;
}

function mutateScope(id: string, scope: "local" | "global", fn: (s: Record<string, unknown>) => void): void {
  const doc = readDoc(id);
  if (!doc) throw new Error(`Flow not found: ${id}`);
  fn(doc[scope]);
  doc.updated_at = new Date().toISOString();
  writeDoc(doc);
}

export const FlowStore = {
  findById(id: string): FlowDoc | null {
    return readDoc(id);
  },

  list(): FlowDoc[] {
    if (!existsSync(FLOWS_DIR)) return [];
    const docs: FlowDoc[] = [];
    for (const name of readdirSync(FLOWS_DIR)) {
      if (!name.endsWith(".json")) continue;
      try {
        docs.push(JSON.parse(readFileSync(join(FLOWS_DIR, name), "utf-8")));
      } catch {
        // skip corrupt files in list view
      }
    }
    docs.sort((a, b) => a.created_at.localeCompare(b.created_at));
    return docs;
  },

  countByPrefix(prefix: string): number {
    return FlowStore.list().filter(d => d.id.startsWith(prefix)).length;
  },

  create(flow: FlowRow): FlowDoc {
    const doc: FlowDoc = { ...flow, local: {}, global: {} };
    writeDoc(doc);
    return doc;
  },

  update(id: string, fields: Partial<Pick<FlowRow, "status" | "cursor" | "phase">>): void {
    const doc = readDoc(id);
    if (!doc) throw new Error(`Flow not found: ${id}`);
    if (fields.status !== undefined) doc.status = fields.status;
    if (fields.cursor !== undefined) doc.cursor = fields.cursor;
    if (fields.phase !== undefined) doc.phase = fields.phase;
    doc.updated_at = new Date().toISOString();
    writeDoc(doc);
  },

  delete(id: string): void {
    const path = flowPath(id);
    if (existsSync(path)) unlinkSync(path);
  },

  // Scope helpers
  getLocal(id: string, path?: string): unknown {
    const doc = readDoc(id);
    if (!doc) return null;
    return path ? walkPath(doc.local, path) : doc.local;
  },

  setLocal(id: string, path: string, value: unknown): void {
    mutateScope(id, "local", s => setPath(s, path, value));
  },

  replaceLocal(id: string, data: Record<string, unknown>): void {
    mutateScope(id, "local", s => {
      for (const k of Object.keys(s)) delete s[k];
      Object.assign(s, data);
    });
  },

  deleteLocal(id: string): void {
    mutateScope(id, "local", s => {
      for (const k of Object.keys(s)) delete s[k];
    });
  },

  getGlobal(id: string, path?: string): unknown {
    const doc = readDoc(id);
    if (!doc) return null;
    return path ? walkPath(doc.global, path) : doc.global;
  },

  setGlobal(id: string, path: string, value: unknown): void {
    mutateScope(id, "global", s => setPath(s, path, value));
  },

  replaceGlobal(id: string, data: Record<string, unknown>): void {
    mutateScope(id, "global", s => {
      for (const k of Object.keys(s)) delete s[k];
      Object.assign(s, data);
    });
  },

  deleteGlobal(id: string): void {
    mutateScope(id, "global", s => {
      for (const k of Object.keys(s)) delete s[k];
    });
  },
};
