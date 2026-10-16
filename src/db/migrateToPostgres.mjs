import Database from 'better-sqlite3';
import { Pool } from 'pg';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlitePath = path.join(__dirname, '../../data/church.db');

if (!process.env.DATABASE_URL) {
  console.error('Please set DATABASE_URL environment variable to your Postgres connection string.');
  process.exit(1);
}

if (!fs.existsSync(sqlitePath)) {
  console.error('SQLite database not found at', sqlitePath);
  process.exit(1);
}

const sqlite = new Database(sqlitePath);
const collectionColumns = sqlite.prepare('PRAGMA table_info(collections)').all();
if (!collectionColumns.some((column) => column.name === 'expires_at')) {
  sqlite.prepare('ALTER TABLE collections ADD COLUMN expires_at DATETIME').run();
}
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS collections (
      id TEXT NOT NULL,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP WITH TIME ZONE,
      PRIMARY KEY (type, id)
    );

    ALTER TABLE collections ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

    CREATE TABLE IF NOT EXISTS about_page (
      id TEXT PRIMARY KEY DEFAULT 'main',
      welcome_title TEXT,
      welcome_text TEXT,
      mission TEXT,
      vision TEXT,
      history TEXT,
      values_text TEXT,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS uploads (
      id TEXT PRIMARY KEY,
      filename TEXT,
      mime_type TEXT,
      data_base64 TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS admins (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS social_logs (
      id TEXT PRIMARY KEY,
      platform TEXT,
      content_id TEXT,
      content_type TEXT,
      status TEXT,
      response TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS contact_messages (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function migrateTable(sqliteQuery, insertSql, transformRow = (r) => r) {
  const rows = sqlite.prepare(sqliteQuery).all();
  console.log(`Found ${rows.length} rows to migrate`);
  for (const row of rows) {
    const t = transformRow(row);
    const vals = Array.isArray(t) ? t : Object.values(t);
    try {
      await pool.query(insertSql, vals);
    } catch (err) {
      console.warn('Insert failed (may be duplicate):', err.message);
    }
  }
}

(async function run() {
  try {
    await ensureSchema();

    console.log('Migrating collections...');
    await migrateTable(
      `SELECT id, type, content, created_at, updated_at, expires_at FROM collections`,
      `INSERT INTO collections (id, type, content, created_at, updated_at, expires_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (type,id) DO UPDATE SET content = EXCLUDED.content, updated_at = EXCLUDED.updated_at, expires_at = EXCLUDED.expires_at`,
      (r) => [r.id, r.type, r.content, r.created_at || new Date(), r.updated_at || new Date(), r.expires_at || null]
    );

    console.log('Migrating about_page...');
    const about = sqlite.prepare(`SELECT id, welcome_title, welcome_text, mission, vision, history, values_text, updated_at FROM about_page WHERE id = 'main'`).get();
    if (about) {
      await pool.query(`INSERT INTO about_page (id, welcome_title, welcome_text, mission, vision, history, values_text, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO UPDATE SET welcome_title = EXCLUDED.welcome_title, welcome_text = EXCLUDED.welcome_text, mission = EXCLUDED.mission, vision = EXCLUDED.vision, history = EXCLUDED.history, values_text = EXCLUDED.values_text, updated_at = EXCLUDED.updated_at`, [about.id || 'main', about.welcome_title || '', about.welcome_text || '', about.mission || '', about.vision || '', about.history || '', about.values_text || '', about.updated_at || new Date()]);
    }

    console.log('Migrating uploads...');
    await migrateTable(
      `SELECT id, filename, mime_type, data_base64, created_at FROM uploads`,
      `INSERT INTO uploads (id, filename, mime_type, data_base64, created_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO UPDATE SET filename = EXCLUDED.filename, mime_type = EXCLUDED.mime_type, data_base64 = EXCLUDED.data_base64`,
      (r) => [r.id, r.filename || null, r.mime_type || null, r.data_base64 || '', r.created_at || new Date()]
    );

    console.log('Migrating admins...');
    await migrateTable(
      `SELECT id, email, password_hash, name, created_at FROM admins`,
      `INSERT INTO admins (id, email, password_hash, name, created_at) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, password_hash = EXCLUDED.password_hash, name = EXCLUDED.name`,
      (r) => [r.id, r.email, r.password_hash, r.name || null, r.created_at || new Date()]
    );

    console.log('Migrating social_logs...');
    await migrateTable(
      `SELECT id, platform, content_id, content_type, status, response, created_at FROM social_logs`,
      `INSERT INTO social_logs (id, platform, content_id, content_type, status, response, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
      (r) => [r.id, r.platform || null, r.content_id || null, r.content_type || null, r.status || null, r.response || null, r.created_at || new Date()]
    );

    console.log('Migrating contact_messages...');
    await migrateTable(
      `SELECT id, name, email, subject, message, created_at FROM contact_messages`,
      `INSERT INTO contact_messages (id, name, email, subject, message, created_at) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING`,
      (r) => [r.id, r.name, r.email, r.subject, r.message, r.created_at || new Date()]
    );

    console.log('Migration complete.');
    await pool.end();
    sqlite.close();
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    try { await pool.end(); } catch (e) {}
    try { sqlite.close(); } catch (e) {}
    process.exit(1);
  }
})();
