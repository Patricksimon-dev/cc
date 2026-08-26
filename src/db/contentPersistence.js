import mongoose from 'mongoose'
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
  return { announcements: [], sermons: [], activities: [], events: [], leadership: [], about: null }
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
    return
  } else {
    await saveContentSnapshot()
  }
}

export function getUploadBucket() {
  if (!uploadBucket) throw new Error('MongoDB upload storage is not available')
  return uploadBucket
}

export async function deleteUploadByUrl(value) {
  if (!value || !uploadBucket) return
  const id = value.split('/').pop()
  if (!mongoose.isValidObjectId(id)) return
  try {
    await uploadBucket.delete(new mongoose.Types.ObjectId(id))
  } catch (err) {
    if (err.code !== 'ENOENT') throw err
  }
}

export async function cleanupOrphanedUploads() {
  if (!uploadBucket) return
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
}

export { ContentState }

export async function saveContentSnapshot() {
  if (!mongoReady) return
  await ContentState.findOneAndUpdate(
    { key: 'church-content' },
    { key: 'church-content', content: readContent() },
    { upsert: true, setDefaultsOnInsert: true }
  )
}
