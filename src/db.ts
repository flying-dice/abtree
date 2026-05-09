import { Database } from "bun:sqlite";
import { resolve, join } from "node:path";
import { existsSync, mkdirSync } from "node:fs";

export const ABT_DIR = resolve(process.cwd(), ".abt");
export const TREES_DIR = join(ABT_DIR, "trees");
export const FLOWS_DIR = join(ABT_DIR, "flows");
export const DB_PATH = join(ABT_DIR, "abt.db");

export function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

const migrations: Array<{ version: number; up: string }> = [
  {
    version: 1,
    up: `
      CREATE TABLE IF NOT EXISTS flows (
        id TEXT PRIMARY KEY,
        tree TEXT NOT NULL,
        summary TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'running',
        snapshot TEXT NOT NULL,
        cursor TEXT NOT NULL DEFAULT '[]',
        phase TEXT NOT NULL DEFAULT 'idle',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS flow_local (
        flow_id TEXT NOT NULL,
        path TEXT NOT NULL,
        value TEXT NOT NULL,
        PRIMARY KEY (flow_id, path),
        FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS flow_global (
        flow_id TEXT NOT NULL,
        path TEXT NOT NULL,
        value TEXT NOT NULL,
        PRIMARY KEY (flow_id, path),
        FOREIGN KEY (flow_id) REFERENCES flows(id) ON DELETE CASCADE
      );
    `,
  },
];

function runMigrations(db: Database) {
  db.run(`CREATE TABLE IF NOT EXISTS _migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)`);
  const applied = new Set(
    db.query<{ version: number }, []>("SELECT version FROM _migrations").all().map(r => r.version)
  );
  for (const m of migrations) {
    if (applied.has(m.version)) continue;
    db.run("BEGIN");
    try {
      for (const stmt of m.up.split(";").map(s => s.trim()).filter(Boolean)) {
        db.run(stmt);
      }
      db.run("INSERT INTO _migrations (version, applied_at) VALUES (?, ?)", [m.version, new Date().toISOString()]);
      db.run("COMMIT");
    } catch (e) {
      db.run("ROLLBACK");
      throw e;
    }
  }
}

export let db: Database;

export function initDb() {
  ensureDir(ABT_DIR);
  db = new Database(DB_PATH);
  db.run("PRAGMA journal_mode = WAL");
  db.run("PRAGMA foreign_keys = ON");
  runMigrations(db);
}
