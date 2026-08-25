import { DatabaseSync } from 'node:sqlite'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, '../../data')

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

const db = new DatabaseSync(path.join(dataDir, 'church.db'))
db.exec('PRAGMA journal_mode = WAL')
db.exec('PRAGMA foreign_keys = ON')

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admin_users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      date TEXT NOT NULL,
      pinned INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS sermons (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      preacher TEXT NOT NULL,
      date TEXT NOT NULL,
      scripture TEXT,
      summary TEXT NOT NULL,
      video_url TEXT,
      audio_url TEXT
    );

    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      day TEXT NOT NULL,
      time TEXT NOT NULL,
      location TEXT,
      description TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT NOT NULL,
      location TEXT NOT NULL,
      description TEXT NOT NULL,
      image_url TEXT
    );

    CREATE TABLE IF NOT EXISTS leadership (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      bio TEXT NOT NULL,
      image_url TEXT
    );

    CREATE TABLE IF NOT EXISTS about_page (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      welcome_title TEXT NOT NULL,
      welcome_text TEXT NOT NULL,
      mission TEXT NOT NULL,
      vision TEXT NOT NULL,
      history TEXT NOT NULL,
      values_text TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS social_publish_log (
      id TEXT PRIMARY KEY,
      content_type TEXT NOT NULL,
      content_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      status TEXT NOT NULL,
      external_id TEXT,
      message TEXT,
      error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS contact_messages (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)
}

export default db
