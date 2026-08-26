import mongoose from 'mongoose'
import dotenv from 'dotenv'

dotenv.config()

if (!process.env.MONGODB_URI) {
  console.error('MONGODB_URI is not configured')
  process.exit(1)
}

await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 })
const db = mongoose.connection.db
const files = db.collection('uploads.files')
const chunks = db.collection('uploads.chunks')
const fileCount = await files.countDocuments()
const chunkCount = await chunks.countDocuments()
const total = await files.aggregate([
  { $group: { _id: null, bytes: { $sum: '$length' } } },
]).toArray()
const bytes = total[0]?.bytes || 0

console.log(`GridFS uploads: ${fileCount} files, ${chunkCount} chunks, ${bytes} bytes`)

if (process.argv.includes('--delete-all')) {
  await chunks.deleteMany({})
  await files.deleteMany({})
  console.log('All GridFS uploads deleted. Content records were not changed.')
} else {
  console.log('Nothing deleted. Run with --delete-all only when you want to remove every uploaded file.')
}

await mongoose.disconnect()
