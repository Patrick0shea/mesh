import Database from "better-sqlite3";
import path from "path";
import { initSchema } from "./schema";

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = process.env.DB_PATH ?? path.join(process.cwd(), "mesh.db");
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initSchema(db);
    // Migrations for columns added after initial schema
    try { db.exec("ALTER TABLE messages ADD COLUMN transport TEXT"); } catch { /* already exists */ }
  }
  return db;
}
