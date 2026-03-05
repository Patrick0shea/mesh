import type Database from "better-sqlite3";

export function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS nodes (
      node_id TEXT PRIMARY KEY,
      long_name TEXT,
      short_name TEXT,
      hardware TEXT,
      role TEXT,
      latitude REAL,
      longitude REAL,
      altitude REAL,
      battery_level INTEGER,
      voltage REAL,
      last_heard INTEGER,
      first_seen INTEGER,
      snr REAL,
      rssi INTEGER,
      hops_away INTEGER
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_node TEXT NOT NULL,
      to_node TEXT,
      channel INTEGER DEFAULT 0,
      text TEXT,
      timestamp INTEGER,
      packet_id TEXT
    );

    CREATE TABLE IF NOT EXISTS sos_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      node_id TEXT NOT NULL,
      triggered_at INTEGER,
      acknowledged_at INTEGER,
      acknowledged_by TEXT,
      resolved_at INTEGER,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS packet_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      packet_id TEXT,
      from_node TEXT,
      to_node TEXT,
      via_nodes TEXT,
      port_num INTEGER,
      timestamp INTEGER,
      hop_limit INTEGER,
      hop_start INTEGER,
      rssi INTEGER,
      snr REAL
    );

    CREATE TABLE IF NOT EXISTS neighbour_info (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      node_id TEXT NOT NULL,
      neighbour_id TEXT NOT NULL,
      snr REAL,
      timestamp INTEGER,
      UNIQUE(node_id, neighbour_id)
    );

    CREATE TABLE IF NOT EXISTS dms_config (
      node_id TEXT PRIMARY KEY,
      enabled INTEGER DEFAULT 0,
      silence_timeout_minutes INTEGER DEFAULT 45,
      movement_timeout_minutes INTEGER,
      escalation_minutes INTEGER DEFAULT 15,
      contact_note TEXT,
      updated_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS dms_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      node_id TEXT NOT NULL,
      triggered_at INTEGER,
      trigger_type TEXT,
      last_heard INTEGER,
      last_known_lat REAL,
      last_known_lon REAL,
      acknowledged_at INTEGER,
      escalated_at INTEGER,
      resolution TEXT,
      resolution_note TEXT,
      silence_duration_minutes REAL
    );
  `);
}
