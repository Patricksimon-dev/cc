import mongoose from 'mongoose'
import dotenv from 'dotenv'

dotenv.config()

if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI is not configured')
  process.exit(1)
}

await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 })
const database = mongoose.connection.db

await database.collection('contentstates').updateOne(
  { key: 'church-content' },
  {
    $set: {
      key: 'church-content',
      content: {
        announcements: [],
        sermons: [],
        activities: [],
        events: [],
        leadership: [],
        about: null,
      },
      updatedAt: new Date(),
    },
    $setOnInsert: { createdAt: new Date() },
  },
  { upsert: true }
)

const files = database.collection('uploads.files')
const chunks = database.collection('uploads.chunks')
const filesResult = await files.deleteMany({})
await chunks.deleteMany({})

console.log(`Content cleared. Uploaded files removed: ${filesResult.deletedCount}`)
await mongoose.disconnect()
