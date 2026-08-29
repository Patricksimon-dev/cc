import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import {
  ContentState,
  readLocalContent,
  writeLocalContent,
  isMongoReady,
} from '../db/contentPersistence.js'
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
let localDefaultAdminHash = bcrypt.hashSync(config.adminPassword, 12)

function getDocument() {
  if (!contentDocument) throw new Error('Content store is not initialized')
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
  if (contentDocument?.save && typeof contentDocument.save === 'function') {
    await contentDocument.save()
  }
  if (contentDocument?.content) {
    writeLocalContent(contentDocument.content)
  }
}

export async function initializeContentStore() {
  const localData = readLocalContent()

  if (isMongoReady()) {
    try {
      let saved = await ContentState.findOne({ key: 'church-content' })
      if (!saved) {
        saved = new ContentState({
          key: 'church-content',
          content: normalizeContent(localData),
        })
        await saved.save()
      } else {
        const mongoContent = normalizeContent(saved.content || {})
        if (!mongoContent.leadership || mongoContent.leadership.length === 0) {
          mongoContent.leadership = (localData.leadership && localData.leadership.length > 0)
            ? localData.leadership
            : [
                {
                  id: 'fff60e59-0aa7-4415-8d08-6eaef176a05b',
                  name: 'Rev. Dr. Patrick Ogar',
                  role: 'Senior Pastor & General Overseer',
                  bio: 'Leading Christ Chosen Assembly Ministry with vision, faith, and dedication to God’s word and community service.',
                  imageUrl: '/go-pastor.jpg',
                },
              ]
          saved.content = mongoContent
          saved.markModified('content')
          await saved.save()
        } else {
          saved.content = mongoContent
        }
      }

      contentDocument = saved
      contentDocument.markModified('content')
      writeLocalContent(contentDocument.content)

      const admins = mongoose.connection.db.collection('admins')
      const email = config.adminEmail.trim().toLowerCase()
      const existingAdmin = await admins.findOne({ email }).catch(() => null)
      if (!existingAdmin) {
        await admins.insertOne({ id: uuidv4(), email, password_hash: localDefaultAdminHash, name: 'Church Admin', created_at: new Date() }).catch(() => {})
      }
      return
    } catch (err) {
      console.warn('Failed to query MongoDB in initializeContentStore, switching to local store:', err.message)
    }
  }

  contentDocument = {
    content: normalizeContent(localData),
    markModified: () => {},
    save: async function () {
      writeLocalContent(this.content)
    },
  }
  writeLocalContent(contentDocument.content)
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
  const target = email.toLowerCase()
  if (isMongoReady() && mongoose.connection.db) {
    try {
      const found = await mongoose.connection.db.collection('admins').findOne({ email: target })
      if (found) return found
    } catch (e) {}
  }
  if (target === config.adminEmail.trim().toLowerCase()) {
    return {
      id: 'local-admin-id',
      email: config.adminEmail.trim().toLowerCase(),
      password_hash: localDefaultAdminHash,
      name: 'Church Admin',
    }
  }
  return null
}

export async function findAdminById(id) {
  if (isMongoReady() && mongoose.connection.db) {
    try {
      const found = await mongoose.connection.db.collection('admins').findOne({ id }, { projection: { password_hash: 0 } })
      if (found) return found
    } catch (e) {}
  }
  return {
    id: 'local-admin-id',
    email: config.adminEmail.trim().toLowerCase(),
    name: 'Church Admin',
  }
}

export async function updateAdminPassword(id, passwordHash) {
  localDefaultAdminHash = passwordHash
  if (isMongoReady() && mongoose.connection.db) {
    try {
      await mongoose.connection.db.collection('admins').updateOne({ id }, { $set: { password_hash: passwordHash } })
    } catch (e) {}
  }
}

export async function logSocialPublish(entry) {
  if (isMongoReady() && mongoose.connection.db) {
    try {
      await mongoose.connection.db.collection('social_logs').insertOne({ ...entry, created_at: new Date() })
    } catch (e) {}
  }
}

export async function getSocialLogs(limit = 50) {
  if (isMongoReady() && mongoose.connection.db) {
    try {
      return await mongoose.connection.db.collection('social_logs').find().sort({ created_at: -1 }).limit(limit).toArray()
    } catch (e) {}
  }
  return []
}
