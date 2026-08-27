import mongoose from 'mongoose'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { config } from '../config.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, '../../data')
const localJsonFile = path.join(dataDir, 'content.json')

const contentStateSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, required: true },
    content: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
)

const ContentState = mongoose.models.ContentState || mongoose.model('ContentState', contentStateSchema)

export function readLocalContent() {
  try {
    if (fs.existsSync(localJsonFile)) {
      const raw = fs.readFileSync(localJsonFile, 'utf8')
      return JSON.parse(raw)
    }
  } catch (err) {
    console.error('Error reading local content JSON:', err.message)
  }
  return { announcements: [], sermons: [], activities: [], events: [], leadership: [], about: null }
}

export function writeLocalContent(content) {
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true })
    }
    fs.writeFileSync(localJsonFile, JSON.stringify(content, null, 2), 'utf8')
  } catch (err) {
    console.error('Error writing local content JSON:', err.message)
  }
}

let mongoReady = false
let uploadBucket = null

export async function initializeContentPersistence() {
  if (!config.mongoUri) {
    console.warn('MONGODB_URI is not configured; content persistence is local only.')
    return false
  }

  try {
    await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 5000 })
    mongoReady = true
    uploadBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'uploads' })
    console.info('MongoDB connected successfully.')
    const saved = await ContentState.findOne({ key: 'church-content' }).lean()
    if (!saved?.content) {
      await saveContentSnapshot(readLocalContent())
    }
    return true
  } catch (err) {
    console.warn('MongoDB connection unavailable, operating in local persistence mode:', err.message)
    mongoReady = false
    uploadBucket = null
    return false
  }
}

export function isMongoReady() {
  return mongoReady
}

export function getUploadBucket() {
  return uploadBucket
}

export async function deleteUploadByUrl(value) {
  if (!value) return
  const filename = value.split('/').pop()
  if (!filename) return

  const uploadsDir = path.join(__dirname, '../../uploads')
  const localFilePath = path.join(uploadsDir, filename)
  if (fs.existsSync(localFilePath)) {
    try {
      fs.unlinkSync(localFilePath)
    } catch (e) {}
  }

  if (uploadBucket && mongoose.isValidObjectId(filename)) {
    try {
      await uploadBucket.delete(new mongoose.Types.ObjectId(filename))
    } catch (err) {
      if (err.code !== 'ENOENT') throw err
    }
  }
}

export async function cleanupOrphanedUploads() {
  if (!uploadBucket) return
  try {
    const content = (await ContentState.findOne({ key: 'church-content' }).lean())?.content || {}
    const referencedIds = new Set(
      [...(content.leadership || []), ...(content.events || [])]
        .map((row) => row.imageUrl?.split('/').pop())
        .filter((id) => mongoose.isValidObjectId(id))
    )
    const files = await uploadBucket.find({}).toArray()
    await Promise.all(
      files
        .filter((file) => !referencedIds.has(file._id.toString()))
        .map((file) => uploadBucket.delete(file._id))
    )
  } catch (err) {
    console.error('Error cleaning orphaned uploads:', err.message)
  }
}

export { ContentState }

export async function saveContentSnapshot(content) {
  if (content) {
    writeLocalContent(content)
  }
  if (!mongoReady) return
  try {
    const dataToSave = content || readLocalContent()
    await ContentState.findOneAndUpdate(
      { key: 'church-content' },
      { key: 'church-content', content: dataToSave },
      { upsert: true, setDefaultsOnInsert: true }
    )
  } catch (err) {
    console.error('Error saving content snapshot to MongoDB:', err.message)
  }
}
