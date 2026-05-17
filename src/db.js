'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let db = null;

function getDb() {
  if (db) return db;

  const dbPath = process.env.DB_PATH || './data/dxm_ingest.sqlite';
  const resolvedPath = dbPath === ':memory:' ? ':memory:' : path.resolve(dbPath);
  if (resolvedPath !== ':memory:') {
    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  }

  db = new Database(resolvedPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS dxm_push_events (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      received_at TEXT    NOT NULL,
      method      TEXT,
      path        TEXT,
      query_json  TEXT,
      headers_json TEXT,
      remote_ip   TEXT,
      content_type TEXT,
      raw_body    TEXT,
      parsed_json TEXT,
      parse_error TEXT,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    )
  `);

  return db;
}

const insertStmt = () => getDb().prepare(`
  INSERT INTO dxm_push_events
    (received_at, method, path, query_json, headers_json,
     remote_ip, content_type, raw_body, parsed_json, parse_error)
  VALUES
    (@received_at, @method, @path, @query_json, @headers_json,
     @remote_ip, @content_type, @raw_body, @parsed_json, @parse_error)
`);

function insertEvent(data) {
  return insertStmt().run(data).lastInsertRowid;
}

function getEvents(limit = 50) {
  return getDb().prepare(`
    SELECT id, received_at, method, path, remote_ip, content_type,
      raw_body, content_type, created_at
    FROM dxm_push_events
    ORDER BY id DESC
    LIMIT ?
  `).all(limit);
}

function getEvent(id) {
  return getDb().prepare(
    'SELECT * FROM dxm_push_events WHERE id = ?'
  ).get(id);
}

function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

module.exports = { getDb, insertEvent, getEvents, getEvent, closeDb };
