import db from '../db/database.js'

function mapAnnouncement(row) {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    date: row.date,
    pinned: Boolean(row.pinned),
  }
}

function mapSermon(row) {
  return {
    id: row.id,
    title: row.title,
    preacher: row.preacher,
    date: row.date,
    scripture: row.scripture || '',
    summary: row.summary,
    videoUrl: row.video_url || '',
    audioUrl: row.audio_url || '',
  }
}

function mapActivity(row) {
  return {
    id: row.id,
    title: row.title,
    day: row.day,
    time: row.time,
    location: row.location || '',
    description: row.description,
  }
}

function mapEvent(row) {
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    time: row.time,
    location: row.location,
    description: row.description,
    imageUrl: row.image_url || '',
  }
}

function mapLeader(row) {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    bio: row.bio,
    imageUrl: row.image_url || '',
  }
}

function mapAbout(row) {
  if (!row) {
    return {
      welcomeTitle: '',
      welcomeText: '',
      mission: '',
      vision: '',
      history: '',
      values: '',
    }
  }
  return {
    welcomeTitle: row.welcome_title,
    welcomeText: row.welcome_text,
    mission: row.mission,
    vision: row.vision,
    history: row.history,
    values: row.values_text,
  }
}

export function getPublicContent() {
  const announcements = db
    .prepare('SELECT * FROM announcements ORDER BY pinned DESC, date DESC')
    .all()
    .map(mapAnnouncement)
  const sermons = db.prepare('SELECT * FROM sermons ORDER BY date DESC').all().map(mapSermon)
  const activities = db.prepare('SELECT * FROM activities').all().map(mapActivity)
  const events = db.prepare('SELECT * FROM events ORDER BY date ASC').all().map(mapEvent)
  const leadership = db.prepare('SELECT * FROM leadership').all().map(mapLeader)
  const about = mapAbout(db.prepare('SELECT * FROM about_page WHERE id = 1').get())

  return { announcements, sermons, activities, events, leadership, about }
}

export function getItemByType(type, id) {
  const maps = {
    announcements: { table: 'announcements', map: mapAnnouncement },
    sermons: { table: 'sermons', map: mapSermon },
    activities: { table: 'activities', map: mapActivity },
    events: { table: 'events', map: mapEvent },
    leadership: { table: 'leadership', map: mapLeader },
  }
  const cfg = maps[type]
  if (!cfg) return null
  const row = db.prepare(`SELECT * FROM ${cfg.table} WHERE id = ?`).get(id)
  return row ? cfg.map(row) : null
}

export const contentRepositories = {
  announcements: {
    list: () =>
      db
        .prepare('SELECT * FROM announcements ORDER BY pinned DESC, date DESC')
        .all()
        .map(mapAnnouncement),
    create: (id, body) => {
      db.prepare(
        'INSERT INTO announcements (id, title, content, date, pinned) VALUES (?, ?, ?, ?, ?)'
      ).run(id, body.title, body.content, body.date, body.pinned ? 1 : 0)
      return getItemByType('announcements', id)
    },
    update: (id, body) => {
      db.prepare(
        'UPDATE announcements SET title = ?, content = ?, date = ?, pinned = ? WHERE id = ?'
      ).run(body.title, body.content, body.date, body.pinned ? 1 : 0, id)
      return getItemByType('announcements', id)
    },
    remove: (id) => db.prepare('DELETE FROM announcements WHERE id = ?').run(id),
  },
  sermons: {
    list: () => db.prepare('SELECT * FROM sermons ORDER BY date DESC').all().map(mapSermon),
    create: (id, body) => {
      db.prepare(
        `INSERT INTO sermons (id, title, preacher, date, scripture, summary, video_url, audio_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        id,
        body.title,
        body.preacher,
        body.date,
        body.scripture || '',
        body.summary,
        body.videoUrl || '',
        body.audioUrl || ''
      )
      return getItemByType('sermons', id)
    },
    update: (id, body) => {
      db.prepare(
        `UPDATE sermons SET title = ?, preacher = ?, date = ?, scripture = ?, summary = ?,
         video_url = ?, audio_url = ? WHERE id = ?`
      ).run(
        body.title,
        body.preacher,
        body.date,
        body.scripture || '',
        body.summary,
        body.videoUrl || '',
        body.audioUrl || '',
        id
      )
      return getItemByType('sermons', id)
    },
    remove: (id) => db.prepare('DELETE FROM sermons WHERE id = ?').run(id),
  },
  activities: {
    list: () => db.prepare('SELECT * FROM activities').all().map(mapActivity),
    create: (id, body) => {
      db.prepare(
        'INSERT INTO activities (id, title, day, time, location, description) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(id, body.title, body.day, body.time, body.location || '', body.description)
      return getItemByType('activities', id)
    },
    update: (id, body) => {
      db.prepare(
        'UPDATE activities SET title = ?, day = ?, time = ?, location = ?, description = ? WHERE id = ?'
      ).run(body.title, body.day, body.time, body.location || '', body.description, id)
      return getItemByType('activities', id)
    },
    remove: (id) => db.prepare('DELETE FROM activities WHERE id = ?').run(id),
  },
  events: {
    list: () => db.prepare('SELECT * FROM events ORDER BY date ASC').all().map(mapEvent),
    create: (id, body) => {
      db.prepare(
        'INSERT INTO events (id, title, date, time, location, description, image_url) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(
        id,
        body.title,
        body.date,
        body.time,
        body.location,
        body.description,
        body.imageUrl || ''
      )
      return getItemByType('events', id)
    },
    update: (id, body) => {
      db.prepare(
        `UPDATE events SET title = ?, date = ?, time = ?, location = ?, description = ?, image_url = ?
         WHERE id = ?`
      ).run(
        body.title,
        body.date,
        body.time,
        body.location,
        body.description,
        body.imageUrl || '',
        id
      )
      return getItemByType('events', id)
    },
    remove: (id) => db.prepare('DELETE FROM events WHERE id = ?').run(id),
  },
  leadership: {
    list: () => db.prepare('SELECT * FROM leadership').all().map(mapLeader),
    create: (id, body) => {
      db.prepare(
        'INSERT INTO leadership (id, name, role, bio, image_url) VALUES (?, ?, ?, ?, ?)'
      ).run(id, body.name, body.role, body.bio, body.imageUrl || '')
      return getItemByType('leadership', id)
    },
    update: (id, body) => {
      db.prepare(
        'UPDATE leadership SET name = ?, role = ?, bio = ?, image_url = ? WHERE id = ?'
      ).run(body.name, body.role, body.bio, body.imageUrl || '', id)
      return getItemByType('leadership', id)
    },
    remove: (id) => db.prepare('DELETE FROM leadership WHERE id = ?').run(id),
  },
}

export function updateAboutPage(body) {
  db.prepare(
    `UPDATE about_page SET welcome_title = ?, welcome_text = ?, mission = ?, vision = ?, history = ?, values_text = ?
     WHERE id = 1`
  ).run(body.welcomeTitle, body.welcomeText, body.mission, body.vision, body.history, body.values)
  return mapAbout(db.prepare('SELECT * FROM about_page WHERE id = 1').get())
}

export function logSocialPublish(entry) {
  db.prepare(
    `INSERT INTO social_publish_log (id, content_type, content_id, platform, status, external_id, message, error)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    entry.id,
    entry.contentType,
    entry.contentId,
    entry.platform,
    entry.status,
    entry.externalId || null,
    entry.message || null,
    entry.error || null
  )
}

export function getSocialLogs(limit = 50) {
  return db
    .prepare('SELECT * FROM social_publish_log ORDER BY created_at DESC LIMIT ?')
    .all(limit)
}

export function findAdminByEmail(email) {
  return db.prepare('SELECT * FROM admin_users WHERE email = ?').get(email.toLowerCase())
}

export function findAdminById(id) {
  return db.prepare('SELECT id, email, name, created_at FROM admin_users WHERE id = ?').get(id)
}

export function updateAdminPassword(id, passwordHash) {
  db.prepare('UPDATE admin_users SET password_hash = ? WHERE id = ?').run(passwordHash, id)
}
