import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/sqlitePersistence.js';
import { config } from '../config.js';

let localDefaultAdminHash = bcrypt.hashSync(config.adminPassword, 12);

const DEFAULT_LEADERSHIP_ID = 'pastor-ekele-idoko';
const DEFAULT_LEADERSHIP_ITEM = Object.freeze({
  id: DEFAULT_LEADERSHIP_ID,
  name: 'Pastor : Ekele Idoko Mark . The G . O of the CCAM',
  role: 'Senior Pastor & General Overseer',
  bio: 'Leading Christ Chosen Assembly Ministry with vision, faith, and dedication to God’s word and community service.',
  imageUrl: '/go-pastor.jpg',
});

const TYPES = ['announcements', 'sermons', 'activities', 'events', 'leadership'];

export function getDefaultLeadershipItem() {
  return { ...DEFAULT_LEADERSHIP_ITEM };
}

export function normalizeLeadershipItem(item = {}) {
  return {
    ...DEFAULT_LEADERSHIP_ITEM,
    ...item,
    id: DEFAULT_LEADERSHIP_ID,
    name: item.name ?? DEFAULT_LEADERSHIP_ITEM.name,
    role: item.role ?? DEFAULT_LEADERSHIP_ITEM.role,
    imageUrl: item.imageUrl ?? item.image_url ?? DEFAULT_LEADERSHIP_ITEM.imageUrl,
  };
}

function normalizeItem(type, item) {
  if (type === 'announcements') return { ...item, pinned: Boolean(item.pinned) };
  if (type === 'sermons') return { ...item, videoUrl: item.videoUrl ?? item.video_url ?? '', audioUrl: item.audioUrl ?? item.audio_url ?? '' };
  if (type === 'events') return { ...item, imageUrl: item.imageUrl ?? item.image_url ?? '' };
  if (type === 'leadership') return normalizeLeadershipItem(item);
  return item;
}

function readDefaultContentSeed() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const defaultContentPath = path.resolve(__dirname, '../../data/content.json');

  if (!fs.existsSync(defaultContentPath)) return null;

  try {
    const raw = fs.readFileSync(defaultContentPath, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export async function initializeContentStore() {
  const db = getDb();

  const existingCollectionRows = db.prepare(`SELECT type, COUNT(*) AS count FROM collections GROUP BY type`).all();
  const hasAnyCollectionContent = TYPES.some((type) => (existingCollectionRows.find((row) => row.type === type)?.count ?? 0) > 0);
  const aboutRecordExists = Boolean(db.prepare(`SELECT 1 FROM about_page WHERE id = 'main'`).get());

  if (config.seedDefaultContent && !hasAnyCollectionContent && !aboutRecordExists) {
    const defaultContent = readDefaultContentSeed();
    if (defaultContent) {
      for (const type of TYPES) {
        const items = Array.isArray(defaultContent[type]) ? defaultContent[type] : [];
        for (const item of items) {
          if (!item || typeof item !== 'object' || !item.id) continue;
          const payload = type === 'leadership' ? normalizeLeadershipItem(item) : item;
          const recordId = type === 'leadership' ? DEFAULT_LEADERSHIP_ID : item.id;
          db.prepare(`
            INSERT INTO collections (id, type, content)
            VALUES (?, ?, ?)
            ON CONFLICT(type, id) DO NOTHING
          `).run(recordId, type, JSON.stringify(payload));
        }
      }

      if (defaultContent.about && typeof defaultContent.about === 'object') {
        db.prepare(`
          INSERT INTO about_page (id, welcome_title, welcome_text, mission, vision, history, values_text, updated_at)
          VALUES ('main', ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(id) DO NOTHING
        `).run(
          defaultContent.about.welcomeTitle || '',
          defaultContent.about.welcomeText || '',
          defaultContent.about.mission || '',
          defaultContent.about.vision || '',
          defaultContent.about.history || '',
          defaultContent.about.values || ''
        );
      }
    }
  }

  // Only seed a default leadership item when none exist. Do not delete or
  // overwrite existing leadership entries so admin edits persist.
  const leadershipRows = db.prepare(`SELECT id, content FROM collections WHERE type = 'leadership'`).all();
  if (!leadershipRows || leadershipRows.length === 0) {
    const keepDefaultLeadership = JSON.stringify(normalizeLeadershipItem());
    const defaultLeadershipExists = db.prepare(`SELECT id FROM collections WHERE type = 'leadership' AND id = ?`).get(DEFAULT_LEADERSHIP_ID);
    if (defaultLeadershipExists) {
      db.prepare(`UPDATE collections SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND type = 'leadership'`).run(keepDefaultLeadership, DEFAULT_LEADERSHIP_ID);
    } else {
      db.prepare(`INSERT INTO collections (id, type, content) VALUES (?, 'leadership', ?)`).run(DEFAULT_LEADERSHIP_ID, keepDefaultLeadership);
    }
  }

  const adminEmail = config.adminEmail.trim().toLowerCase();
  const adminRows = db.prepare(`SELECT * FROM admins`).all();
  const existingAdmin = adminRows.find((row) => row.email && row.email.toLowerCase() === adminEmail);
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
      if (row.type === 'leadership') {
        result.leadership = [item];
      } else if (result[row.type]) {
        result[row.type].push(item);
      }
    } catch (e) {}
  }

  result.leadership = result.leadership.length ? [normalizeLeadershipItem(result.leadership[0])] : [];

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
      const item = type === 'leadership'
        ? normalizeLeadershipItem({ ...body, id: DEFAULT_LEADERSHIP_ID })
        : { id, ...body };
      const recordId = type === 'leadership' ? DEFAULT_LEADERSHIP_ID : id;
      const stmt = db.prepare(`
        INSERT INTO collections (id, type, content)
        VALUES (?, ?, ?)
        ON CONFLICT(type, id) DO UPDATE SET
          content = excluded.content,
          updated_at = CURRENT_TIMESTAMP
      `);
      stmt.run(recordId, type, JSON.stringify(item));
      return item;
    },
    update: async (id, body) => {
      const db = getDb();
      const existing = await getItemByType(type, id);
      if (!existing) return null;
      const updated = type === 'leadership'
        ? normalizeLeadershipItem({ ...existing, ...body, id: DEFAULT_LEADERSHIP_ID })
        : { ...existing, ...body, id };
      const recordId = type === 'leadership' ? DEFAULT_LEADERSHIP_ID : id;
      const stmt = db.prepare(`
        UPDATE collections
        SET content = ?, updated_at = CURRENT_TIMESTAMP
        WHERE type = ? AND id = ?
      `);
      stmt.run(JSON.stringify(updated), type, recordId);
      return updated;
    },
    remove: async (id) => {
      const db = getDb();
      if (type === 'leadership') {
        // When removing a leadership item, delete the record instead of
        // overwriting it with the default so admin changes are not lost.
        const stmt = db.prepare(`DELETE FROM collections WHERE type = ? AND id = ?`);
        stmt.run(type, id);
        return;
      }
      const stmt = db.prepare(`DELETE FROM collections WHERE type = ? AND id = ?`);
      stmt.run(type, id);
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
  const target = String(email ?? '').trim().toLowerCase();
  if (!target) return null;

  const db = getDb();
  const rows = db.prepare(`SELECT * FROM admins`).all();
  const matchingAdmin = rows.find((admin) => {
    const rowEmail = String(admin.email || '').toLowerCase();
    const rowName = String(admin.name || '').toLowerCase();
    const username = rowEmail.includes('@') ? rowEmail.split('@')[0] : rowEmail;
    return rowEmail === target || rowName === target || username === target || rowEmail === `${target}@${rowEmail.split('@')[1] || 'church.local'}`;
  });

  if (matchingAdmin) return matchingAdmin;

  const configuredEmail = config.adminEmail.trim().toLowerCase();
  const configuredUsername = configuredEmail.includes('@') ? configuredEmail.split('@')[0] : configuredEmail;
  if (target === configuredEmail || target === configuredUsername || target === 'admin') {
    return {
      id: 'local-admin-id',
      email: configuredEmail,
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
