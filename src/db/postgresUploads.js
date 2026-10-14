import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || process.env.PG_CONNECTION_STRING;
if (!DATABASE_URL) throw new Error('DATABASE_URL not set for postgresUploads');

const pool = new Pool({ connectionString: DATABASE_URL });

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
