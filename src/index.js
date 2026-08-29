import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { config } from './config.js'
import authRoutes from './routes/auth.js'
import adminRoutes from './routes/admin.js'
import socialRoutes from './routes/social.js'
import contactRoutes from './routes/contact.js'
import { errorHandler } from './middleware/errorHandler.js'
import { getPublicContent, initializeContentStore } from './services/contentService.js'
import { getUpload } from './db/sqlitePersistence.js'

// Initialize SQLite content store
await initializeContentStore()
console.info('Server initialized with SQLite content store.')

const app = express()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const uploadsDir = path.join(__dirname, '../uploads')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

app.use(helmet({ contentSecurityPolicy: false }))
const allowedOrigins = Array.isArray(config.corsOrigin) ? config.corsOrigin : [config.corsOrigin]

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true)
      const cleanOrigin = origin.replace(/\/$/, '').toLowerCase()
      const isAllowed =
        allowedOrigins.some(
          (o) => o === '*' || o.replace(/\/$/, '').toLowerCase() === cleanOrigin
        ) ||
        cleanOrigin.includes('christchosenassemblymin.org.ng') ||
        cleanOrigin.includes('christchoosenassemblymin.org.ng') ||
        cleanOrigin.includes('vercel.app') ||
        cleanOrigin.includes('localhost')

      if (isAllowed) {
        callback(null, true)
      } else {
        console.warn(`CORS request from origin: ${origin} allowed dynamically.`)
        callback(null, true)
      }
    },
    credentials: true,
  })
)
app.use(express.json({ limit: '100mb' }))
app.use(express.urlencoded({ limit: '100mb', extended: true }))
app.use('/api/uploads', express.static(uploadsDir))
app.get('/api/uploads/:id', (req, res, next) => {
  try {
    const fileId = req.params.id
    const record = getUpload(fileId)
    if (record && record.data_base64) {
      const buffer = Buffer.from(record.data_base64, 'base64')
      res.type(record.mime_type || 'image/jpeg')
      return res.send(buffer)
    }

    const filePath = path.join(uploadsDir, fileId)
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return res.sendFile(filePath)
    }

    return res.status(404).end()
  } catch (err) {
    next(err)
  }
})

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Too many login attempts, try again later' },
})

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() })
})

app.get('/api/content', async (req, res, next) => {
  try {
    res.json(await getPublicContent())
  } catch (err) {
    next(err)
  }
})

app.use('/api', contactRoutes)
app.use('/api/auth', authLimiter, authRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/admin/social', socialRoutes)

app.use(errorHandler)

app.listen(config.port, () => {
  console.log(`Church API running on http://localhost:${config.port}`)
})
