import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import { ContentState } from '../db/contentPersistence.js'
import { config } from '../config.js'

const emptyContent = {
  announcements: [],
  sermons: [],
  activities: [],
  events: [],
  leadership: [],
  about: null,
}

let contentDocument = null

function getDocument() {
  if (!contentDocument) throw new Error('MongoDB content store is not initialized')
  return contentDocument
}

function publicContent(content) {
  return {
    announcements: [...(content.announcements || [])].sort((a, b) => Number(b.pinned) - Number(a.pinned) || String(b.date).localeCompare(String(a.date))),
    sermons: [...(content.sermons || [])].sort((a, b) => String(b.date).localeCompare(String(a.date))),
    activities: content.activities || [],
    events: [...(content.events || [])].sort((a, b) => String(a.date).localeCompare(String(b.date))),
    leadership: content.leadership || [],
    about: content.about || null,
  }
}

function normalizeContent(content = {}) {
  const map = {
    announcements: (item) => ({ ...item, pinned: Boolean(item.pinned) }),
    sermons: (item) => ({ ...item, videoUrl: item.videoUrl ?? item.video_url ?? '', audioUrl: item.audioUrl ?? item.audio_url ?? '' }),
    activities: (item) => ({ ...item }),
    events: (item) => ({ ...item, imageUrl: item.imageUrl ?? item.image_url ?? '' }),
    leadership: (item) => ({ ...item, imageUrl: item.imageUrl ?? item.image_url ?? '' }),
  }
  const normalized = { ...emptyContent, ...content }
  for (const [type, mapper] of Object.entries(map)) {
    normalized[type] = (normalized[type] || []).map(mapper)
  }
  if (normalized.about && normalized.about.welcome_title) {
    normalized.about = {
      welcomeTitle: normalized.about.welcomeTitle ?? normalized.about.welcome_title ?? '',
      welcomeText: normalized.about.welcomeText ?? normalized.about.welcome_text ?? '',
      mission: normalized.about.mission ?? '', vision: normalized.about.vision ?? '',
      history: normalized.about.history ?? '', values: normalized.about.values ?? normalized.about.values_text ?? '',
    }
  }
  return normalized
}

async function save() {
  await contentDocument.save()
}

export async function initializeContentStore() {
  if (!config.mongoUri) {
    throw new Error('MONGODB_URI must be configured; this server no longer uses SQLite')
  }
  const saved = await ContentState.findOne({ key: 'church-content' })
  contentDocument = saved || new ContentState({ key: 'church-content', content: { ...emptyContent } })
  contentDocument.content = normalizeContent(contentDocument.content)
  contentDocument.markModified('content')
  if (!saved) await save()
  else await save()
  const admins = mongoose.connection.db.collection('admins')
  const email = config.adminEmail.trim().toLowerCase()
  const existingAdmin = await admins.findOne({ email })
  if (!existingAdmin) {
    await admins.insertOne({ id: uuidv4(), email, password_hash: bcrypt.hashSync(config.adminPassword, 12), name: 'Church Admin', created_at: new Date() })
  }
}

export async function getPublicContent() {
  return publicContent(getDocument().content)
}

export async function getItemByType(type, id) {
  return getDocument().content[type]?.find((item) => item.id === id) || null
}

export const contentRepositories = {}
for (const type of ['announcements', 'sermons', 'activities', 'events', 'leadership']) {
  contentRepositories[type] = {
    list: async () => publicContent(getDocument().content)[type],
    create: async (id, body) => {
      const item = { id, ...body }
      getDocument().content[type].unshift(item)
      getDocument().markModified('content')
      await save()
      return item
    },
    update: async (id, body) => {
      const items = getDocument().content[type]
      const index = items.findIndex((item) => item.id === id)
      if (index < 0) return null
      items[index] = { ...items[index], ...body, id }
      getDocument().markModified('content')
      await save()
      return items[index]
    },
    remove: async (id) => {
      const items = getDocument().content[type]
      getDocument().content[type] = items.filter((item) => item.id !== id)
      getDocument().markModified('content')
      await save()
    },
  }
}

export async function updateAboutPage(body) {
  getDocument().content.about = {
    welcomeTitle: body.welcomeTitle || '', welcomeText: body.welcomeText || '', mission: body.mission || '',
    vision: body.vision || '', history: body.history || '', values: body.values || '',
  }
  getDocument().markModified('content')
  await save()
  return getDocument().content.about
}

export async function deleteAboutPage() {
  getDocument().content.about = null
  getDocument().markModified('content')
  await save()
}

export async function findAdminByEmail(email) {
  return mongoose.connection.db.collection('admins').findOne({ email: email.toLowerCase() })
}

export async function findAdminById(id) {
  return mongoose.connection.db.collection('admins').findOne({ id }, { projection: { password_hash: 0 } })
}

export async function updateAdminPassword(id, passwordHash) {
  await mongoose.connection.db.collection('admins').updateOne({ id }, { $set: { password_hash: passwordHash } })
}

export async function logSocialPublish(entry) {
  await mongoose.connection.db.collection('social_logs').insertOne({ ...entry, created_at: new Date() })
}

export async function getSocialLogs(limit = 50) {
  return mongoose.connection.db.collection('social_logs').find().sort({ created_at: -1 }).limit(limit).toArray()
}
