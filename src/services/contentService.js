import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/sqlitePersistence.js';
import { config } from '../config.js';

let localDefaultAdminHash = bcrypt.hashSync(config.adminPassword, 12);

const TYPES = ['announcements', 'sermons', 'activities', 'events', 'leadership'];

function normalizeItem(type, item) {
  if (type === 'announcements') return { ...item, pinned: Boolean(item.pinned) };
  if (type === 'sermons') return { ...item, videoUrl: item.videoUrl ?? item.video_url ?? '', audioUrl: item.audioUrl ?? item.audio_url ?? '' };
  if (type === 'events') return { ...item, imageUrl: item.imageUrl ?? item.image_url ?? '' };
  if (type === 'leadership') return { ...item, imageUrl: item.imageUrl ?? item.image_url ?? '' };
  return item;
}

export async function initializeContentStore() {
  const db = getDb();

  // Check if leadership collection has rows; if not, seed default Pastor Ekele Idoko profile
  const countStmt = db.prepare(`SELECT COUNT(*) as count FROM collections WHERE type = 'leadership'`);
  const { count } = countStmt.get();

  if (count === 0) {
    const defaultPastor = {
      id: 'fff60e59-0aa7-4415-8d08-6eaef176a05b',
      name: 'Pastor Ekele Idoko',
      role: 'Senior Pastor & General Overseer',
      bio: 'Leading Christ Chosen Assembly Ministry with vision, faith, and dedication to God’s word and community service.',
      imageUrl: '/go-pastor.jpg',
    };
    const insertStmt = db.prepare(`
      INSERT INTO collections (id, type, content)
      VALUES (?, 'leadership', ?)
    `);
    insertStmt.run(defaultPastor.id, JSON.stringify(defaultPastor));
  }

  // Initialize admin user if missing
  const adminEmail = config.adminEmail.trim().toLowerCase();
  const adminStmt = db.prepare(`SELECT * FROM admins WHERE email = ?`);
  const existingAdmin = adminStmt.get(adminEmail);
  if (!existingAdmin) {
    const insertAdmin = db.prepare(`
      INSERT INTO admins (id, email, password_hash, name)
      VALUES (?, ?, ?, ?)
    `);
    insertAdmin.run(uuidv4(), adminEmail, localDefaultAdminHash, 'Church Admin');
  }
}

export async function getPublicContent() {
  const db = getDb();
  const result = {
    announcements: [],
    sermons: [],
    activities: [],
    events: [],
    leadership: [],
    about: null,
  };

  const stmt = db.prepare(`SELECT id, type, content FROM collections ORDER BY created_at DESC`);
  const rows = stmt.all();

  for (const row of rows) {
    try {
      const parsed = JSON.parse(row.content);
      const item = normalizeItem(row.type, { id: row.id, ...parsed });
      if (result[row.type]) {
        result[row.type].push(item);
      }
    } catch (e) {}
  }

  // Sort collections appropriately
  result.announcements.sort((a, b) => Number(b.pinned) - Number(a.pinned) || String(b.date || '').localeCompare(String(a.date || '')));
  result.sermons.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  result.events.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));

  // Get About page
  const aboutStmt = db.prepare(`SELECT * FROM about_page WHERE id = 'main'`);
  const aboutRow = aboutStmt.get();
  if (aboutRow) {
    result.about = {
      welcomeTitle: aboutRow.welcome_title || '',
      welcomeText: aboutRow.welcome_text || '',
      mission: aboutRow.mission || '',
      vision: aboutRow.vision || '',
      history: aboutRow.history || '',
      values: aboutRow.values_text || '',
    };
  }

  return result;
}

export async function getItemByType(type, id) {
  const db = getDb();
  const stmt = db.prepare(`SELECT content FROM collections WHERE type = ? AND id = ?`);
  const row = stmt.get(type, id);
  if (!row) return null;
  try {
    return { id, ...JSON.parse(row.content) };
  } catch (e) {
    return null;
  }
}

export const contentRepositories = {};

for (const type of TYPES) {
  contentRepositories[type] = {
    list: async () => {
      const all = await getPublicContent();
      return all[type] || [];
    },
    create: async (id, body) => {
      const db = getDb();
      const item = { id, ...body };
      const stmt = db.prepare(`
        INSERT INTO collections (id, type, content)
        VALUES (?, ?, ?)
      `);
      stmt.run(id, type, JSON.stringify(item));
      return item;
    },
    update: async (id, body) => {
      const db = getDb();
      const existing = await getItemByType(type, id);
      if (!existing) return null;
      const updated = { ...existing, ...body, id };
      const stmt = db.prepare(`
        UPDATE collections
        SET content = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND type = ?
      `);
      stmt.run(JSON.stringify(updated), id, type);
      return updated;
    },
    remove: async (id) => {
      const db = getDb();
      const stmt = db.prepare(`DELETE FROM collections WHERE id = ? AND type = ?`);
      stmt.run(id, type);
    },
  };
}

export async function updateAboutPage(body) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO about_page (id, welcome_title, welcome_text, mission, vision, history, values_text, updated_at)
    VALUES ('main', ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      welcome_title = excluded.welcome_title,
      welcome_text = excluded.welcome_text,
      mission = excluded.mission,
      vision = excluded.vision,
      history = excluded.history,
      values_text = excluded.values_text,
      updated_at = CURRENT_TIMESTAMP
  `);
  stmt.run(
    body.welcomeTitle || '',
    body.welcomeText || '',
    body.mission || '',
    body.vision || '',
    body.history || '',
    body.values || ''
  );
  return {
    welcomeTitle: body.welcomeTitle || '',
    welcomeText: body.welcomeText || '',
    mission: body.mission || '',
    vision: body.vision || '',
    history: body.history || '',
    values: body.values || '',
  };
}

export async function deleteAboutPage() {
  const db = getDb();
  const stmt = db.prepare(`DELETE FROM about_page WHERE id = 'main'`);
  stmt.run();
}

export async function findAdminByEmail(email) {
  const target = email.toLowerCase();
  const db = getDb();
  const stmt = db.prepare(`SELECT * FROM admins WHERE email = ?`);
  const found = stmt.get(target);
  if (found) return found;

  if (target === config.adminEmail.trim().toLowerCase()) {
    return {
      id: 'local-admin-id',
      email: config.adminEmail.trim().toLowerCase(),
      password_hash: localDefaultAdminHash,
      name: 'Church Admin',
    };
  }
  return null;
}

export async function findAdminById(id) {
  const db = getDb();
  const stmt = db.prepare(`SELECT id, email, name FROM admins WHERE id = ?`);
  const found = stmt.get(id);
  if (found) return found;

  return {
    id: 'local-admin-id',
    email: config.adminEmail.trim().toLowerCase(),
    name: 'Church Admin',
  };
}

export async function updateAdminPassword(id, passwordHash) {
  localDefaultAdminHash = passwordHash;
  const db = getDb();
  const stmt = db.prepare(`UPDATE admins SET password_hash = ? WHERE id = ?`);
  stmt.run(passwordHash, id);
}

export async function logSocialPublish(entry) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO social_logs (id, platform, content_id, content_type, status, response)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    uuidv4(),
    entry.platform || '',
    entry.contentId || '',
    entry.contentType || '',
    entry.status || '',
    JSON.stringify(entry.response || {})
  );
}

export async function getSocialLogs(limit = 50) {
  const db = getDb();
  const stmt = db.prepare(`SELECT * FROM social_logs ORDER BY created_at DESC LIMIT ?`);
  return stmt.all(limit);
}
