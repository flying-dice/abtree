import { db } from "./db.ts";
import { flattenObject } from "./utils.ts";
import type { FlowRow, ScopeRow } from "./types.ts";

export const FlowRepo = {
  findById(id: string): FlowRow | null {
    return db.query<FlowRow, [string]>("SELECT * FROM flows WHERE id = ?").get(id) ?? null;
  },

  listAll(): Pick<FlowRow, "id" | "tree" | "summary" | "status" | "phase">[] {
    return db.query<Pick<FlowRow, "id" | "tree" | "summary" | "status" | "phase">, []>(
      "SELECT id, tree, summary, status, phase FROM flows ORDER BY created_at DESC"
    ).all();
  },

  listAllFull(): FlowRow[] {
    return db.query<FlowRow, []>("SELECT * FROM flows ORDER BY created_at DESC").all();
  },

  countByPrefix(prefix: string): number {
    const row = db.query<{ count: number }, [string]>(
      "SELECT COUNT(*) as count FROM flows WHERE id LIKE ? || '%'"
    ).get(prefix);
    return row?.count ?? 0;
  },

  create(flow: FlowRow): void {
    db.query(
      `INSERT INTO flows (id, tree, summary, status, snapshot, cursor, phase, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(flow.id, flow.tree, flow.summary, flow.status, flow.snapshot, flow.cursor, flow.phase, flow.created_at, flow.updated_at);
  },

  update(id: string, fields: Partial<Pick<FlowRow, "status" | "cursor" | "phase">>): void {
    const sets: string[] = [];
    const vals: string[] = [];
    if (fields.status !== undefined) { sets.push("status = ?"); vals.push(fields.status); }
    if (fields.cursor !== undefined) { sets.push("cursor = ?"); vals.push(fields.cursor); }
    if (fields.phase !== undefined) { sets.push("phase = ?"); vals.push(fields.phase); }
    if (sets.length === 0) return;
    sets.push("updated_at = ?");
    vals.push(new Date().toISOString());
    vals.push(id);
    db.query(`UPDATE flows SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  },
};

function createScopeRepo(tableName: "flow_local" | "flow_global") {
  return {
    getAll(flowId: string): Record<string, unknown> {
      const rows = db.query<ScopeRow, [string]>(
        `SELECT path, value FROM ${tableName} WHERE flow_id = ?`
      ).all(flowId);
      const result: Record<string, unknown> = {};
      for (const row of rows) result[row.path] = JSON.parse(row.value);
      return result;
    },

    getValue(flowId: string, path: string): unknown {
      const row = db.query<{ value: string }, [string, string]>(
        `SELECT value FROM ${tableName} WHERE flow_id = ? AND path = ?`
      ).get(flowId, path);
      return row ? JSON.parse(row.value) : null;
    },

    setValue(flowId: string, path: string, value: unknown): void {
      db.query(
        `INSERT OR REPLACE INTO ${tableName} (flow_id, path, value) VALUES (?, ?, ?)`
      ).run(flowId, path, JSON.stringify(value));
    },

    deleteAll(flowId: string): void {
      db.query(`DELETE FROM ${tableName} WHERE flow_id = ?`).run(flowId);
    },

    bulkSet(flowId: string, data: Record<string, unknown>): void {
      this.deleteAll(flowId);
      const ins = db.prepare(`INSERT INTO ${tableName} (flow_id, path, value) VALUES (?, ?, ?)`);
      for (const [path, value] of flattenObject(data)) {
        ins.run(flowId, path, JSON.stringify(value));
      }
    },
  };
}

export const LocalRepo = createScopeRepo("flow_local");
export const GlobalRepo = createScopeRepo("flow_global");
