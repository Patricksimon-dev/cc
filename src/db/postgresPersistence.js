import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || process.env.PG_CONNECTION_STRING;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL must be set for Postgres persistence');
}

const pool = new Pool({ connectionString: DATABASE_URL });

export async function query(text, params) {
  const res = await pool.query(text, params);
  return res;
}

export async function all(text, params = []) {
  const res = await pool.query(text, params);
  return res.rows || [];
}

export async function get(text, params = []) {
  const res = await pool.query(text, params);
  return res.rows && res.rows[0] ? res.rows[0] : undefined;
}

export async function run(text, params = []) {
  const result = await pool.query(text, params);
  return { changes: result.rowCount, rowCount: result.rowCount };
}

export function getDb() {
  return { all, get, run, query };
}

export async function initializePersistence() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS collections (
      id TEXT NOT NULL,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP WITH TIME ZONE,
      PRIMARY KEY (type, id)
    )`,
    `ALTER TABLE collections ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE`,
    `CREATE TABLE IF NOT EXISTS about_page (
      id TEXT PRIMARY KEY DEFAULT 'main',
      welcome_title TEXT,
      welcome_text TEXT,
      mission TEXT,
      vision TEXT,
      history TEXT,
      values_text TEXT,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS uploads (
      id TEXT PRIMARY KEY,
      filename TEXT,
      mime_type TEXT,
      data_base64 TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS admins (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS social_logs (
      id TEXT PRIMARY KEY,
      platform TEXT,
      content_id TEXT,
      content_type TEXT,
      status TEXT,
      response TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS contact_messages (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`,
  ]

  for (const statement of statements) {
    await pool.query(statement)
  }
}

export async function saveUpload(id, filename, mimeType, base64Data) {
  await pool.query(
    `INSERT INTO uploads (id, filename, mime_type, data_base64, created_at)
     VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
     ON CONFLICT (id) DO UPDATE SET filename = EXCLUDED.filename, mime_type = EXCLUDED.mime_type, data_base64 = EXCLUDED.data_base64, created_at = EXCLUDED.created_at`,
    [id, filename, mimeType, base64Data]
  );
}

export async function getUpload(id) {
  const res = await pool.query(`SELECT * FROM uploads WHERE id = $1`, [id]);
  return res.rows[0];
}

export async function deleteUpload(id) {
  if (!id) return;
  const filename = id.split('/').pop();
  await pool.query(`DELETE FROM uploads WHERE id = $1`, [filename]);
}

export async function closePool() {
  await pool.end();
}
