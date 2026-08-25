import mongoose from 'mongoose'
import db from './database.js'
import { config } from '../config.js'

const contentStateSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, required: true },
    content: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
)

const ContentState = mongoose.models.ContentState || mongoose.model('ContentState', contentStateSchema)

function readContent() {
  return {
    announcements: db.prepare('SELECT * FROM announcements').all(),
    sermons: db.prepare('SELECT * FROM sermons').all(),
    activities: db.prepare('SELECT * FROM activities').all(),
    events: db.prepare('SELECT * FROM events').all(),
    leadership: db.prepare('SELECT * FROM leadership').all(),
    about: db.prepare('SELECT * FROM about_page WHERE id = 1').get() || null,
  }
}

function replaceTable(table, rows, columns) {
  db.prepare(`DELETE FROM ${table}`).run()
  const placeholders = columns.map(() => '?').join(', ')
  const insert = db.prepare(
    `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`
  )
  for (const row of rows || []) {
    insert.run(...columns.map((column) => row[column] ?? null))
  }
}

function restoreContent(content) {
  replaceTable('announcements', content.announcements, ['id', 'title', 'content', 'date', 'pinned'])
  replaceTable('sermons', content.sermons, [
    'id', 'title', 'preacher', 'date', 'scripture', 'summary', 'video_url', 'audio_url'
  ])
  replaceTable('activities', content.activities, ['id', 'title', 'day', 'time', 'location', 'description'])
  replaceTable('events', content.events, [
    'id', 'title', 'date', 'time', 'location', 'description', 'image_url'
  ])
  replaceTable('leadership', content.leadership, ['id', 'name', 'role', 'bio', 'image_url'])

  db.prepare('DELETE FROM about_page').run()
  if (content.about) {
    db.prepare(
      `INSERT INTO about_page
       (id, welcome_title, welcome_text, mission, vision, history, values_text)
       VALUES (1, ?, ?, ?, ?, ?, ?)`
    ).run(
      content.about.welcome_title,
      content.about.welcome_text,
      content.about.mission,
      content.about.vision,
      content.about.history,
      content.about.values_text
    )
  }
}

let mongoReady = false
let uploadBucket = null

export async function initializeContentPersistence() {
  if (!config.mongoUri) {
    console.warn('MONGODB_URI is not configured; content persistence is local only.')
    return
  }

  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 10000 })
  mongoReady = true
  uploadBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'uploads' })
  const saved = await ContentState.findOne({ key: 'church-content' }).lean()
  if (saved?.content) {
    restoreContent(saved.content)
  } else {
    await saveContentSnapshot()
  }
}

export function getUploadBucket() {
  if (!uploadBucket) throw new Error('MongoDB upload storage is not available')
  return uploadBucket
}

export async function saveContentSnapshot() {
  if (!mongoReady) return
  await ContentState.findOneAndUpdate(
    { key: 'church-content' },
    { key: 'church-content', content: readContent() },
    { upsert: true, setDefaultsOnInsert: true }
  )
}
