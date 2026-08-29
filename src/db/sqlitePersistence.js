import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'church.db');
const db = new Database(dbPath);

// Enable WAL mode for concurrency & safety
db.pragma('journal_mode = WAL');

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS collections (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS about_page (
    id TEXT PRIMARY KEY DEFAULT 'main',
    welcome_title TEXT,
    welcome_text TEXT,
    mission TEXT,
    vision TEXT,
    history TEXT,
    values_text TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS uploads (
    id TEXT PRIMARY KEY,
    filename TEXT,
    mime_type TEXT,
    data_base64 TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS admins (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS social_logs (
    id TEXT PRIMARY KEY,
    platform TEXT,
    content_id TEXT,
    content_type TEXT,
    status TEXT,
    response TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

export function getDb() {
  return db;
}

// Upload Operations
export function saveUpload(id, filename, mimeType, base64Data) {
  const stmt = db.prepare(`
    INSERT INTO uploads (id, filename, mime_type, data_base64)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      filename = excluded.filename,
      mime_type = excluded.mime_type,
      data_base64 = excluded.data_base64
  `);
  stmt.run(id, filename, mimeType, base64Data);
}

export function getUpload(id) {
  const stmt = db.prepare(`SELECT * FROM uploads WHERE id = ?`);
  return stmt.get(id);
}

export function deleteUpload(id) {
  if (!id) return;
  const filename = id.split('/').pop();
  if (!filename) return;
  const stmt = db.prepare(`DELETE FROM uploads WHERE id = ?`);
  stmt.run(filename);
}
