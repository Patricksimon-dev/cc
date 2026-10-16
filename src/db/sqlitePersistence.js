import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, '../../data');
const dbPath = process.env.SQLITE_DATABASE_PATH
  ? path.resolve(process.env.SQLITE_DATABASE_PATH)
  : path.join(dataDir, 'church.db');

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function normalizeParams(params) {
  if (Array.isArray(params)) return params;
  if (params && typeof params === 'object') return Object.values(params);
  return [];
}

function sqliteifyQuery(sql) {
  return sql.replace(/\$(\d+)/g, '?');
}

function ensureSchema() {
  const schema = [
    `CREATE TABLE IF NOT EXISTS collections (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME
    )`,
    `CREATE TABLE IF NOT EXISTS about_page (
      id TEXT PRIMARY KEY,
      welcome_title TEXT,
      welcome_text TEXT,
      mission TEXT,
      vision TEXT,
      history TEXT,
      values_text TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS admins (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      password_hash TEXT,
      name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS uploads (
      id TEXT PRIMARY KEY,
      filename TEXT,
      mime_type TEXT,
      data_base64 TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS social_logs (
      id TEXT PRIMARY KEY,
      platform TEXT,
      content_id TEXT,
      content_type TEXT,
      status TEXT,
      response TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS idx_collections_type ON collections(type)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_collections_type_id ON collections(type, id)`,
    `CREATE INDEX IF NOT EXISTS idx_about_page_id ON about_page(id)`,
    `CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email)`,
    `CREATE INDEX IF NOT EXISTS idx_social_logs_created_at ON social_logs(created_at)`,
  ];

  for (const statement of schema) {
    db.prepare(statement).run();
  }

  const collectionColumns = db.prepare('PRAGMA table_info(collections)').all();
  if (!collectionColumns.some((column) => column.name === 'expires_at')) {
    db.prepare('ALTER TABLE collections ADD COLUMN expires_at DATETIME').run();
  }
}

ensureSchema();

export function getDb() {
  return {
    all(sql, params = []) {
      return db.prepare(sqliteifyQuery(sql)).all(...normalizeParams(params));
    },
    get(sql, params = []) {
      return db.prepare(sqliteifyQuery(sql)).get(...normalizeParams(params));
    },
    run(sql, params = []) {
      return db.prepare(sqliteifyQuery(sql)).run(...normalizeParams(params));
    },
    query(sql, params = []) {
      return db.prepare(sqliteifyQuery(sql)).all(...normalizeParams(params));
    },
  };
}

export async function saveUpload(id, filename, mimeType, base64Data) {
  db.prepare(`
    INSERT INTO uploads (id, filename, mime_type, data_base64, created_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      filename = excluded.filename,
      mime_type = excluded.mime_type,
      data_base64 = excluded.data_base64,
      created_at = CURRENT_TIMESTAMP
  `).run(id, filename, mimeType, base64Data);
}

export async function getUpload(id) {
  return db.prepare('SELECT * FROM uploads WHERE id = ?').get(id);
}

export async function deleteUpload(id) {
  if (!id) return;
  const fileId = String(id).split('/').pop();
  if (!fileId) return;
  db.prepare('DELETE FROM uploads WHERE id = ?').run(fileId);
}
